import json
import logging
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, UserRole
from app.models.deploy import (
    Employee, EmployeeSkill, Deployment, ProjectRequirement, 
    EmployeeStatus, DeploymentStatus, Attendance, AttendanceStatus, 
    LeaveRequest, LeaveType, LeaveStatus, Asset, PerformanceRecord, HRActivity,
    LeaveBalance, KRALibrary, KRAAssessment, KRAAssessmentItem, KRAAssessmentStatus,
    TrainingProgram, TrainingAssignment, TrainingStatus, OnboardingInvite, AssetChecklist,
    PayrollSlip, PayrollStatus
)
from app.models.notification import Notification, NotificationType
from app.models.source import Candidate
from app.models.skill_taxonomy import SkillTaxonomy
from app.models.ai_score import AIScore, EntityType, ScoreType
from app.models.verify import AssessmentResult
from app.models.forge import Enrollment, Certificate
from app.utils.auth import (
    get_current_user,
    require_role,
    require_module,
    generate_temp_password,
    hash_password,
)
from app.routers.notifications import create_notification

router = APIRouter(prefix="/api/v1/deploy", tags=["Deploy"])
logger = logging.getLogger(__name__)

def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


def _normalize_path(path: Optional[str]) -> Optional[str]:
    return path.replace("\\", "/") if path else None


async def _get_employee_for_user(db: AsyncSession, user_id: int) -> Optional[Employee]:
    res = await db.execute(select(Employee).where(Employee.user_id == user_id))
    return res.scalar_one_or_none()


async def _get_capability_score(db: AsyncSession, employee_id: int) -> Optional[float]:
    cap_res = await db.execute(
        select(AIScore)
        .where(
            AIScore.entity_type == EntityType.employee,
            AIScore.entity_id == employee_id,
            AIScore.score_type == ScoreType.capability_index,
        )
        .order_by(AIScore.created_at.desc())
        .limit(1)
    )
    cap_score = cap_res.scalar_one_or_none()
    return float(cap_score.score) if cap_score and cap_score.score is not None else None

# ── Employee List ─────────────────────────────────────────────────────────────

@router.get("/employees")
async def list_employees(
    department: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Employee).where(Employee.org_id == current_user.org_id)
    if department:
        query = query.where(Employee.department == department)
    if status:
        query = query.where(Employee.status == status)

    result = await db.execute(query)
    employees = result.scalars().all()

    output = []
    for emp in employees:
        user_res = await db.execute(select(User).where(User.id == emp.user_id))
        user = user_res.scalar_one_or_none()
        skills_count = await db.execute(select(func.count()).select_from(EmployeeSkill).where(EmployeeSkill.employee_id == emp.id))
        capability_index = await _get_capability_score(db, emp.id)
        output.append({
            "id": emp.id,
            "emp_id": emp.emp_id,
            "name": user.full_name if user else "",
            "email": user.email if user else "",
            "department": emp.department,
            "designation": emp.designation,
            "status": emp.status.value,
            "join_date": emp.join_date.isoformat() if emp.join_date else None,
            "skill_count": skills_count.scalar() or 0,
            "capability_index": capability_index,
            "resume_url": _normalize_path(emp.cv_path),
        })

    return success(output)

@router.get("/employees/{employee_id}")
async def get_employee_profile(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.org_id == current_user.org_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    user_res = await db.execute(select(User).where(User.id == emp.user_id))
    user = user_res.scalar_one_or_none()

    # Skills
    skills_res = await db.execute(
        select(EmployeeSkill, SkillTaxonomy).join(SkillTaxonomy).where(EmployeeSkill.employee_id == employee_id)
    )
    skills = [{
        "skill_id": es.skill_id, "name": st.name, "level": es.level.value,
        "verified_by": es.verified_by.value, "last_verified_at": es.last_verified_at.isoformat() if es.last_verified_at else None,
        "decayed": es.decayed,
    } for es, st in skills_res]

    # HRMS: Assets
    asset_res = await db.execute(select(Asset).where(Asset.employee_id == employee_id).order_by(Asset.issue_date.desc()))
    assets = [{
        "id": a.id, "name": a.asset_name, "type": a.asset_type, "serial": a.serial_number,
        "issued": a.issue_date.isoformat() if a.issue_date else None,
        "condition": a.condition
    } for a in asset_res.scalars()]

    # HRMS: Performance
    perf_res = await db.execute(select(PerformanceRecord).where(PerformanceRecord.employee_id == employee_id).order_by(PerformanceRecord.year.desc()))
    performance = [{
        "id": p.id, "year": p.year, "rating": float(p.rating) if p.rating else None,
        "summary": p.review_summary
    } for p in perf_res.scalars()]

    # HRMS: Activities
    act_res = await db.execute(select(HRActivity).where(HRActivity.employee_id == employee_id).order_by(HRActivity.activity_date.desc()))
    activities = [{
        "id": act.id, "type": act.activity_type, "desc": act.description,
        "date": act.activity_date.isoformat() if act.activity_date else None
    } for act in act_res.scalars()]

    deploy_res = await db.execute(
        select(Deployment).where(Deployment.employee_id == employee_id).order_by(Deployment.start_date.desc(), Deployment.created_at.desc())
    )
    deployments = [{
        "id": d.id,
        "project_name": d.project_name,
        "client_name": d.client_name,
        "start_date": d.start_date.isoformat() if d.start_date else None,
        "end_date": d.end_date.isoformat() if d.end_date else None,
        "status": d.status.value,
        "skills_utilised": d.skills_utilised or [],
        "created_at": d.created_at.isoformat() if d.created_at else None,
    } for d in deploy_res.scalars()]

    cert_res = await db.execute(select(Certificate).where(Certificate.user_id == emp.user_id).order_by(Certificate.issued_at.desc()))
    certificates = [{
        "id": c.id,
        "verification_code": c.verification_code,
        "issued_at": c.issued_at.isoformat() if c.issued_at else None,
        "pdf_url": c.pdf_url,
    } for c in cert_res.scalars()]

    enroll_res = await db.execute(select(Enrollment).where(Enrollment.user_id == emp.user_id).order_by(Enrollment.created_at.desc()))
    learning = [{
        "id": e.id,
        "progress_percent": float(e.progress_percent or 0),
        "completed_at": e.completed_at.isoformat() if e.completed_at else None,
    } for e in enroll_res.scalars()]

    assess_res = await db.execute(
        select(AssessmentResult).where(AssessmentResult.user_id == emp.user_id).order_by(AssessmentResult.created_at.desc())
    )
    assessment_history = [{
        "id": a.id,
        "score": float(a.score) if a.score is not None else None,
        "pass_status": a.pass_status,
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
    } for a in assess_res.scalars()]

    kra_res = await db.execute(
        select(KRAAssessment).where(KRAAssessment.employee_id == employee_id).order_by(KRAAssessment.year.desc())
    )
    kra_assessments = [{
        "id": k.id,
        "period": k.period,
        "year": k.year,
        "status": k.status.value,
        "score": float(k.total_score) if k.total_score is not None else None,
    } for k in kra_res.scalars()]

    training_res = await db.execute(
        select(TrainingAssignment, TrainingProgram)
        .join(TrainingProgram, TrainingAssignment.program_id == TrainingProgram.id)
        .where(TrainingAssignment.employee_id == employee_id)
        .order_by(TrainingAssignment.assigned_date.desc())
    )
    training_assignments = [{
        "id": ta.id,
        "program_id": ta.program_id,
        "program_name": program.name,
        "status": ta.status.value,
        "assigned_date": ta.assigned_date.isoformat() if ta.assigned_date else None,
        "completion_date": ta.completion_date.isoformat() if ta.completion_date else None,
    } for ta, program in training_res]

    checklist_res = await db.execute(
        select(AssetChecklist).where(AssetChecklist.employee_id == employee_id).order_by(AssetChecklist.id.asc())
    )
    asset_checklist = [{
        "id": a.id,
        "category": a.category,
        "item_name": a.item_name,
        "issued": a.issued,
        "returned": a.returned,
        "condition": a.condition,
    } for a in checklist_res.scalars()]

    capability_index = await _get_capability_score(db, emp.id)

    profile = {
        "id": emp.id,
        "emp_id": emp.emp_id,
        "department": emp.department,
        "designation": emp.designation,
        "status": emp.status.value,
        "dob": emp.dob.isoformat() if emp.dob else None,
        "contact_number": emp.contact_number,
        "emergency_contact": emp.emergency_contact,
        "location": emp.location,
        "employment_type": emp.employment_type,
        "join_date": emp.join_date.isoformat() if emp.join_date else None,
        "pf_included": emp.pf_included,
        "mediclaim_included": emp.mediclaim_included,
        "current_address": emp.current_address,
        "permanent_address": emp.permanent_address,
        "education_details": emp.education_details or [],
        "photo_path": _normalize_path(emp.photo_path),
        "cv_path": _normalize_path(emp.cv_path),
        "id_proofs": _normalize_path(emp.id_proofs),
        "notes": emp.notes,
        "exit_date": emp.exit_date.isoformat() if emp.exit_date else None,
        "exit_reason": emp.exit_reason,
        "clearance_status": emp.clearance_status,
        "capability_index": capability_index or 0,
        "user": {
            "id": user.id if user else None,
            "full_name": user.full_name if user else "",
            "email": user.email if user else "",
        },
        "skills": skills,
        "deployments": deployments,
        "assets": assets,
        "asset_checklist": asset_checklist,
        "performance": performance,
        "activities": activities,
        "learning": learning,
        "assessment_history": assessment_history,
        "kra_assessments": kra_assessments,
        "training_assignments": training_assignments,
        "certificates": certificates,
        "experience_years": None,
    }

    profile["employee"] = {
        "id": profile["id"],
        "emp_id": profile["emp_id"],
        "name": profile["user"]["full_name"],
        "designation": profile["designation"],
        "department": profile["department"],
        "status": profile["status"],
        "dob": profile["dob"],
        "contact": profile["contact_number"],
        "emergency_contact": profile["emergency_contact"],
        "location": profile["location"],
        "employment_type": profile["employment_type"],
        "pf_included": profile["pf_included"],
        "mediclaim_included": profile["mediclaim_included"],
        "current_address": profile["current_address"],
        "permanent_address": profile["permanent_address"],
        "education_details": profile["education_details"],
        "photo_path": profile["photo_path"],
        "cv_path": profile["cv_path"],
        "id_proofs": profile["id_proofs"],
        "notes": profile["notes"],
        "exit_date": profile["exit_date"],
        "exit_reason": profile["exit_reason"],
        "clearance_status": profile["clearance_status"],
    }
    return success(profile)

@router.post("/employees/{employee_id}/documents")
async def upload_employee_documents(
    employee_id: int,
    photo: Optional[UploadFile] = File(None),
    cv: Optional[UploadFile] = File(None),
    id_proof: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.org_id == current_user.org_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    import os
    upload_dir = os.path.join("backend", "uploads", str(current_user.org_id), "employees", str(employee_id))
    os.makedirs(upload_dir, exist_ok=True)

    if photo:
        file_path = os.path.join(upload_dir, f"photo_{photo.filename}")
        with open(file_path, "wb") as f:
            f.write(await photo.read())
        emp.photo_path = file_path

    if cv:
        file_path = os.path.join(upload_dir, f"cv_{cv.filename}")
        with open(file_path, "wb") as f:
            f.write(await cv.read())
        emp.cv_path = file_path

    if id_proof:
        file_path = os.path.join(upload_dir, f"id_{id_proof.filename}")
        with open(file_path, "wb") as f:
            f.write(await id_proof.read())
        emp.id_proofs = file_path

    await db.commit()
    return success(message="Documents uploaded successfully")

# ── Attendance ────────────────────────────────────────────────────────────────

@router.get("/attendance/status")
async def get_today_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if employee has clocked in today."""
    emp = await _get_employee_for_user(db, current_user.id)
    if not emp: return success({"clocked_in": False})

    today = date.today()
    att_res = await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date == today))
    att = att_res.scalar_one_or_none()
    
    return success({
        "clocked_in": att is not None,
        "clocked_out": att.clock_out is not None if att else False,
        "clock_in_time": att.clock_in.isoformat() if att and att.clock_in else None,
        "clock_out_time": att.clock_out.isoformat() if att and att.clock_out else None,
    })

@router.post("/attendance/clock-in")
async def clock_in(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    emp = await _get_employee_for_user(db, current_user.id)
    if not emp: raise HTTPException(404, "Employee record not found")

    today = date.today()
    existing = await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date == today))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Already clocked in today")

    client_ip = request.client.host
    new_att = Attendance(
        employee_id=emp.id,
        date=today,
        clock_in=datetime.now(),
        notes=f"IP: {client_ip}",
        status=AttendanceStatus.present
    )
    db.add(new_att)
    await db.commit()
    
    # Trigger notification
    from app.routers.notifications import create_notification
    await create_notification(
        db, current_user.id, "Attendance In", 
        "Clock-in recorded successfully for today.",
        NotificationType.info
    )
    
    return success(message="Clocked in successfully")

@router.post("/attendance/clock-out")
async def clock_out(
    work_log: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    emp = await _get_employee_for_user(db, current_user.id)
    if not emp: raise HTTPException(404, "Employee record not found")

    today = date.today()
    att_res = await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date == today))
    att = att_res.scalar_one_or_none()
    
    if not att: raise HTTPException(400, "Must clock in first")
    if att.clock_out: raise HTTPException(400, "Already clocked out")

    att.clock_out = datetime.now()
    att.notes = f"{att.notes} | Log: {work_log}"
    
    # Calculate status based on hours
    delta = att.clock_out - att.clock_in
    hours = delta.total_seconds() / 3600
    
    if hours >= 9:
        att.status = AttendanceStatus.present
    elif hours >= 4.5:
        att.status = AttendanceStatus.half_day
    else:
        att.status = AttendanceStatus.absent

    await db.commit()
    
    # Trigger notification
    from app.routers.notifications import create_notification
    await create_notification(
        db, current_user.id, "Clock Out Successful", 
        f"Work log recorded: {work_log[:30]}...",
        NotificationType.success
    )
    
    return success(message=f"Clocked out. Status: {att.status.value}")

@router.get("/attendance")
async def get_attendance(
    employee_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_emp = None
    if employee_id:
        emp_res = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.org_id == current_user.org_id))
        target_emp = emp_res.scalar_one_or_none()
    else:
        target_emp = await _get_employee_for_user(db, current_user.id)

    if not target_emp:
        raise HTTPException(status_code=404, detail="Employee record not found")

    if month and year and not start_date and not end_date:
        start_date = date(int(year), int(month), 1)
        end_date = date(int(year) + (1 if int(month) == 12 else 0), 1 if int(month) == 12 else int(month) + 1, 1)
        end_date = date.fromordinal(end_date.toordinal() - 1)

    query = select(Attendance).where(Attendance.employee_id == target_emp.id)
    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)

    result = await db.execute(query.order_by(Attendance.date.desc()))
    records_raw = result.scalars().all()

    records = []
    total_hours = 0.0
    for a in records_raw:
        hours = 0.0
        if a.clock_in and a.clock_out:
            hours = round((a.clock_out - a.clock_in).total_seconds() / 3600, 2)
            total_hours += hours
        records.append({
            "id": a.id,
            "date": a.date.isoformat(),
            "status": a.status.value,
            "clock_in": a.clock_in.isoformat() if a.clock_in else None,
            "clock_out": a.clock_out.isoformat() if a.clock_out else None,
            "clocked_in": a.clock_in is not None,
            "clocked_out": a.clock_out is not None,
            "hours": hours,
            "notes": a.notes,
        })

    today_key = date.today().isoformat()
    today_record = next((r for r in records if r["date"] == today_key), {"clocked_in": False, "clocked_out": False})

    payload = {
        "today": today_record,
        "summary": {
            "total_present": sum(1 for r in records if r["status"] == AttendanceStatus.present.value),
            "total_absent": sum(1 for r in records if r["status"] == AttendanceStatus.absent.value),
            "total_half_day": sum(1 for r in records if r["status"] == AttendanceStatus.half_day.value),
            "total_leave": sum(1 for r in records if r["status"] == AttendanceStatus.leave.value),
            "total_hours": round(total_hours, 2),
        },
        "records": list(reversed(records)),
    }
    return success(payload)


@router.get("/attendance/team")
async def get_team_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = date.today()
    emp_res = await db.execute(select(Employee).where(Employee.org_id == current_user.org_id).order_by(Employee.id.asc()))
    employees = emp_res.scalars().all()

    team = []
    present = 0
    absent = 0
    for emp in employees:
        user_res = await db.execute(select(User).where(User.id == emp.user_id))
        user = user_res.scalar_one_or_none()
        att_res = await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date == today))
        att = att_res.scalar_one_or_none()
        status = att.status.value if att else AttendanceStatus.absent.value
        if status == AttendanceStatus.present.value:
            present += 1
        else:
            absent += 1
        team.append({
            "employee_id": emp.id,
            "name": user.full_name if user else emp.emp_id or f"EMP-{emp.id}",
            "department": emp.department,
            "status": status,
            "clock_in": att.clock_in.isoformat() if att and att.clock_in else None,
            "clock_out": att.clock_out.isoformat() if att and att.clock_out else None,
        })

    return success({
        "date": today.isoformat(),
        "present": present,
        "absent": absent,
        "team": team,
    })

# ── Leave Requests ────────────────────────────────────────────────────────────

@router.get("/leave/balance")
async def get_leave_balance(
    employee_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not employee_id:
        emp = await _get_employee_for_user(db, current_user.id)
        if not emp: raise HTTPException(404, "Employee not found")
        target_id = emp.id
    else:
        target_id = employee_id

    res = await db.execute(select(LeaveBalance).where(LeaveBalance.employee_id == target_id, LeaveBalance.year == date.today().year))
    bal = res.scalar_one_or_none()
    if not bal:
        # Initialize if missing
        bal = LeaveBalance(employee_id=target_id, year=date.today().year)
        db.add(bal)
        await db.commit()
        await db.refresh(bal)
        
    return success({
        "sick": {"allocated": bal.sick_allocated, "used": bal.sick_used, "remaining": bal.sick_allocated - bal.sick_used},
        "casual": {"allocated": bal.casual_allocated, "used": bal.casual_used, "remaining": bal.casual_allocated - bal.casual_used},
        "privilege": {"allocated": bal.privilege_allocated, "used": bal.privilege_used, "remaining": bal.privilege_allocated - bal.privilege_used},
    })

@router.post("/leave/apply")
async def apply_leave(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    emp = await _get_employee_for_user(db, current_user.id)
    if not emp: raise HTTPException(404, "Employee record not found")

    start = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
    end = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
    days = (end - start).days + 1
    ltype = LeaveType(data["leave_type"])
    
    # Check balance
    bal_res = await db.execute(select(LeaveBalance).where(LeaveBalance.employee_id == emp.id, LeaveBalance.year == start.year))
    bal = bal_res.scalar_one_or_none()
    if not bal: raise HTTPException(400, "Leave balance not initialized")
    
    remaining = 0
    if ltype == LeaveType.sick: remaining = bal.sick_allocated - bal.sick_used
    elif ltype == LeaveType.casual: remaining = bal.casual_allocated - bal.casual_used
    elif ltype == LeaveType.privilege: remaining = bal.privilege_allocated - bal.privilege_used
    
    if days > remaining:
        raise HTTPException(400, f"Insufficient balance. Requested {days}, Remaining {remaining}")

    new_req = LeaveRequest(
        employee_id=emp.id,
        leave_type=ltype,
        start_date=start,
        end_date=end,
        reason=data.get("reason"),
        status=LeaveStatus.pending
    )
    db.add(new_req)
    await db.commit()
    await db.commit()
    
    # Notify Admins and Managers (Simplified: notify current user + system admin log)
    from app.routers.notifications import create_notification
    await create_notification(
        db, current_user.id, "Leave Requested", 
        f"Your {ltype.value} leave for {days} days is pending approval.",
        NotificationType.info
    )
    
    return success(message="Leave application submitted")

@router.get("/leave/requests")
async def list_leave_requests(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(LeaveRequest)
    if current_user.role == UserRole.employee:
        emp = await _get_employee_for_user(db, current_user.id)
        if emp: query = query.where(LeaveRequest.employee_id == emp.id)
    
    if status:
        query = query.where(LeaveRequest.status == status)
    
    result = await db.execute(query.order_by(LeaveRequest.start_date.desc()))
    rows = []
    for l in result.scalars():
        emp_res = await db.execute(select(Employee).where(Employee.id == l.employee_id))
        emp = emp_res.scalar_one_or_none()
        user_res = await db.execute(select(User).where(User.id == emp.user_id)) if emp else (None)
        user = user_res.scalar_one_or_none() if user_res else None
        rows.append({
            "id": l.id,
            "employee_id": l.employee_id,
            "employee_name": user.full_name if user else (emp.emp_id if emp else f"EMP-{l.employee_id}"),
            "leave_type": l.leave_type.value if l.leave_type else None,
            "type": l.leave_type.value if l.leave_type else None,
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "start": l.start_date.isoformat(),
            "end": l.end_date.isoformat(),
            "status": l.status.value,
            "reason": l.reason,
        })
    return success(rows)

@router.put("/leave/{request_id}/approve")
async def approve_leave(
    request_id: int,
    approve: bool = Body(..., embed=True),
    reason: Optional[str] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    req = res.scalar_one_or_none()
    if not req: raise HTTPException(404, "Request not found")

    if approve:
        req.status = LeaveStatus.approved
        # Deduct balance
        days = (req.end_date - req.start_date).days + 1
        bal_res = await db.execute(select(LeaveBalance).where(LeaveBalance.employee_id == req.employee_id, LeaveBalance.year == req.start_date.year))
        bal = bal_res.scalar_one_or_none()
        if bal:
            if req.leave_type == LeaveType.sick: bal.sick_used += days
            elif req.leave_type == LeaveType.casual: bal.casual_used += days
            elif req.leave_type == LeaveType.privilege: bal.privilege_used += days
    else:
        req.status = LeaveStatus.rejected
        
    req.approved_by = current_user.id
    await db.commit()

    # Notify Employee
    from app.routers.notifications import create_notification
    emp_res = await db.execute(select(Employee).where(Employee.id == req.employee_id))
    emp = emp_res.scalar_one_or_none()
    notif_msg = f"Your leave request has been {'Approved' if approve else 'Rejected'}."
    await create_notification(
        db, emp.user_id if emp else current_user.id,
        f"Leave { 'Approved' if approve else 'Rejected' }", 
        notif_msg,
        NotificationType.success if approve else NotificationType.warning
    )

    return success(message=f"Leave {'approved' if approve else 'rejected'}")

@router.post("/employees")
async def create_employee(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Direct employee creation by Admin."""
    # 1. Get or Create User
    user_id = data.get("user_id")
    temp_pass = None
    
    if user_id:
        # Link existing user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user: raise HTTPException(404, "User not found")
        
        # Check if already an employee
        existing_emp = await db.execute(select(Employee).where(Employee.user_id == user.id))
        if existing_emp.scalar_one_or_none():
            raise HTTPException(400, "This user is already linked to an employee record")
            
        new_user = user
    else:
        # Create new user
        if not data.get("email"): raise HTTPException(400, "Email is required for new user")
        existing = await db.execute(select(User).where(User.email == data["email"]))
        if existing.scalar_one_or_none():
            raise HTTPException(400, "User with this email already exists")

        temp_pass = generate_temp_password()
        new_user = User(
            email=data["email"],
            password_hash=hash_password(temp_pass),
            role=UserRole(data.get("role", "employee")),
            org_id=current_user.org_id,
            full_name=data.get("name", "New Employee"),
            is_active=True,
            first_login=True
        )
        db.add(new_user)
        await db.flush()

    new_emp = Employee(
        user_id=new_user.id,
        org_id=current_user.org_id,
        emp_id=data.get("emp_id") or data.get("employee_code") or f"EMP{str(new_user.id).zfill(3)}",
        department=data.get("department"),
        designation=data.get("designation"),
        dob=datetime.strptime(data["dob"], "%Y-%m-%d").date() if data.get("dob") else None,
        contact_number=data.get("contact_number"),
        emergency_contact=data.get("emergency_contact"),
        join_date=datetime.strptime(data["join_date"], "%Y-%m-%d").date() if data.get("join_date") else datetime.now().date(),
        status=EmployeeStatus.active,
        employment_type=data.get("employment_type", "Full-Time"),
        location=data.get("location"),
        current_address=data.get("current_address"),
        permanent_address=data.get("permanent_address"),
        pf_included=data.get("pf_included", False),
        mediclaim_included=data.get("mediclaim_included", False),
        notes=data.get("notes"),
        manager_id=None
    )
    if data.get("manager_id"):
        manager_emp_res = await db.execute(select(Employee).where(Employee.user_id == int(data["manager_id"]), Employee.org_id == current_user.org_id))
        manager_emp = manager_emp_res.scalar_one_or_none()
        new_emp.manager_id = manager_emp.id if manager_emp else None
    db.add(new_emp)
    await db.flush()

    # Initialize balances
    db.add(LeaveBalance(employee_id=new_emp.id, year=date.today().year))
    
    # Assets
    for cat in ["Laptop", "ID Card", "Email Access"]:
        db.add(AssetChecklist(employee_id=new_emp.id, category=cat, item_name=f"Standard {cat}"))

    await db.commit()
    
    # Send Email with temp password
    from app.utils.email import send_invite_email
    # Note: send_invite_email currently uses Assessment template, but we can reuse for creds
    # Or just use send_email with custom body. For now, we'll return it in response to show on screen as per PDF.
    
    return success({
        "id": new_emp.id,
        "employee_id": new_emp.id,
        "temp_password": temp_pass
    }, message="Employee created successfully")

@router.put("/employees/{id}")
async def update_employee(
    id: int, 
    data: dict = Body(...), 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Employee).where(Employee.id == id, Employee.org_id == current_user.org_id))
    emp = result.scalar_one_or_none()
    if not emp: raise HTTPException(404, "Employee not found")

    # Update basic fields
    for field in ["designation", "department", "location", "contact_number", "emergency_contact", "notes", "employment_type"]:
        if field in data: setattr(emp, field, data[field])

    if "dob" in data and data["dob"]:
        emp.dob = datetime.strptime(data["dob"], "%Y-%m-%d").date()
    
    if "pf_included" in data: emp.pf_included = data["pf_included"]
    if "mediclaim_included" in data: emp.mediclaim_included = data["mediclaim_included"]
    if "current_address" in data: emp.current_address = data["current_address"]
    if "permanent_address" in data: emp.permanent_address = data["permanent_address"]
    if "education_details" in data: emp.education_details = data["education_details"]
    if "status" in data: emp.status = EmployeeStatus(data["status"])
    if "join_date" in data and data["join_date"]:
        emp.join_date = datetime.strptime(data["join_date"], "%Y-%m-%d").date()

    if "asset_checklist" in data:
        existing_res = await db.execute(select(AssetChecklist).where(AssetChecklist.employee_id == emp.id))
        existing_rows = {row.id: row for row in existing_res.scalars()}
        for item in data["asset_checklist"] or []:
            row = existing_rows.get(item.get("id"))
            if not row:
                continue
            if "category" in item:
                row.category = item["category"]
            if "item_name" in item:
                row.item_name = item["item_name"]
            if "issued" in item:
                row.issued = item["issued"]
            if "returned" in item:
                row.returned = item["returned"]
            if "condition" in item:
                row.condition = item["condition"]

    await db.commit()
    return success(message="Profile updated successfully")


@router.post("/employees/{id}/skills")
async def add_employee_skill(
    id: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp_res = await db.execute(select(Employee).where(Employee.id == id, Employee.org_id == current_user.org_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    skill_id = int(data["skill_id"])
    existing_res = await db.execute(
        select(EmployeeSkill).where(EmployeeSkill.employee_id == id, EmployeeSkill.skill_id == skill_id)
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        existing.level = SkillLevel(data.get("level", existing.level.value))
        existing.verified_by = SkillValidatedBy(data.get("verified_by", existing.verified_by.value))
        existing.last_verified_at = datetime.now()
    else:
        db.add(EmployeeSkill(
            employee_id=id,
            skill_id=skill_id,
            level=SkillLevel(data.get("level", "beginner")),
            verified_by=SkillValidatedBy(data.get("verified_by", "self_reported")),
            last_verified_at=datetime.now(),
        ))
    await db.commit()
    return success(message="Skill updated")


@router.delete("/employees/{id}/skills/{skill_id}")
async def remove_employee_skill(
    id: int,
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp_res = await db.execute(select(Employee).where(Employee.id == id, Employee.org_id == current_user.org_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    row_res = await db.execute(
        select(EmployeeSkill).where(EmployeeSkill.employee_id == id, EmployeeSkill.skill_id == skill_id)
    )
    row = row_res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Skill mapping not found")

    await db.delete(row)
    await db.commit()
    return success(message="Skill removed")

@router.post("/employees/{employee_id}/offboard")
async def offboard_employee(
    employee_id: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["org_admin", "hr"]))
):
    """Marks an employee as exited and records details."""
    try:
        result = await db.execute(
            select(Employee).where(Employee.id == employee_id, Employee.org_id == current_user.org_id)
        )
        emp = result.scalar_one_or_none()
        if not emp:
            raise HTTPException(404, "Employee record not found in your organisation")

        # Update Status
        logger.info(f"🚀 Initiating offboarding for Employee ID: {employee_id}")
        emp.status = EmployeeStatus.offboarded

        
        exit_date_str = data.get("exit_date")
        if exit_date_str:
            try:
                emp.exit_date = datetime.strptime(exit_date_str, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
        else:
            emp.exit_date = date.today()

        emp.exit_reason = data.get("reason", "Not specified")
        emp.clearance_status = "Pending"

        # Trigger notification to the admin/manager who initiated
        await create_notification(
            db, current_user.id, "Offboarding Initiated", 
            f"Offboarding process started for {emp.emp_id or 'Employee'}. Checklist activated.",
            NotificationType.success
        )

        await db.commit()
        return success(message="Employee offboarded successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during offboarding: {str(e)}")
        raise HTTPException(500, detail=f"Internal server error during offboarding: {str(e)}")

@router.get("/departments")
async def list_departments(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return success(["HR", "Engineering", "Design", "Marketing", "Sales"])

@router.get("/my-profile")
async def my_profile(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    emp = await _get_employee_for_user(db, current_user.id)
    if not emp: 
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Fetch Skills
    skills_res = await db.execute(
        select(EmployeeSkill, SkillTaxonomy).join(SkillTaxonomy).where(EmployeeSkill.employee_id == emp.id)
    )
    skills = [{
        "skill_id": es.skill_id, "name": st.name, "level": es.level.value,
        "verified_by": es.verified_by.value, "last_verified_at": es.last_verified_at.isoformat() if es.last_verified_at else None,
        "decayed": es.decayed,
    } for es, st in skills_res]

    # Fetch Deployments
    deploy_res = await db.execute(
        select(Deployment).where(Deployment.employee_id == emp.id).order_by(Deployment.start_date.desc())
    )
    deployments = [{
        "id": d.id, "project_name": d.project_name, "client_name": d.client_name,
        "start_date": d.start_date.isoformat() if d.start_date else None,
        "status": d.status.value,
        "created_at": d.created_at.isoformat()
    } for d in deploy_res.scalars()]

    # Fetch Leave Balance
    lb_res = await db.execute(select(LeaveBalance).where(LeaveBalance.employee_id == emp.id, LeaveBalance.year == date.today().year))
    lb = lb_res.scalar_one_or_none()

    # Fetch Attendance Summary (Current Month)
    start_of_month = date.today().replace(day=1)
    att_res = await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date >= start_of_month))
    att_list = att_res.scalars().all()
    att_summary = {
        "present": len([a for a in att_list if a.status == AttendanceStatus.present]),
        "half_day": len([a for a in att_list if a.status == AttendanceStatus.half_day]),
        "absent": len([a for a in att_list if a.status == AttendanceStatus.absent]),
    }

    # Fetch KRA Summary
    kra_res = await db.execute(select(KRAAssessment).where(KRAAssessment.employee_id == emp.id))
    kras = kra_res.scalars().all()
    kra_summary = {
        "completed": len([k for k in kras if k.status == KRAAssessmentStatus.finalized]),
        "total": len(kras)
    }

    # Fetch Capability Index
    capability_index = await _get_capability_score(db, emp.id)

    return success({
        "id": emp.id,
        "emp_id": emp.emp_id,
        "department": emp.department,
        "designation": emp.designation,
        "status": emp.status.value,
        "capability_index": capability_index or 0,
        "user": {
            "full_name": current_user.full_name,
            "email": current_user.email
        },
        "skills": skills,
        "deployments": deployments,
        "leave_balance": {
            "sick": lb.sick_allocated - lb.sick_used if lb else 10,
            "casual": lb.casual_allocated - lb.casual_used if lb else 12,
            "privilege": lb.privilege_allocated - lb.privilege_used if lb else 15,
        },
        "attendance_summary": att_summary,
        "kra_summary": kra_summary,
        "kra_assessments": [{"period": k.period, "year": k.year, "status": k.status.value, "score": float(k.total_score)} for k in kras]
    })

@router.get("/skill-map")
async def skill_map(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(EmployeeSkill, SkillTaxonomy, Employee)
        .join(SkillTaxonomy, EmployeeSkill.skill_id == SkillTaxonomy.id)
        .join(Employee, EmployeeSkill.employee_id == Employee.id)
        .where(Employee.org_id == current_user.org_id)
    )
    if department:
        query = query.where(Employee.department == department)

    res = await db.execute(query)
    rows = {}
    for emp_skill, skill, employee in res:
        item = rows.setdefault(skill.id, {
            "skill_id": skill.id,
            "name": skill.name,
            "category": skill.category or "Uncategorised",
            "beginner": 0,
            "intermediate": 0,
            "advanced": 0,
            "expert": 0,
            "total": 0,
        })
        level = emp_skill.level.value
        item[level] = item.get(level, 0) + 1
        item["total"] += 1
    return success(sorted(rows.values(), key=lambda x: (-x["total"], x["name"].lower())))

@router.post("/project-requirements")
async def create_project(data: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = ProjectRequirement(
        org_id=current_user.org_id,
        title=data["title"],
        client=data.get("client"),
        required_skills=data.get("required_skills") or [],
        headcount=int(data.get("headcount", 1) or 1),
        start_date=datetime.strptime(data["start_date"], "%Y-%m-%d").date() if data.get("start_date") else None,
        created_by=current_user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return success({
        "id": project.id,
        "title": project.title,
        "client": project.client,
        "headcount": project.headcount,
    }, message="Project created")

@router.get("/project-requirements")
async def list_projects(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(ProjectRequirement).where(ProjectRequirement.org_id == current_user.org_id).order_by(ProjectRequirement.id.desc()))
    return success([{
        "id": p.id,
        "title": p.title,
        "client": p.client,
        "required_skills": p.required_skills or [],
        "headcount": p.headcount,
        "start_date": p.start_date.isoformat() if p.start_date else None,
    } for p in res.scalars()])

@router.get("/project-match/{id}")
async def match_project(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    proj_res = await db.execute(select(ProjectRequirement).where(ProjectRequirement.id == id, ProjectRequirement.org_id == current_user.org_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project requirement not found")

    emp_res = await db.execute(select(Employee).where(Employee.org_id == current_user.org_id, Employee.status != EmployeeStatus.exited))
    employees = emp_res.scalars().all()
    matches = []
    for emp in employees:
        user_res = await db.execute(select(User).where(User.id == emp.user_id))
        user = user_res.scalar_one_or_none()
        skills_res = await db.execute(
            select(EmployeeSkill, SkillTaxonomy)
            .join(SkillTaxonomy, EmployeeSkill.skill_id == SkillTaxonomy.id)
            .where(EmployeeSkill.employee_id == emp.id)
        )
        skills = [{
            "id": es.skill_id,
            "name": st.name,
            "level": es.level.value,
        } for es, st in skills_res]
        capability_index = await _get_capability_score(db, emp.id)
        fit_score = capability_index or (40 + min(len(skills) * 8, 50))
        matches.append({
            "employee_id": emp.id,
            "name": user.full_name if user else emp.emp_id or f"EMP-{emp.id}",
            "department": emp.department,
            "designation": emp.designation,
            "fit_score": round(min(fit_score, 100), 2),
            "skills": skills,
        })

    matches.sort(key=lambda x: (-x["fit_score"], x["name"].lower()))
    return success(matches)

@router.post("/assign")
async def assign_project(employeeIds: List[int], project_requirement_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    proj_res = await db.execute(select(ProjectRequirement).where(ProjectRequirement.id == project_requirement_id, ProjectRequirement.org_id == current_user.org_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project requirement not found")

    for employee_id in employeeIds:
        emp_res = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.org_id == current_user.org_id))
        emp = emp_res.scalar_one_or_none()
        if not emp:
            continue
        db.add(Deployment(
            employee_id=emp.id,
            project_name=project.title,
            client_name=project.client,
            start_date=project.start_date or date.today(),
            status=DeploymentStatus.active,
        ))
        emp.status = EmployeeStatus.deployed

    await db.commit()
    return success(message="Assigned successfully")

@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    oid = current_user.org_id
    total_res = await db.execute(select(func.count(Employee.id)).where(Employee.org_id == oid))
    active_res = await db.execute(select(func.count(Employee.id)).where(Employee.org_id == oid, Employee.status == EmployeeStatus.active))
    exited_res = await db.execute(select(func.count(Employee.id)).where(Employee.org_id == oid, Employee.status == EmployeeStatus.exited))
    deploy_res = await db.execute(select(func.count(Deployment.id)).join(Employee).where(Employee.org_id == oid, Deployment.status == DeploymentStatus.active))
    
    # Dept Breakdown
    dept_res = await db.execute(select(Employee.department, func.count(Employee.id)).where(Employee.org_id == oid).group_by(Employee.department))
    dept_breakdown = {d: c for d, c in dept_res if d}

    # Monthly Joins (Current Year)
    year = date.today().year
    joins_res = await db.execute(
        select(func.extract('month', Employee.join_date), func.count(Employee.id))
        .where(Employee.org_id == oid, func.extract('year', Employee.join_date) == year)
        .group_by(func.extract('month', Employee.join_date))
    )
    joins_data = {int(m): c for m, c in joins_res}

    # Pending Leaves
    leaves_res = await db.execute(
        select(func.count(LeaveRequest.id))
        .join(Employee).where(Employee.org_id == oid, LeaveRequest.status == LeaveStatus.pending)
    )

    employees_res = await db.execute(select(Employee.id).where(Employee.org_id == oid))
    employee_ids = [row[0] for row in employees_res.all()]
    avg_capability_index = 0.0
    if employee_ids:
        scores_res = await db.execute(
            select(AIScore.score)
            .where(
                AIScore.entity_type == EntityType.employee,
                AIScore.score_type == ScoreType.capability_index,
                AIScore.entity_id.in_(employee_ids),
            )
        )
        scores = [float(row[0]) for row in scores_res.all() if row[0] is not None]
        avg_capability_index = round(sum(scores) / len(scores), 2) if scores else 0.0

    today = date.today()
    att_today_res = await db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .join(Employee, Attendance.employee_id == Employee.id)
        .where(Employee.org_id == oid, Attendance.date == today)
        .group_by(Attendance.status)
    )
    attendance_today = {"present": 0, "absent": 0, "half_day": 0, "leave": 0}
    for status_value, count in att_today_res:
        attendance_today[status_value.value] = count

    kra_res = await db.execute(
        select(func.avg(KRAAssessment.total_score), func.count(KRAAssessment.id))
        .join(Employee, KRAAssessment.employee_id == Employee.id)
        .where(Employee.org_id == oid, KRAAssessment.status == KRAAssessmentStatus.finalized)
    )
    avg_kra_score, finalized_assessments = kra_res.one()

    return success({
        "total_employees": total_res.scalar(),
        "active_employees": active_res.scalar(),
        "exited_employees": exited_res.scalar(),
        "active_deployments": deploy_res.scalar() or 0,
        "avg_capability_index": avg_capability_index,
        "department_breakdown": dept_breakdown,
        "monthly_joins": joins_data,
        "pending_leaves": leaves_res.scalar() or 0,
        "attendance_today": attendance_today,
        "avg_kra_score": float(avg_kra_score) if avg_kra_score is not None else 0.0,
        "finalized_assessments": finalized_assessments or 0,
    })


@router.get("/analytics/detailed")
async def get_analytics_detailed(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    oid = current_user.org_id
    status_res = await db.execute(
        select(Employee.status, func.count(Employee.id))
        .where(Employee.org_id == oid)
        .group_by(Employee.status)
    )
    status_distribution = {status.value: count for status, count in status_res}

    dept_res = await db.execute(
        select(Employee.department, func.count(Employee.id))
        .where(Employee.org_id == oid)
        .group_by(Employee.department)
        .order_by(func.count(Employee.id).desc())
    )
    department_distribution = [
        {"department": dept or "Unassigned", "count": count}
        for dept, count in dept_res
    ]

    skill_res = await db.execute(
        select(SkillTaxonomy.name, func.count(EmployeeSkill.id))
        .join(EmployeeSkill, EmployeeSkill.skill_id == SkillTaxonomy.id)
        .join(Employee, EmployeeSkill.employee_id == Employee.id)
        .where(Employee.org_id == oid)
        .group_by(SkillTaxonomy.name)
        .order_by(func.count(EmployeeSkill.id).desc())
    )
    top_skills = [{"skill": name, "count": count} for name, count in skill_res.all()[:10]]

    total_emp_res = await db.execute(select(func.count(Employee.id)).where(Employee.org_id == oid))
    total_employees = total_emp_res.scalar() or 0
    enroll_res = await db.execute(
        select(func.count(Enrollment.id), func.count(func.distinct(Enrollment.user_id)))
        .join(User, Enrollment.user_id == User.id)
        .where(User.org_id == oid)
    )
    total_enrollments, enrolled_employees = enroll_res.one()
    comp_res = await db.execute(
        select(func.count(Enrollment.id))
        .join(User, Enrollment.user_id == User.id)
        .where(User.org_id == oid, Enrollment.completed_at.is_not(None))
    )
    cert_res = await db.execute(
        select(func.count(Certificate.id))
        .join(User, Certificate.user_id == User.id)
        .where(User.org_id == oid)
    )
    total_completions = comp_res.scalar() or 0
    total_certificates = cert_res.scalar() or 0

    return success({
        "status_distribution": status_distribution,
        "department_distribution": department_distribution,
        "top_skills": top_skills,
        "learning": {
            "total_employees": total_employees,
            "total_enrollments": total_enrollments or 0,
            "employees_enrolled": enrolled_employees or 0,
            "total_completions": total_completions,
            "total_certificates": total_certificates,
            "completion_rate": round((total_completions / (total_enrollments or 1)) * 100, 2) if total_enrollments else 0,
        },
    })

# ── KRA & Performance ──────────────────────────────────────────────────────────

@router.get("/kra/library")
async def list_kra_library(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(KRALibrary).where(KRALibrary.org_id == current_user.org_id))
    return success([{
        "id": k.id, "name": k.name, "description": k.description
    } for k in res.scalars()])

@router.post("/kra/library")
async def create_kra_metric(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_kra = KRALibrary(org_id=current_user.org_id, name=data["name"], description=data.get("description"))
    db.add(new_kra)
    await db.commit()
    return success(message="KRA metric created")

@router.post("/kra/assessments/request")
async def request_review(
    employee_id: int,
    year: int,
    period: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manager requests an employee to fill their self-assessment."""
    # Check if already exists
    existing = await db.execute(select(KRAAssessment).where(KRAAssessment.employee_id == employee_id, KRAAssessment.year == year, KRAAssessment.period == period))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Review already initiated for this period")

    assessment = KRAAssessment(employee_id=employee_id, year=year, period=period, status=KRAAssessmentStatus.draft)
    db.add(assessment)
    await db.flush()
    
    # Add all KRA library items as assessment items
    metrics = await db.execute(select(KRALibrary).where(KRALibrary.org_id == current_user.org_id))
    for m in metrics.scalars():
        db.add(KRAAssessmentItem(assessment_id=assessment.id, kra_id=m.id))
        
    await db.commit()
    return success(message="Assessment requested")

@router.get("/kra/assessments")
async def list_assessments(
    employee_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(KRAAssessment)
    if employee_id:
        query = query.where(KRAAssessment.employee_id == employee_id)
    elif current_user.role == UserRole.employee:
        res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = res.scalar_one_or_none()
        if emp: query = query.where(KRAAssessment.employee_id == emp.id)
        
    result = await db.execute(query.order_by(KRAAssessment.year.desc()))
    return success([{
        "id": a.id, "year": a.year, "period": a.period, "status": a.status.value, "score": float(a.total_score)
    } for a in result.scalars()])

# ── Training ──────────────────────────────────────────────────────────────────

@router.get("/training/programs")
async def list_training_programs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(TrainingProgram).where(TrainingProgram.org_id == current_user.org_id))
    return success([{
        "id": p.id, "name": p.name, "description": p.description, "duration": p.duration_days
    } for p in res.scalars()])

@router.post("/training/programs")
async def create_training_program(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_p = TrainingProgram(org_id=current_user.org_id, name=data["name"], description=data.get("description"), duration_days=data.get("duration_days", 1))
    db.add(new_p)
    await db.commit()
    return success(message="Training program created")

@router.post("/training/assign")
async def assign_training(
    employee_ids: List[int],
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    for eid in employee_ids:
        db.add(TrainingAssignment(employee_id=eid, program_id=program_id, status=TrainingStatus.assigned))
        
        # Notify employee
        # Note: Need to fetch user_id for employee. Just logic for now.
        pass

    await db.commit()
    return success(message="Training assigned to employees")

# ── Payroll ───────────────────────────────────────────────────────────────────

@router.get("/employees/{id}/payroll")
async def list_payroll(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp_res = await db.execute(select(Employee).where(Employee.id == id, Employee.org_id == current_user.org_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "Employee not found")
        
    payroll_res = await db.execute(select(PayrollSlip).where(PayrollSlip.employee_id == emp.id).order_by(PayrollSlip.created_at.desc()))
    records = payroll_res.scalars().all()
    
    return success([{
        "id": p.id,
        "month_year": p.month_year,
        "basic_salary": float(p.basic_salary) if p.basic_salary else 0,
        "hra": float(p.hra) if p.hra else 0,
        "other_allowances": float(p.other_allowances) if p.other_allowances else 0,
        "deductions_tax": float(p.deductions_tax) if p.deductions_tax else 0,
        "deductions_pf": float(p.deductions_pf) if p.deductions_pf else 0,
        "net_payable": float(p.net_payable) if p.net_payable else 0,
        "status": p.status.value,
        "payslip_url": _normalize_path(p.payslip_url),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in records])


@router.post("/employees/{id}/payroll")
async def create_payroll(
    id: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.value not in ["org_admin", "hr", "super_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    emp_res = await db.execute(select(Employee).where(Employee.id == id, Employee.org_id == current_user.org_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "Employee not found")
        
    basic = float(data.get("basic_salary", 0))
    hra = float(data.get("hra", 0))
    other = float(data.get("other_allowances", 0))
    tax = float(data.get("deductions_tax", 0))
    pf = float(data.get("deductions_pf", 0))
    
    net = basic + hra + other - tax - pf
    
    new_slip = PayrollSlip(
        employee_id=emp.id,
        month_year=data.get("month_year", datetime.now().strftime("%B %Y")),
        basic_salary=basic,
        hra=hra,
        other_allowances=other,
        deductions_tax=tax,
        deductions_pf=pf,
        net_payable=net,
        status=PayrollStatus.released
    )
    
    db.add(new_slip)
    await db.commit()
    
    from app.routers.notifications import create_notification
    await create_notification(
        db, emp.user_id, "Payslip Released", 
        f"Your payslip for {new_slip.month_year} has been released. Net Payable: ${net:.2f}",
        NotificationType.success
    )
    
    return success(message="Payslip generated successfully")
