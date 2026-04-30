import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app.models.user import User, UserRole
from app.models.deploy import (
    Employee, EmployeeStatus, OnboardingInvite, OnboardingStatus,
    LeaveBalance, AssetChecklist
)
from app.models.organisation import Organisation
from app.utils.auth import hash_password, get_current_user, require_role
from app.utils.email import send_email, render_template, INVITE_TEMPLATE
from app.config import settings

router = APIRouter(prefix="/api/v1/onboarding", tags=["Onboarding"])

def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}

# ── Admin Actions ─────────────────────────────────────────────────────────────

@router.post("/invite")
async def send_onboarding_invite(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin sends an onboarding invite to a new hire."""
    # Check if already invited
    existing = await db.execute(select(OnboardingInvite).where(OnboardingInvite.email == data["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invite already sent to this email")

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invite = OnboardingInvite(
        org_id=current_user.org_id,
        email=data["email"],
        full_name=data["full_name"],
        role=data.get("role", "employee"),
        department=data.get("department"),
        designation=data.get("designation"),
        token=token,
        expires_at=expires_at
    )
    db.add(invite)
    
    # Get org name for email
    org_res = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
    org = org_res.scalar_one_or_none()
    company_name = org.name if org else "Phygitron 360"

    # Send Email
    html = render_template(
        INVITE_TEMPLATE,
        candidate_name=data["full_name"],
        role_name=data.get("designation", "Staff"),
        company_name=company_name,
        email=data["email"],
        temp_password="Set your own during setup", # PDF says they choose their own
        deadline=expires_at.strftime("%Y-%m-%d"),
        platform_url=settings.FRONTEND_URL,
    )
    # Update link in template logic or just use a custom one
    invite_link = f"{settings.FRONTEND_URL}/onboarding/setup?token={token}"
    html = html.replace(f"{settings.FRONTEND_URL}/login?email={data['email']}", invite_link)

    await send_email(data["email"], f"Onboarding Invitation from {company_name}", html)
    
    await db.commit()
    return success(message="Invite sent successfully", data={"token": token})

@router.get("/invites")
async def list_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(OnboardingInvite).where(OnboardingInvite.org_id == current_user.org_id)
    result = await db.execute(query)
    return success([{
        "id": i.id,
        "email": i.email,
        "name": i.full_name,
        "status": i.status.value,
        "expires_at": i.expires_at.isoformat()
    } for i in result.scalars()])

# ── Public Actions ────────────────────────────────────────────────────────────

@router.get("/verify-token/{token}")
async def verify_onboarding_token(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OnboardingInvite).where(OnboardingInvite.token == token))
    invite = result.scalar_one_or_none()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    if invite.status != OnboardingStatus.pending:
        raise HTTPException(status_code=400, detail="Invite already used or revoked")
        
    if invite.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite token expired")
        
    return success({
        "email": invite.email,
        "full_name": invite.full_name,
        "department": invite.department,
        "designation": invite.designation
    })

@router.post("/complete")
async def complete_onboarding(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """New hire completes their profile and creates account."""
    token = data.get("token")
    result = await db.execute(select(OnboardingInvite).where(OnboardingInvite.token == token))
    invite = result.scalar_one_or_none()
    
    if not invite or invite.status != OnboardingStatus.pending:
        raise HTTPException(status_code=400, detail="Invalid or used token")

    try:
        # 1. Get or Create User
        # Check if user already exists (might have been created manually or in another module)
        user_res = await db.execute(select(User).where(User.email == invite.email))
        existing_user = user_res.scalar_one_or_none()
        
        if existing_user:
            new_user = existing_user
            # Optional: update role if needed
            new_user.role = UserRole(invite.role if invite.role in [r.value for r in UserRole] else "employee")
            new_user.first_login = False
        else:
            # Create new user
            target_role = invite.role if invite.role in [r.value for r in UserRole] else "employee"
            new_user = User(
                email=invite.email,
                password_hash=hash_password(data["password"]),
                role=UserRole(target_role),
                org_id=invite.org_id,
                full_name=invite.full_name,
                first_login=False
            )
            db.add(new_user)
            await db.flush() # Get user ID

        # Check if employee record already exists
        emp_res = await db.execute(select(Employee).where(Employee.user_id == new_user.id))
        if emp_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="An employee profile already exists for this account.")

        # 2. Create Employee
        new_emp = Employee(
            user_id=new_user.id,
            org_id=invite.org_id,
            emp_id=f"EMP{str(new_user.id).zfill(3)}", # Standard EMP001 format
            department=invite.department,
            designation=invite.designation,
            dob=datetime.strptime(data["dob"], "%Y-%m-%d").date() if data.get("dob") else None,
            contact_number=data.get("contact_number"),
            current_address=data.get("current_address"),
            join_date=datetime.now().date(),
            status=EmployeeStatus.active
        )
        db.add(new_emp)
        await db.flush()

        # 3. Initialize Leave Balances
        balances = LeaveBalance(
            employee_id=new_emp.id,
            year=datetime.now().year,
            sick_allocated=10,
            casual_allocated=12,
            privilege_allocated=15
        )
        db.add(balances)

        # 4. Create Asset Checklist (Placeholder categories)
        assets = ["Laptop", "ID Card", "Email Access", "Groups / Channels"]
        for a_name in assets:
            db.add(AssetChecklist(employee_id=new_emp.id, category=a_name, item_name=f"Standard {a_name}"))

        # 5. Mark invite as completed
        invite.status = OnboardingStatus.completed
        
        await db.commit()
        return success(message="Onboarding completed! You can now log in.")
    except Exception as e:
        import traceback
        with open("onboarding_error.log", "a") as f:
            f.write(f"\n[{datetime.now()}] ERROR completing onboarding: {str(e)}\n")
            f.write(traceback.format_exc())
            f.write("\n" + "="*50 + "\n")
        raise HTTPException(status_code=500, detail=f"Setup failed: {str(e)}")
