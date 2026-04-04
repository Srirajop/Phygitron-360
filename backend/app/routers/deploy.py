import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.deploy import Employee, EmployeeSkill, Deployment, ProjectRequirement, EmployeeStatus, DeploymentStatus
from app.models.skill_taxonomy import SkillTaxonomy
from app.models.ai_score import AIScore, EntityType, ScoreType
from app.models.verify import AssessmentResult
from app.models.forge import Enrollment, Certificate
from app.utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/deploy", tags=["Deploy"])


def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}


# ── Employee List ─────────────────────────────────────────────────────────────

@router.get("/employees")
async def list_employees(
    department: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
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
        cap_res = await db.execute(
            select(AIScore).where(AIScore.entity_type == EntityType.employee, AIScore.entity_id == emp.id, AIScore.score_type == ScoreType.capability_index).limit(1)
        )
        cap_score = cap_res.scalar_one_or_none()
        output.append({
            "id": emp.id,
            "emp_id": emp.emp_id,
            "name": user.full_name if user else "",
            "email": user.email if user else "",
            "department": emp.department,
            "status": emp.status.value,
            "join_date": emp.join_date.isoformat() if emp.join_date else None,
            "skill_count": skills_count.scalar() or 0,
            "capability_index": float(cap_score.score) if cap_score else None,
        })

    return success(output)


@router.get("/employees/{employee_id}")
async def get_employee_profile(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Access control
    if current_user.role.value not in ["hr", "admin", "manager"]:
        my_emp = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        my_emp_rec = my_emp.scalar_one_or_none()
        if not my_emp_rec or my_emp_rec.id != employee_id:
            raise HTTPException(status_code=403, detail="Access denied")

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

    # Deployments
    dep_res = await db.execute(select(Deployment).where(Deployment.employee_id == employee_id).order_by(Deployment.start_date.desc()))
    deployments = [{
        "id": d.id, "project_name": d.project_name, "client_name": d.client_name,
        "start_date": d.start_date.isoformat() if d.start_date else None,
        "end_date": d.end_date.isoformat() if d.end_date else None,
        "status": d.status.value,
    } for d in dep_res.scalars()]

    # Capability index
    cap_res = await db.execute(
        select(AIScore).where(AIScore.entity_type == EntityType.employee, AIScore.entity_id == employee_id, AIScore.score_type == ScoreType.capability_index).limit(1)
    )
    cap_score = cap_res.scalar_one_or_none()

    # Assessment history
    assess_res = await db.execute(
        select(AssessmentResult).where(AssessmentResult.user_id == emp.user_id).order_by(AssessmentResult.submitted_at.desc()).limit(5)
    )
    assessments = [{"score": float(r.score) if r.score else None, "pass_status": r.pass_status, "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None} for r in assess_res.scalars()]

    # Certificates
    certs_res = await db.execute(select(Certificate).where(Certificate.user_id == emp.user_id))
    certs = [{"course_id": c.course_id, "issued_at": c.issued_at.isoformat(), "verification_code": c.verification_code} for c in certs_res.scalars()]

    # Learning progress
    enroll_res = await db.execute(
        select(Enrollment).where(Enrollment.user_id == emp.user_id).order_by(Enrollment.created_at.desc()).limit(5)
    )
    enrollments = [{"course_id": e.course_id, "progress_percent": float(e.progress_percent), "completed": e.completed_at is not None} for e in enroll_res.scalars()]

    return success({
        "id": emp.id, "emp_id": emp.emp_id,
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name} if user else {},
        "department": emp.department, "status": emp.status.value,
        "join_date": emp.join_date.isoformat() if emp.join_date else None,
        "capability_index": float(cap_score.score) if cap_score else None,
        "capability_breakdown": json.loads(cap_score.reasoning) if cap_score and cap_score.reasoning else {},
        "skills": skills,
        "deployments": deployments,
        "assessment_history": assessments,
        "certificates": certs,
        "learning": enrollments,
    })


@router.get("/my-profile")
async def my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return await get_employee_profile(emp.id, current_user, db)


# ── Create Employee Manually ──────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    user_id: int
    emp_id: Optional[str] = None
    department: Optional[str] = None
    join_date: Optional[str] = None
    manager_id: Optional[int] = None


@router.post("/employees")
async def create_employee(
    body: EmployeeCreate,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    existing = await db.execute(select(Employee).where(Employee.user_id == body.user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee record already exists for this user")
    emp = Employee(
        user_id=body.user_id, org_id=current_user.org_id,
        emp_id=body.emp_id, department=body.department,
        manager_id=body.manager_id, status=EmployeeStatus.active,
    )
    if body.join_date:
        emp.join_date = date.fromisoformat(body.join_date)
    db.add(emp)
    await db.commit()
    return success({"id": emp.id}, "Employee created")


# ── Update Employee ───────────────────────────────────────────────────────────

class EmployeeUpdate(BaseModel):
    emp_id: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    join_date: Optional[str] = None
    manager_id: Optional[int] = None


@router.put("/employees/{employee_id}")
async def update_employee(
    employee_id: int, body: EmployeeUpdate,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if body.emp_id is not None: emp.emp_id = body.emp_id
    if body.department is not None: emp.department = body.department
    if body.status is not None: emp.status = body.status
    if body.join_date is not None: emp.join_date = date.fromisoformat(body.join_date)
    if body.manager_id is not None: emp.manager_id = body.manager_id
    await db.commit()
    return success({"id": emp.id}, "Employee updated")


# ── Employee Skills CRUD ──────────────────────────────────────────────────────

class SkillAdd(BaseModel):
    skill_id: int
    level: str = "beginner"
    verified_by: str = "self_reported"


@router.post("/employees/{employee_id}/skills")
async def add_employee_skill(
    employee_id: int, body: SkillAdd,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Employee not found")
    existing = await db.execute(
        select(EmployeeSkill).where(EmployeeSkill.employee_id == employee_id, EmployeeSkill.skill_id == body.skill_id)
    )
    es = existing.scalar_one_or_none()
    if es:
        es.level = body.level
        es.verified_by = body.verified_by
        es.last_verified_at = datetime.utcnow()
    else:
        db.add(EmployeeSkill(
            employee_id=employee_id, skill_id=body.skill_id,
            level=body.level, verified_by=body.verified_by,
            last_verified_at=datetime.utcnow(),
        ))
    await db.commit()
    return success(message="Skill updated")


@router.delete("/employees/{employee_id}/skills/{skill_id}")
async def remove_employee_skill(
    employee_id: int, skill_id: int,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmployeeSkill).where(EmployeeSkill.employee_id == employee_id, EmployeeSkill.skill_id == skill_id)
    )
    es = result.scalar_one_or_none()
    if not es:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(es)
    await db.commit()
    return success(message="Skill removed")


# ── Departments List ──────────────────────────────────────────────────────────

@router.get("/departments")
async def list_departments(
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee.department).where(
            Employee.org_id == current_user.org_id, Employee.department != None
        ).distinct()
    )
    return success(sorted([r for r in result.scalars() if r]))


# ── Org Skill Map ─────────────────────────────────────────────────────────────

@router.get("/skill-map")
async def skill_map(
    department: Optional[str] = None,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    level_map = {"beginner": 1, "intermediate": 2, "advanced": 3, "expert": 4}

    skills_res = await db.execute(select(SkillTaxonomy))
    all_skills = skills_res.scalars().all()

    skill_data = []
    for skill in all_skills:
        counts = {"beginner": 0, "intermediate": 0, "advanced": 0, "expert": 0}
        emp_query = select(EmployeeSkill, Employee).join(Employee).where(
            EmployeeSkill.skill_id == skill.id,
            Employee.org_id == current_user.org_id,
        )
        if department:
            emp_query = emp_query.where(Employee.department == department)

        emp_skills_res = await db.execute(emp_query)
        emp_skills = emp_skills_res.all()

        for es, _ in emp_skills:
            level_key = str(es.level).split(".")[-1]
            if level_key in counts:
                counts[level_key] += 1

        total = sum(counts.values())
        if total > 0:
            skill_data.append({
                "skill_id": skill.id, "name": skill.name, "category": skill.category,
                "total": total, **counts,
            })

    return success(sorted(skill_data, key=lambda x: x["total"], reverse=True))


# ── Project Requirements + AI Matching ───────────────────────────────────────

class ProjectReqCreate(BaseModel):
    title: str
    client: Optional[str] = None
    required_skills: Optional[list] = None
    headcount: int = 1
    start_date: Optional[str] = None


@router.post("/project-requirements")
async def create_project_requirement(
    body: ProjectReqCreate,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    req = ProjectRequirement(
        org_id=current_user.org_id,
        title=body.title,
        client=body.client,
        required_skills=body.required_skills or [],
        headcount=body.headcount,
        start_date=date.fromisoformat(body.start_date) if body.start_date else None,
        created_by=current_user.id,
    )
    db.add(req)
    await db.commit()
    return success({"id": req.id})


@router.get("/project-requirements")
async def list_project_requirements(
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectRequirement).where(ProjectRequirement.org_id == current_user.org_id)
        .order_by(ProjectRequirement.created_at.desc())
    )
    reqs = result.scalars().all()
    return success([{
        "id": r.id, "title": r.title, "client": r.client,
        "headcount": r.headcount, "required_skills": r.required_skills,
        "start_date": r.start_date.isoformat() if r.start_date else None,
    } for r in reqs])


@router.get("/project-match/{requirement_id}")
async def project_match(
    requirement_id: int,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from app.agents.agents import run_match_project_agent

    req_res = await db.execute(select(ProjectRequirement).where(ProjectRequirement.id == requirement_id))
    req = req_res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Project requirement not found")

    emp_res = await db.execute(
        select(Employee).where(Employee.org_id == current_user.org_id, Employee.status == EmployeeStatus.active)
    )
    employees = emp_res.scalars().all()

    employee_profiles = []
    for emp in employees:
        user_res = await db.execute(select(User).where(User.id == emp.user_id))
        user = user_res.scalar_one_or_none()
        skills_res = await db.execute(
            select(EmployeeSkill, SkillTaxonomy).join(SkillTaxonomy).where(EmployeeSkill.employee_id == emp.id)
        )
        skills = [{"skill_id": es.skill_id, "name": st.name, "level": es.level.value} for es, st in skills_res]
        employee_profiles.append({"employee_id": emp.id, "name": user.full_name if user else str(emp.id), "skills": skills})

    try:
        result = run_match_project_agent(
            project_requirements={"required_skills": req.required_skills, "title": req.title},
            employee_profiles=employee_profiles,
        )
        return success(result.get("ranked_employees", []))
    except Exception:
        return success(employee_profiles[:10])


@router.post("/assign")
async def assign_to_project(
    employee_ids: List[int],
    project_requirement_id: int,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    req_res = await db.execute(select(ProjectRequirement).where(ProjectRequirement.id == project_requirement_id))
    req = req_res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Project requirement not found")

    assigned = 0
    for emp_id in employee_ids:
        dep = Deployment(
            employee_id=emp_id,
            project_name=req.title,
            client_name=req.client,
            start_date=req.start_date,
            skills_utilised=req.required_skills,
            status=DeploymentStatus.active,
        )
        db.add(dep)
        emp_res = await db.execute(select(Employee).where(Employee.id == emp_id))
        emp = emp_res.scalar_one_or_none()
        if emp:
            emp.status = EmployeeStatus.deployed
        assigned += 1

    await db.commit()
    return success({"assigned": assigned})


# ── Workforce Analytics ───────────────────────────────────────────────────────

@router.get("/analytics")
async def workforce_analytics(
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    total_employees = await db.execute(
        select(func.count()).select_from(Employee).where(Employee.org_id == current_user.org_id)
    )
    active_deps = await db.execute(
        select(func.count()).select_from(Deployment).join(Employee).where(
            Employee.org_id == current_user.org_id, Deployment.status == DeploymentStatus.active
        )
    )
    avg_cap = await db.execute(
        select(func.avg(AIScore.score)).where(
            AIScore.entity_type == EntityType.employee,
            AIScore.score_type == ScoreType.capability_index
        )
    )

    return success({
        "total_employees": total_employees.scalar() or 0,
        "active_deployments": active_deps.scalar() or 0,
        "avg_capability_index": round(float(avg_cap.scalar() or 0), 2),
    })


# ── Detailed Analytics ────────────────────────────────────────────────────────

@router.get("/analytics/detailed")
async def detailed_analytics(
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    status_res = await db.execute(
        select(Employee.status, func.count()).select_from(Employee)
        .where(Employee.org_id == current_user.org_id).group_by(Employee.status)
    )
    status_dist = {str(row[0]).split(".")[-1]: row[1] for row in status_res}

    dept_res = await db.execute(
        select(Employee.department, func.count()).select_from(Employee)
        .where(Employee.org_id == current_user.org_id, Employee.department != None)
        .group_by(Employee.department).order_by(func.count().desc()).limit(10)
    )
    dept_dist = [{"department": row[0], "count": row[1]} for row in dept_res]

    skill_res = await db.execute(
        select(SkillTaxonomy.name, func.count()).select_from(EmployeeSkill)
        .join(Employee).join(SkillTaxonomy, EmployeeSkill.skill_id == SkillTaxonomy.id)
        .where(Employee.org_id == current_user.org_id)
        .group_by(SkillTaxonomy.name).order_by(func.count().desc()).limit(10)
    )
    top_skills = [{"skill": row[0], "count": row[1]} for row in skill_res]

    total_emp_count = (await db.execute(
        select(func.count()).select_from(Employee).where(Employee.org_id == current_user.org_id)
    )).scalar() or 0

    emp_user_ids = list((await db.execute(
        select(Employee.user_id).where(Employee.org_id == current_user.org_id)
    )).scalars())

    enrolled_count = completed_count = cert_count = 0
    if emp_user_ids:
        enrolled_count = (await db.execute(
            select(func.count()).select_from(Enrollment).where(Enrollment.user_id.in_(emp_user_ids))
        )).scalar() or 0
        completed_count = (await db.execute(
            select(func.count()).select_from(Enrollment).where(
                Enrollment.user_id.in_(emp_user_ids), Enrollment.completed_at != None
            )
        )).scalar() or 0
        cert_count = (await db.execute(
            select(func.count()).select_from(Certificate).where(Certificate.user_id.in_(emp_user_ids))
        )).scalar() or 0

    return success({
        "status_distribution": status_dist,
        "department_distribution": dept_dist,
        "top_skills": top_skills,
        "learning": {
            "total_employees": total_emp_count,
            "total_enrollments": enrolled_count,
            "total_completions": completed_count,
            "total_certificates": cert_count,
            "completion_rate": round((completed_count / enrolled_count * 100) if enrolled_count else 0, 1),
        },
    })
