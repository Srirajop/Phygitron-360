from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List

from app.database import get_db
from app.models.organisation import Organisation
from app.models.user import User
from app.utils.auth import require_role, hash_password

router = APIRouter(prefix="/api/v1/platform", tags=["Platform Admin"])

def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}

# -----------------
# Pydantic Schemas
# -----------------
class OrgCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    max_users: int = 50
    plan: str = "free"
    has_source: bool = False
    has_verify: bool = False
    has_forge: bool = False
    has_deploy: bool = False

class OrgUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    max_users: Optional[int] = None
    plan: Optional[str] = None

class OrgModules(BaseModel):
    has_source: bool
    has_verify: bool
    has_forge: bool
    has_deploy: bool

class AdminCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str

# -----------------
# Endpoints
# -----------------

@router.get("/orgs")
async def list_organisations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    result = await db.execute(select(Organisation).order_by(Organisation.created_at.desc()))
    orgs = result.scalars().all()
    
    data = []
    for org in orgs:
        # Get user count
        count_res = await db.execute(select(func.count(User.id)).where(User.org_id == org.id))
        user_count = count_res.scalar()
        
        data.append({
            "id": org.id,
            "name": org.name,
            "domain": org.domain,
            "logo_url": org.logo_url,
            "is_active": org.is_active,
            "max_users": org.max_users,
            "plan": org.plan,
            "user_count": user_count,
            "modules": {
                "source": org.has_source,
                "verify": org.has_verify,
                "forge": org.has_forge,
                "deploy": org.has_deploy,
            },
            "created_at": org.created_at.isoformat() if org.created_at else None,
        })
    return success(data)


@router.post("/orgs")
async def create_organisation(
    body: OrgCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    org = Organisation(
        name=body.name,
        domain=body.domain,
        max_users=body.max_users,
        plan=body.plan,
        has_source=body.has_source,
        has_verify=body.has_verify,
        has_forge=body.has_forge,
        has_deploy=body.has_deploy,
    )
    db.add(org)
    await db.commit()
    return success({"id": org.id}, "Organisation created")


@router.put("/orgs/{org_id}")
async def update_organisation(
    org_id: int,
    body: OrgUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    result = await db.execute(select(Organisation).where(Organisation.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    if body.name is not None: org.name = body.name
    if body.domain is not None: org.domain = body.domain
    if body.max_users is not None: org.max_users = body.max_users
    if body.plan is not None: org.plan = body.plan

    await db.commit()
    return success(message="Organisation updated")


@router.put("/orgs/{org_id}/modules")
async def update_org_modules(
    org_id: int,
    body: OrgModules,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    result = await db.execute(select(Organisation).where(Organisation.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    org.has_source = body.has_source
    org.has_verify = body.has_verify
    org.has_forge = body.has_forge
    org.has_deploy = body.has_deploy

    await db.commit()
    return success(message="Modules updated")


@router.put("/orgs/{org_id}/toggle")
async def toggle_org_status(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    result = await db.execute(select(Organisation).where(Organisation.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    org.is_active = not org.is_active
    await db.commit()
    return success({"is_active": org.is_active}, "Organisation status toggled")


@router.post("/orgs/{org_id}/admin")
async def create_org_admin(
    org_id: int,
    body: AdminCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    result = await db.execute(select(Organisation).where(Organisation.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        full_name=body.full_name,
        role="org_admin",
        password_hash=hash_password(body.password),
        org_id=org.id,
        is_active=True,
        first_login=True,
    )
    db.add(user)
    await db.commit()
    return success({"id": user.id}, "Admin user created")


@router.get("/stats")
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["super_admin"])),
):
    orgs_res = await db.execute(select(func.count(Organisation.id)))
    users_res = await db.execute(select(func.count(User.id)))
    active_orgs_res = await db.execute(select(func.count(Organisation.id)).where(Organisation.is_active == True))
    
    return success({
        "total_organisations": orgs_res.scalar(),
        "active_organisations": active_orgs_res.scalar(),
        "total_users": users_res.scalar(),
    })
