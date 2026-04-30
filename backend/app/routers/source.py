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
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    # Get job role
    role_res = await db.execute(select(JobRole).where(JobRole.id == body.role_id))
    role = role_res.scalar_one_or_none()
    if not role or role.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Role not found")

    required_skills = normalise_required_skills(role)

    scored_count = 0
    for cid in body.candidate_ids:
        cand_res = await db.execute(select(Candidate).where(Candidate.id == cid, Candidate.org_id == current_user.org_id))
        candidate = cand_res.scalar_one_or_none()
        if not candidate:
            continue

        skills_res = await db.execute(
            select(CandidateSkill, SkillTaxonomy).join(SkillTaxonomy).where(CandidateSkill.candidate_id == cid)
        )
        cand_skills_data = [{"name": st.name, "level": cs.level.value, "years_of_use": cs.years_of_use} for cs, st in skills_res]

        fit = calculate_role_fit(cand_skills_data, required_skills, candidate.exp_years or 0, role.min_experience or 0)
        reasoning = {
            **fit,
            "role_id": role.id,
            "role_title": role.title,
            "required_skills": required_skills,
            "summary": f"Deterministic match against {role.title} requirements.",
        }

        existing_res = await db.execute(
            select(AIScore).where(
                AIScore.entity_type == EntityType.candidate,
                AIScore.entity_id == cid,
                AIScore.score_type == ScoreType.role_fit,
                AIScore.job_role_id == role.id,
            ).order_by(AIScore.created_at.desc())
        )
        score = existing_res.scalars().first()
        if score:
            score.score = fit["score"]
            score.reasoning = json.dumps(reasoning)
        else:
            db.add(AIScore(
                entity_type=EntityType.candidate,
                entity_id=cid,
                job_role_id=role.id,
                score_type=ScoreType.role_fit,
                score=fit["score"],
                reasoning=json.dumps(reasoning),
            ))
        scored_count += 1

    await db.commit()
    return success({"scored_count": scored_count}, f"Generated role-fit scores for {scored_count} candidates.")


# ── ATS Algorithmic Match Scoring ──────────────────────────────────────────────

LEVEL_WEIGHTS = {"beginner": 1, "intermediate": 2, "advanced": 3, "expert": 4}
NOISE_TOKENS = {"and", "or", "the", "of", "for", "with", "in", "at", "a", "an", "to", "on"}
ROLE_SKILL_PRESETS = {
    "cyber": ["Cyber Security", "Network Security", "SIEM", "Penetration Testing", "Linux", "Python"],
    "security": ["Cyber Security", "Network Security", "SIEM", "Penetration Testing", "Linux", "Python"],
    "ai": ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "NLP"],
    "ml": ["Python", "Machine Learning", "TensorFlow", "PyTorch", "Scikit-learn", "SQL"],
    "data": ["Python", "SQL", "Pandas", "NumPy", "Power BI", "Machine Learning"],
    "frontend": ["JavaScript", "React", "HTML", "CSS", "TypeScript"],
    "backend": ["Python", "FastAPI", "SQL", "API", "Docker"],
}


def _clean_skill_name(value) -> str:
    return str(value or "").strip()


def _normalise_level(value, fallback="intermediate") -> str:
    level = str(value or fallback).lower().strip()
    return level if level in LEVEL_WEIGHTS else fallback


def normalise_required_skills(role: Optional[JobRole]) -> list:
    if not role:
        return []

    normalised = []
    for item in role.required_skills or []:
        if isinstance(item, str):
            name = item
            level = "intermediate"
        elif isinstance(item, dict):
            name = item.get("skill") or item.get("name") or item.get("title") or item.get("normalized_name")
            level = item.get("level") or item.get("min_level") or item.get("required_level") or "intermediate"
        else:
            continue
        name = _clean_skill_name(name)
        if name:
            normalised.append({"skill": name, "level": _normalise_level(level)})

    if normalised:
        return normalised

    haystack = f"{role.title or ''} {role.description or ''}".lower()
    inferred = []
    for keyword, skills in ROLE_SKILL_PRESETS.items():
        if keyword in haystack:
            inferred.extend(skills)

    if not inferred and role.title:
        inferred = [part.strip() for part in role.title.replace("/", " ").replace("-", " ").split() if len(part.strip()) > 2]

    seen = set()
    fallback = []
    for skill in inferred:
        key = skill.lower()
        if key not in seen:
            fallback.append({"skill": skill, "level": "intermediate"})
            seen.add(key)
    return fallback


def _skill_tokens(value: str) -> set:
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in str(value or ""))
    return {token for token in cleaned.split() if token and token not in NOISE_TOKENS}


def _skill_similarity(required: str, candidate: str) -> float:
    req = str(required or "").lower().strip()
    cand = str(candidate or "").lower().strip()
    if not req or not cand:
        return 0.0
    if req == cand:
        return 1.0

    req_tokens = _skill_tokens(req)
    cand_tokens = _skill_tokens(cand)
    if not req_tokens or not cand_tokens:
        return 0.0

    overlap = req_tokens & cand_tokens
    if not overlap:
        return 0.0

    coverage = len(overlap) / len(req_tokens)
    jaccard = len(overlap) / len(req_tokens | cand_tokens)
    if coverage >= 0.75:
        return 0.85
    if jaccard >= 0.5:
        return 0.65
    return 0.45



def calculate_role_fit(cand_skills: list, req_skills: list, exp_years: int = 0, min_exp: int = 0) -> dict:
    if not req_skills:
        return {"score": 0.0, "matched_skills": [], "missing_skills": [], "partial_skills": []}

    total_weight = 0.0
    earned = 0.0
    matched = []
    missing = []
    partial = []
    candidates = [
        {"name": _clean_skill_name(s.get("name")), "level": _normalise_level(s.get("level"), "beginner")}
        for s in cand_skills
        if _clean_skill_name(s.get("name"))
    ]

    for req in req_skills:
        req_name = _clean_skill_name(req.get("skill") or req.get("name"))
        if not req_name:
            continue
        req_level = _normalise_level(req.get("level"))
        req_weight = LEVEL_WEIGHTS[req_level]
        total_weight += req_weight

        best = None
        best_points = 0.0
        best_similarity = 0.0
        for cand in candidates:
            similarity = _skill_similarity(req_name, cand["name"])
            if similarity <= 0:
                continue
            level_ratio = min(LEVEL_WEIGHTS[cand["level"]] / req_weight, 1.0)
            points = req_weight * similarity * level_ratio
            if points > best_points:
                best = cand
                best_points = points
                best_similarity = similarity

        earned += best_points
        if not best:
            missing.append(req_name)
        elif best_similarity >= 0.8 and LEVEL_WEIGHTS[best["level"]] >= req_weight:
            matched.append(req_name)
        else:
            partial.append({
                "skill": req_name,
                "candidate_skill": best["name"],
                "candidate_level": best["level"],
                "required_level": req_level,
            })

    score = (earned / total_weight * 100.0) if total_weight else 0.0
    if min_exp and exp_years < min_exp:
        exp_ratio = max(exp_years, 0) / max(min_exp, 1)
        score *= 0.75 + (0.25 * exp_ratio)

    return {
        "score": round(min(score, 100.0), 1),
        "matched_skills": matched,
        "missing_skills": missing,
        "partial_skills": partial,
    }


def compute_ats_score(cand_skills: list, req_skills: list, exp_years: int = 0, min_exp: int = 0) -> float:
    return calculate_role_fit(cand_skills, req_skills, exp_years, min_exp)["score"]


# ── Candidate Search ─────────────────────────────────────────────────────────

@router.get("/candidates/search")
async def search_candidates(
    pool: str = "all",  # all, candidate, trainee, employee
    role_id: Optional[int] = None,
    skills: Optional[List[int]] = Query(None, alias="skills[]"),
    min_exp: Optional[int] = 0,
    exp_range: Optional[str] = None,
    search: Optional[str] = None,
    location: Optional[str] = None,
    sort_by: str = "newest",
    limit: int = 20,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_, and_
    
    # Base queries
    cand_query = select(Candidate, User).join(User, User.id == Candidate.user_id).where(Candidate.org_id == current_user.org_id)
    emp_query = select(Employee, User).join(User, User.id == Employee.user_id).where(Employee.org_id == current_user.org_id)

    def exp_bounds():
        if exp_range == "fresher":
            return 0, 0
        if exp_range == "1-2":
            return 1, 2
        if exp_range == "2-5":
            return 2, 5
        if exp_range == "5+":
            return 5, None
        return min_exp, None

    min_years, max_years = exp_bounds()

    def apply_filters(q, model):
        if min_years is not None and hasattr(model, 'exp_years'):
            q = q.where(model.exp_years >= min_years)
        if max_years is not None and hasattr(model, 'exp_years'):
            q = q.where(model.exp_years <= max_years)
        if location:
            if hasattr(model, 'location'):
                q = q.where(model.location.ilike(f"%{location}%"))
        if search:
            term = f"%{search.strip()}%"
            q = q.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
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

    # Retrieve required skills if a role is selected
    req_skills = []
    role = None
    if role_id:
        role_res = await db.execute(select(JobRole).where(JobRole.id == role_id))
        role = role_res.scalar_one_or_none()
        if not role or role.org_id != current_user.org_id:
            raise HTTPException(status_code=404, detail="Role not found")
        req_skills = normalise_required_skills(role)

    output = results
    for item in output:
        if not item["is_employee"]:
            skills_res = await db.execute(select(CandidateSkill, SkillTaxonomy).join(SkillTaxonomy).where(CandidateSkill.candidate_id == item["id"]))
            item["skills"] = [{"name": st.name, "level": cs.level.value} for cs, st in skills_res]
        else:
            skills_res = await db.execute(select(EmployeeSkill, SkillTaxonomy).join(SkillTaxonomy).where(EmployeeSkill.employee_id == item["id"]))
            item["skills"] = [{"name": st.name, "level": es.level.value} for es, st in skills_res]
        
        item["fit_reason"] = None
        item["required_skills"] = req_skills

        # Calculate role fit score for the selected role only. Stored AI rows are
        # role-specific history; live search remains deterministic and filter-safe.
        if role_id:
            fit = calculate_role_fit(item["skills"], req_skills, item["exp_years"] or 0, role.min_experience if role else 0)
            item["ats_score"] = fit["score"]
            item["fit_reason"] = fit
        else:
            item["ats_score"] = None
            
        # Calculate Resume ATS Score
        num_skills = len(item["skills"])
        exp = item.get("exp_years") or 0
        loc_points = 10 if item.get("location") else 0
        resume_points = 10 if item.get("resume_url") else 0
        
        skill_points = min(num_skills * 5, 50)
        exp_points = min(exp * 5, 30)
        
        item["resume_ats_score"] = skill_points + exp_points + loc_points + resume_points
            
        # Format date
        if isinstance(item["created_at"], datetime):
            item["created_at"] = item["created_at"].isoformat()

    # Apply sorting
    sort_keys = [s.strip() for s in sort_by.split(",") if s.strip()]
    if "fit_score" in sort_keys and role_id:
        output.sort(key=lambda x: (x.get("ats_score") or 0, x.get("exp_years") or 0, x["created_at"] or ""), reverse=True)
    elif "experience" in sort_keys:
        output.sort(key=lambda x: (x["exp_years"] or 0, x["created_at"] or ""), reverse=True)
    else:
        output.sort(key=lambda x: x["created_at"] or "", reverse=True)

    output = output[:limit]

    return success(output)


@router.get("/candidates/{candidate_id}")
async def get_candidate(
    candidate_id: int,
    role_id: Optional[int] = None,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
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

    import json
    if role_id:
        role_res = await db.execute(select(JobRole).where(JobRole.id == role_id))
        role = role_res.scalar_one_or_none()
        if role:
            req_skills = normalise_required_skills(role)
            fit = calculate_role_fit(cand_skills, req_skills, candidate.exp_years or 0, role.min_experience or 0)
            
            fit_score_obj = {
                "type": "role_fit",
                "score": fit["score"],
                "reasoning": json.dumps({
                    "summary": f"Live fit analysis for {role.title}",
                    "matched_skills": fit["matched_skills"],
                    "missing_skills": fit["missing_skills"],
                    "partial_skills": fit["partial_skills"],
                })
            }
            scores = [s for s in scores if s["type"] != "role_fit"]
            scores.append(fit_score_obj)

    num_skills = len(cand_skills)
    exp = candidate.exp_years or 0
    loc_points = 10 if candidate.location else 0
    resume_points = 10 if candidate.resume_url else 0
    
    skill_points = min(num_skills * 5, 50)
    exp_points = min(exp * 5, 30)
    
    resume_ats_score = skill_points + exp_points + loc_points + resume_points

    return success({
        "id": candidate.id,
        "resume_ats_score": resume_ats_score,
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
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobRole).where(JobRole.org_id == current_user.org_id))
    roles = result.scalars().all()
    return success([{
        "id": r.id,
        "title": r.title,
        "description": r.description,
        "min_experience": r.min_experience,
        "required_skills": normalise_required_skills(r),
    } for r in roles])


@router.post("/job-roles")
async def create_job_role(
    body: JobRoleCreate,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    return success({"id": role.id, "title": role.title, "required_skills": normalise_required_skills(role)})


@router.delete("/job-roles")
async def delete_all_job_roles(
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete

    role_ids_res = await db.execute(select(JobRole.id).where(JobRole.org_id == current_user.org_id))
    role_ids = [row[0] for row in role_ids_res.all()]
    if not role_ids:
        return success({"deleted": 0}, "No job roles to delete")

    await db.execute(delete(CandidateInvite).where(CandidateInvite.job_role_id.in_(role_ids)))
    await db.execute(delete(AIScore).where(AIScore.job_role_id.in_(role_ids)))
    await db.execute(delete(JobRole).where(JobRole.org_id == current_user.org_id))
    await db.commit()
    return success({"deleted": len(role_ids)}, f"Deleted {len(role_ids)} job roles")


@router.delete("/job-roles/{role_id}")
async def delete_job_role(
    role_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete

    role_res = await db.execute(select(JobRole).where(JobRole.id == role_id, JobRole.org_id == current_user.org_id))
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    await db.execute(delete(CandidateInvite).where(CandidateInvite.job_role_id == role.id))
    await db.execute(delete(AIScore).where(AIScore.job_role_id == role.id))
    await db.delete(role)
    await db.commit()
    return success({"deleted": 1}, "Job role deleted")


# ── Send Invite ───────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    candidate_ids: List[int]
    job_role_id: int
    deadline: Optional[str] = None
    email_addresses: Optional[List[str]] = None


@router.post("/send-invite")
async def send_invite(
    body: InviteRequest,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
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
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
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

