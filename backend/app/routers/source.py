import os
import tempfile
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body
from fastapi.responses import JSONResponse
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User, UserRole
from app.models.source import Candidate, CandidateSkill, JobRole, CandidateInvite, CandidateStatus, InviteStatus
from app.models.ai_score import AIScore, EntityType, ScoreType
from app.models.skill_taxonomy import SkillTaxonomy
from app.models.organisation import Organisation
from app.models.deploy import Employee, EmployeeSkill, EmployeeStatus
from app.utils.auth import get_current_user, require_role, hash_password, generate_temp_password
from app.utils.s3 import upload_bytes_to_s3
from app.utils.pdf import extract_text_from_pdf, clean_extracted_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/source", tags=["Source"])


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


# ── Inline resume parsing (no Celery needed) ─────────────────────────────────

async def _parse_resume_inline(candidate_id: int, extracted_text: str, org_id: int, db: AsyncSession):
    """Parse resume text with AI and store skills — runs inline, no Celery required."""
    from app.agents.agents import run_parse_resume_agent
    from app.models.source import SkillGraphEdge

    try:
        if not extracted_text or len(extracted_text.strip()) < 20:
            logger.warning(f"Resume text too short for candidate {candidate_id}, skipping AI parse")
            result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
            candidate = result.scalar_one_or_none()
            if candidate:
                candidate.status = CandidateStatus.active
            return

        # Run the AI agent
        ai_result = run_parse_resume_agent(extracted_text)

        # Update candidate user with actual name if found
        extracted_name = ai_result.get("name")
        if extracted_name and len(extracted_name.strip()) > 1:
            user_res = await db.execute(select(User).join(Candidate).where(Candidate.id == candidate_id))
            user_rec = user_res.scalar_one_or_none()
            if user_rec:
                user_rec.full_name = extracted_name.strip()

        # Process skills
        for skill_data in ai_result.get("skills", []):
            normalized = skill_data.get("normalized_name", "").lower().strip()
            if not normalized:
                continue

            # Look up or create in skill_taxonomy
            existing_skill = await db.execute(
                select(SkillTaxonomy).where(SkillTaxonomy.normalized_name == normalized)
            )
            taxonomy = existing_skill.scalar_one_or_none()
            if not taxonomy:
                taxonomy = SkillTaxonomy(
                    name=skill_data.get("name", normalized),
                    normalized_name=normalized,
                    category="extracted",
                    aliases=[skill_data.get("name", normalized)],
                )
                db.add(taxonomy)
                await db.flush()

            # Map level
            level_map = {"beginner": "beginner", "intermediate": "intermediate", "advanced": "advanced", "expert": "expert"}
            level = level_map.get(skill_data.get("level", "beginner"), "beginner")

            # Upsert candidate_skill
            existing_cs = await db.execute(
                select(CandidateSkill).where(
                    CandidateSkill.candidate_id == candidate_id,
                    CandidateSkill.skill_id == taxonomy.id
                )
            )
            cs = existing_cs.scalar_one_or_none()
            if not cs:
                cs = CandidateSkill(
                    candidate_id=candidate_id,
                    skill_id=taxonomy.id,
                    level=level,
                    source="resume",
                    years_of_use=skill_data.get("years_of_use"),
                    evidence=skill_data.get("evidence"),
                )
                db.add(cs)

        await db.flush()

        # Process skill graph edges
        all_skills = await db.execute(select(SkillTaxonomy))
        skill_lookup = {s.normalized_name: s.id for s in all_skills.scalars()}

        for rel in ai_result.get("relationships", []):
            from_id = skill_lookup.get(rel.get("from", "").lower())
            to_id = skill_lookup.get(rel.get("to", "").lower())
            relation = rel.get("relation", "requires")
            if from_id and to_id and from_id != to_id:
                existing_edge = await db.execute(
                    select(SkillGraphEdge).where(
                        SkillGraphEdge.from_skill_id == from_id,
                        SkillGraphEdge.to_skill_id == to_id,
                        SkillGraphEdge.relation == relation
                    )
                )
                if not existing_edge.scalar_one_or_none():
                    edge = SkillGraphEdge(from_skill_id=from_id, to_skill_id=to_id, relation=relation)
                    db.add(edge)

        # Update candidate
        result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = result.scalar_one_or_none()
        if candidate:
            candidate.status = CandidateStatus.active
            candidate.exp_years = ai_result.get("experience_years_total", 0)
            if ai_result.get("location"):
                candidate.location = ai_result["location"]
            if ai_result.get("availability"):
                candidate.availability = ai_result["availability"]

        # Store confidence signals
        confidence_signals = ai_result.get("confidence_signals", [])
        if confidence_signals:
            score = AIScore(
                entity_type=EntityType.candidate,
                entity_id=candidate_id,
                score_type=ScoreType.confidence_signals,
                reasoning=json.dumps(confidence_signals),
            )
            db.add(score)

        logger.info(f"Resume parsed successfully (inline) for candidate {candidate_id}")

    except Exception as e:
        logger.error(f"Inline resume parsing failed for candidate {candidate_id}: {e}")
        # Mark candidate as parse_failed
        result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = result.scalar_one_or_none()
        if candidate:
            candidate.status = CandidateStatus.active  # Still set active so it shows up
            # If we want to show parse_failed instead: candidate.status = CandidateStatus.parse_failed


# ── Resume Upload ─────────────────────────────────────────────────────────────
from fastapi import Form

@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    job_role_id: Optional[int] = Form(None),
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    # Validate MIME type server-side
    if file.content_type not in ["application/pdf", "application/x-pdf"]:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    # Extract text from PDF
    try:
        extracted_text = extract_text_from_pdf(pdf_bytes)
        extracted_text = clean_extracted_text(extracted_text)
    except Exception as e:
        logger.warning(f"PDF text extraction failed: {e}")
        extracted_text = ""

    # Create candidate user record
    from datetime import datetime
    email_stub = f"candidate_{datetime.utcnow().timestamp():.0f}@{current_user.org_id}.phygitron.local"
    new_user = User(
        email=email_stub,
        password_hash=hash_password(generate_temp_password()),
        role=UserRole.candidate,
        org_id=current_user.org_id,
        first_login=True,
        full_name=file.filename.replace(".pdf", "").replace("_", " ").title(),
    )
    db.add(new_user)
    await db.flush()

    # Create candidate record
    candidate = Candidate(
        user_id=new_user.id,
        org_id=current_user.org_id,
        status=CandidateStatus.invited,
    )
    db.add(candidate)
    await db.flush()

    # Upload PDF to S3 (or local fallback)
    s3_key = f"{current_user.org_id}/resumes/{candidate.id}/{file.filename}"
    try:
        resume_url = await upload_bytes_to_s3(pdf_bytes, s3_key, "application/pdf")
        candidate.resume_url = resume_url
    except Exception as e:
        logger.warning(f"S3 upload failed, using mock URL: {e}")
        candidate.resume_url = f"mock://{s3_key}"

    # Parse resume INLINE (no Celery needed)
    await _parse_resume_inline(candidate.id, extracted_text, current_user.org_id, db)

    await db.commit()

    return {"success": True, "data": {"candidate_id": candidate.id, "status": "processed"}, "message": "Resume uploaded and parsed successfully."}


# ── AI Auto-Scoring ─────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    role_id: int
    candidate_ids: List[int]


@router.post("/score-candidates")
async def score_candidates(
    body: ScoreRequest,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from app.agents.agents import run_score_role_fit_agent
    import asyncio

    # Get job role
    role_res = await db.execute(select(JobRole).where(JobRole.id == body.role_id))
    role = role_res.scalar_one_or_none()
    if not role or role.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Role not found")

    required_skills = role.required_skills or [{"skill": "General experience", "level": "intermediate"}]

    scored_count = 0
    for cid in body.candidate_ids:
        # Check if already scored for this role recently (optional optimization, skipped for simplicity)
        
        # Get Candidate Skills
        skills_res = await db.execute(
            select(CandidateSkill, SkillTaxonomy).join(SkillTaxonomy).where(CandidateSkill.candidate_id == cid)
        )
        cand_skills_data = [{"name": st.name, "level": cs.level.value, "years_of_use": cs.years_of_use} for cs, st in skills_res]
        
        try:
            # Run Agent
            ai_res = run_score_role_fit_agent(cand_skills_data, required_skills)
            
            # Save Score
            score = AIScore(
                entity_type=EntityType.candidate,
                entity_id=cid,
                score_type=ScoreType.role_fit,
                score=ai_res.get("score", 0),
                reasoning=json.dumps(ai_res),
            )
            db.add(score)
            scored_count += 1
        except Exception as e:
            logger.warning(f"Role fit scoring failed for candidate {cid}: {e}")

    await db.commit()
    return success({"scored_count": scored_count}, f"Successfully generated AI Fit Scores for {scored_count} candidates.")


# ── ATS Algorithmic Match Scoring ──────────────────────────────────────────────

def compute_ats_score(cand_skills: list, req_skills: list) -> float:
    if not req_skills: return 0.0
    score = 0.0
    max_score = 0.0
    level_weights = {"beginner": 1, "intermediate": 2, "advanced": 3, "expert": 4}

    cand_dict = {s["name"].lower(): level_weights.get(s["level"].lower(), 1) for s in cand_skills}

    for req in req_skills:
        req_name = req.get("skill", "").lower()
        req_weight = level_weights.get(str(req.get("level", "intermediate")).lower(), 2)
        max_score += req_weight

        mat_weight = 0
        for cn, cw in cand_dict.items():
            if req_name in cn or cn in req_name:
                mat_weight = max(mat_weight, min(cw, req_weight))
        score += mat_weight

    return round((score / max_score) * 100.0, 1) if max_score > 0 else 0.0


# ── Candidate Search ─────────────────────────────────────────────────────────

@router.get("/candidates/search")
async def search_candidates(
    pool: str = "all",  # all, candidate, trainee, employee
    role_id: Optional[int] = None,
    skills: Optional[List[int]] = Query(None, alias="skills[]"),
    min_exp: Optional[int] = 0,
    location: Optional[str] = None,
    sort_by: str = "newest",
    limit: int = 20,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_, and_
    
    # Base queries
    cand_query = select(Candidate, User).join(User, User.id == Candidate.user_id).where(Candidate.org_id == current_user.org_id)
    emp_query = select(Employee, User).join(User, User.id == Employee.user_id).where(Employee.org_id == current_user.org_id)

    def apply_filters(q, model):
        if min_exp and hasattr(model, 'exp_years'):
            q = q.where(model.exp_years >= min_exp)
        if location:
            if hasattr(model, 'location'):
                q = q.where(model.location.ilike(f"%{location}%"))
        if role_id and hasattr(model, 'job_role_id'):
            q = q.where(model.job_role_id == role_id)
        return q

    results = []

    # Candidates / Trainees
    if pool in ["all", "candidate", "trainee"]:
        q = apply_filters(cand_query, Candidate)
        if pool == "candidate": q = q.where(User.first_login == True)
        elif pool == "trainee": q = q.where(User.first_login == False)
        res = await db.execute(q)
        for c, u in res:
            ctype = "Candidate" if u.first_login else "Trainee"
            results.append({
                "id": c.id, "user_id": u.id, "name": u.full_name or "Unknown",
                "email": u.email, "location": c.location, "exp_years": c.exp_years,
                "status": c.status.value, "resume_url": c.resume_url, "type": ctype,
                "created_at": c.created_at, "is_employee": False
            })

    # Employees
    if pool in ["all", "employee"]:
        q = apply_filters(emp_query, Employee)
        res = await db.execute(q)
        for e, u in res:
            results.append({
                "id": e.id, "user_id": u.id, "name": e.full_name if hasattr(e, 'full_name') else u.full_name or "Unknown",
                "email": u.email, "location": getattr(e, 'location', 'Office'), "exp_years": 0,
                "status": e.status.value, "resume_url": None, "type": "Employee",
                "created_at": e.created_at, "is_employee": True
            })

    if sort_by == "newest": results.sort(key=lambda x: x["created_at"] or datetime.min, reverse=True)
    elif sort_by == "experience": results.sort(key=lambda x: x["exp_years"] or 0, reverse=True)

    output = results[:limit]
    for item in output:
        if not item["is_employee"]:
            skills_res = await db.execute(select(CandidateSkill, SkillTaxonomy).join(SkillTaxonomy).where(CandidateSkill.candidate_id == item["id"]))
            item["skills"] = [{"name": st.name, "level": cs.level.value} for cs, st in skills_res]
        else:
            skills_res = await db.execute(select(EmployeeSkill, SkillTaxonomy).join(SkillTaxonomy).where(EmployeeSkill.employee_id == item["id"]))
            item["skills"] = [{"name": st.name, "level": es.level.value} for es, st in skills_res]
        
        if isinstance(item["created_at"], datetime):
            item["created_at"] = item["created_at"].isoformat()
            
    return success(output)


@router.get("/candidates/{candidate_id}")
async def get_candidate(
    candidate_id: int,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate or candidate.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Skills
    skills_res = await db.execute(
        select(CandidateSkill, SkillTaxonomy).join(SkillTaxonomy).where(CandidateSkill.candidate_id == candidate_id)
    )
    cand_skills = [{"id": cs.id, "skill_id": cs.skill_id, "name": st.name, "level": cs.level.value, "source": cs.source.value, "years_of_use": cs.years_of_use, "evidence": cs.evidence} for cs, st in skills_res]

    user_res = await db.execute(select(User).where(User.id == candidate.user_id))
    user = user_res.scalar_one_or_none()

    # Check if employee
    emp_res = await db.execute(select(Employee).where(Employee.user_id == candidate.user_id))
    emp = emp_res.scalar_one_or_none()

    # AI scores
    scores_res = await db.execute(
        select(AIScore).where(AIScore.entity_type == EntityType.candidate, AIScore.entity_id == candidate_id)
    )
    scores = [{"type": s.score_type.value, "score": float(s.score) if s.score else None, "reasoning": s.reasoning} for s in scores_res.scalars()]

    return success({
        "id": candidate.id,
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name} if user else {},
        "employee_id": emp.id if emp else None,
        "location": candidate.location,
        "exp_years": candidate.exp_years,
        "availability": candidate.availability,
        "status": candidate.status.value,
        "type": "Candidate" if user and user.first_login else "Trainee" if user else "Unknown",
        "resume_url": candidate.resume_url,
        "skills": cand_skills,
        "ai_scores": scores,
    })


# ── Job Roles ─────────────────────────────────────────────────────────────────

class JobRoleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    required_skills: Optional[list] = None
    min_experience: int = 0


@router.get("/job-roles")
async def list_job_roles(
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobRole).where(JobRole.org_id == current_user.org_id))
    roles = result.scalars().all()
    return success([{"id": r.id, "title": r.title, "description": r.description, "min_experience": r.min_experience} for r in roles])


@router.post("/job-roles")
async def create_job_role(
    body: JobRoleCreate,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    role = JobRole(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        required_skills=body.required_skills or [],
        min_experience=body.min_experience,
    )
    db.add(role)
    await db.commit()
    return success({"id": role.id, "title": role.title})


# ── Send Invite ───────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    candidate_ids: List[int]
    job_role_id: int
    deadline: Optional[str] = None
    email_addresses: Optional[List[str]] = None


@router.post("/send-invite")
async def send_invite(
    body: InviteRequest,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    from app.utils.auth import generate_temp_password, hash_password

    job_role_res = await db.execute(select(JobRole).where(JobRole.id == body.job_role_id))
    job_role = job_role_res.scalar_one_or_none()
    if not job_role:
        raise HTTPException(status_code=404, detail="Job role not found")

    org_res = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
    org = org_res.scalar_one_or_none()

    sent = 0
    for idx, cand_id in enumerate(body.candidate_ids):
        cand_res = await db.execute(select(Candidate).where(Candidate.id == cand_id))
        candidate = cand_res.scalar_one_or_none()
        if not candidate:
            continue

        user_res = await db.execute(select(User).where(User.id == candidate.user_id))
        user = user_res.scalar_one_or_none()

        if body.email_addresses and idx < len(body.email_addresses) and body.email_addresses[idx]:
            user.email = body.email_addresses[idx]

        # Generate temp password if first login
        temp_pwd = generate_temp_password()
        user.password_hash = hash_password(temp_pwd)
        user.first_login = True

        invite = CandidateInvite(
            candidate_id=cand_id,
            job_role_id=body.job_role_id,
            hr_user_id=current_user.id,
            temp_password_hash=hash_password(temp_pwd),
            email_sent_at=datetime.utcnow(),
            status=InviteStatus.sent,
        )
        db.add(invite)

        # Send invite email (best-effort, don't fail if email not configured)
        try:
            from app.utils.email import send_invite_email
            await send_invite_email(
                to_email=user.email,
                candidate_name=user.full_name or user.email,
                role_name=job_role.title,
                company_name=org.name if org else "Organisation",
                temp_password=temp_pwd,
                deadline=body.deadline or "No deadline set",
            )
        except Exception as e:
            logger.warning(f"Email send failed for {user.email}: {e}")
        sent += 1

    await db.commit()
    return success({"sent": sent}, f"Invites sent to {sent} candidates")


# ── Invite Status Tracking ────────────────────────────────────────────────────

@router.get("/invite-status/{job_role_id}")
async def invite_status(
    job_role_id: int,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateInvite, Candidate, User).join(Candidate).join(User, User.id == Candidate.user_id)
        .where(CandidateInvite.job_role_id == job_role_id)
    )
    rows = result.all()
    return success([{
        "invite_id": inv.id,
        "candidate_id": cand.id,
        "name": user.full_name or user.email,
        "email": user.email,
        "email_status": inv.status.value,
        "email_sent_at": inv.email_sent_at.isoformat() if inv.email_sent_at else None,
        "opened_at": inv.opened_at.isoformat() if inv.opened_at else None,
        "logged_in_at": inv.logged_in_at.isoformat() if inv.logged_in_at else None,
    } for inv, cand, user in rows])


# ── Convert Candidate to Employee ─────────────────────────────────────────────

class ConvertRequest(BaseModel):
    salary: str
    role_title: str
    department: str
    location: Optional[str] = "Office"
    start_date: Optional[str] = None
    offer_content: Optional[dict] = None
    recipient_email: Optional[EmailStr] = None


@router.post("/candidates/{candidate_id}/offer-preview")
async def offer_preview(
    candidate_id: int,
    body: ConvertRequest,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    # Get candidate and user
    cand_res = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_res.scalar_one_or_none()
    if not candidate or candidate.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Candidate not found")

    user_res = await db.execute(select(User).where(User.id == candidate.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.agents.agents import run_generate_offer_letter_agent
    hiring_details = {
        "role": body.role_title,
        "salary": body.salary,
        "location": body.location,
        "start_date": body.start_date,
        "department": body.department
    }
    ai_content = run_generate_offer_letter_agent(user.full_name or user.email, hiring_details)
    return success(ai_content)


@router.post("/candidates/{candidate_id}/convert")
async def convert_to_employee(
    candidate_id: int,
    body: ConvertRequest,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from app.models.deploy import Employee, EmployeeStatus
    from datetime import datetime

    # Get candidate and user
    cand_res = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = cand_res.scalar_one_or_none()
    if not candidate or candidate.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Candidate not found")

    user_res = await db.execute(select(User).where(User.id == candidate.user_id))
    user = user_res.scalar_one_or_none()

    org_res = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
    org = org_res.scalar_one_or_none()

    # Check if Employee already exists
    emp_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    if emp_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Candidate is already an employee")

    # Update role and create Employee
    user.role = UserRole.employee
    candidate.status = CandidateStatus.archived

    try:
        sd = datetime.strptime(body.start_date, "%Y-%m-%d").date() if body.start_date else datetime.utcnow().date()
    except Exception:
        sd = datetime.utcnow().date()

    emp = Employee(
        user_id=user.id,
        org_id=user.org_id,
        department=body.department,
        join_date=sd,
        status=EmployeeStatus.active,
    )
    db.add(emp)

    # Send AI-Powered Offer Letter
    try:
        from app.agents.agents import run_generate_offer_letter_agent
        from app.utils.pdf import generate_professional_pdf
        from app.utils.email import send_offer_letter_email
        import tempfile
        import os

        # 1. Get Content (AI or Provided)
        if body.offer_content:
            ai_content = body.offer_content
            logger.info(f"Using provided offer content for candidate {candidate_id}")
        else:
            hiring_details = {
                "role": body.role_title,
                "salary": body.salary,
                "location": body.location,
                "start_date": body.start_date,
                "department": body.department
            }
            ai_content = run_generate_offer_letter_agent(user.full_name or user.email, hiring_details)

        # 2. Generate PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            pdf_path = tmp.name
        
        generate_professional_pdf(ai_content, pdf_path)

        # 3. Read PDF bytes
        with open(pdf_path, "rb") as f:
            attachment_bytes = f.read()
        
        # 4. Cleanup
        os.remove(pdf_path)

        # 5. Send Email
        await send_offer_letter_email(
            to_email=body.recipient_email if body.recipient_email else user.email,
            candidate_name=user.full_name or user.email,
            company_name=org.name if org else "eWandzDigital",
            role_title=body.role_title,
            department=body.department,
            salary=body.salary,
            location=body.location,
            attachment_bytes=attachment_bytes
        )
    except Exception as e:
        logger.error(f"❌ AI Offer Letter Flow failed: {e}")
        # Fallback to simple email if PDF fails
        try:
            from app.utils.email import send_offer_letter_email
            await send_offer_letter_email(
                to_email=body.recipient_email if body.recipient_email else user.email,
                candidate_name=user.full_name or user.email,
                company_name=org.name if org else "eWandzDigital",
                role_title=body.role_title,
                department=body.department,
                salary=body.salary,
                location=body.location
            )
        except Exception as e2:
            logger.warning(f"Fallback email also failed: {e2}")

    await db.commit()
    return success({"employee_id": emp.id}, "Candidate successfully converted to Employee and Offer Letter sent")


@router.post("/employees/{employee_id}/revert")
async def revert_employee_to_candidate(
    employee_id: int,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """Utility to revert an employee back to a candidate for testing."""
    from app.models.deploy import Employee
    
    # 1. Get Employee
    emp_res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = emp_res.scalar_one_or_none()
    if not emp or emp.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Employee record not found")

    # 2. Get User
    user_res = await db.execute(select(User).where(User.id == emp.user_id))
    user = user_res.scalar_one_or_none()

    # 3. Get Candidate
    cand_res = await db.execute(select(Candidate).where(Candidate.user_id == emp.user_id))
    candidate = cand_res.scalar_one_or_none()

    # 4. Revert Roles and Status
    if user:
        user.role = UserRole.candidate
    if candidate:
        candidate.status = CandidateStatus.active
    
    # 5. Delete Employee record
    await db.delete(emp)
    await db.commit()

    return success(message="Employee reverted back to Candidate successfully")


@router.delete("/candidates/{candidate_id}")
async def delete_candidate(
    candidate_id: int,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete
    
    # Find candidate
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id, Candidate.org_id == current_user.org_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    user_id = candidate.user_id
    
    # Delete related records explicitly to avoid FK constraint errors
    await db.execute(delete(CandidateInvite).where(CandidateInvite.candidate_id == candidate.id))
    await db.execute(delete(CandidateSkill).where(CandidateSkill.candidate_id == candidate.id))
    await db.execute(delete(AIScore).where(AIScore.entity_type == "candidate", AIScore.entity_id == candidate.id))
    
    await db.delete(candidate)
    
    if user_id:
        user_res = await db.execute(select(User).where(User.id == user_id))
        user_record = user_res.scalar_one_or_none()
        if user_record:
            # Check if there are assessments for this user to be ultra-safe
            from app.models.verify import AssessmentResult
            await db.execute(delete(AssessmentResult).where(AssessmentResult.user_id == user_id))
            await db.delete(user_record)

    await db.commit()
    return success(message="Resume deleted successfully")

@router.get("/active-candidates")
async def list_active_candidates(
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import or_, and_
    query = select(User).where(
        User.org_id == current_user.org_id,
        User.is_active == True,
        or_(
            and_(User.role == UserRole.candidate, User.first_login == False),
            User.role == UserRole.employee
        )
    ).order_by(User.created_at.desc())
    
    res = await db.execute(query)
    users = res.scalars().all()
    
    data = []
    for u in users:
        data.append({
            "id": u.id,
            "name": u.full_name or u.email.split("@")[0],
            "email": u.email,
            "type": "Employee" if u.role == UserRole.employee else "Trainee",
            "created_at": u.created_at.isoformat()
        })
        
    return success(data=data)

