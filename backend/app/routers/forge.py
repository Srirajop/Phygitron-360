import json
import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.forge import (
    Course, CourseSection, SectionQuiz, Enrollment, LearningProgress,
    Certificate, CourseStatus, EnrollmentTrigger
)
from app.models.skill_taxonomy import SkillTaxonomy
from app.models.verify import AssessmentResult
from app.utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/forge", tags=["Forge"])


def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}


# ── Learner Dashboard ─────────────────────────────────────────────────────────

@router.get("/dashboard")
async def forge_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Enrollments
    enroll_res = await db.execute(
        select(Enrollment, Course).join(Course)
        .where(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.created_at.desc())
    )
    rows = enroll_res.all()

    in_progress = []
    completed = []
    recommended = []

    for enroll, course in rows:
        item = {
            "enrollment_id": enroll.id,
            "course_id": course.id,
            "title": course.title,
            "description": course.description,
            "difficulty": course.difficulty.value,
            "thumbnail_url": course.thumbnail_url,
            "progress_percent": float(enroll.progress_percent),
            "triggered_by": enroll.triggered_by.value,
            "deadline": enroll.deadline.isoformat() if enroll.deadline else None,
        }
        if enroll.completed_at:
            completed.append(item)
        elif enroll.triggered_by == EnrollmentTrigger.ai_gap:
            recommended.append(item)
        else:
            in_progress.append(item)

    return success({
        "in_progress": in_progress,
        "recommended": recommended,
        "completed": completed,
    })


# ── Course Builder ────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    title: str
    order_index: int = 0
    content_type: str = "video"
    content_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    pass_score: float = 50.0
    quizzes: Optional[list] = None


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    skill_ids: Optional[List[int]] = None
    difficulty: str = "beginner"
    estimated_hours: Optional[float] = None
    sections: Optional[List[SectionCreate]] = None


@router.post("/courses")
async def create_course(
    body: CourseCreate,
    current_user: User = Depends(require_role(["instructor", "admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    course = Course(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        skill_ids=body.skill_ids or [],
        difficulty=body.difficulty,
        estimated_hours=body.estimated_hours,
        status=CourseStatus.draft,
        instructor_id=current_user.id,
    )
    db.add(course)
    await db.flush()

    for section_data in (body.sections or []):
        section = CourseSection(
            course_id=course.id,
            title=section_data.title,
            order_index=section_data.order_index,
            content_type=section_data.content_type,
            content_url=section_data.content_url,
            duration_minutes=section_data.duration_minutes,
            pass_score=section_data.pass_score,
        )
        db.add(section)
        await db.flush()

        for q_data in (section_data.quizzes or []):
            quiz = SectionQuiz(
                section_id=section.id,
                question_text=q_data.get("question_text", ""),
                options=q_data.get("options"),
                correct_answer=q_data.get("correct_answer", ""),
                explanation=q_data.get("explanation"),
                marks=q_data.get("marks", 1.0),
            )
            db.add(quiz)

    await db.commit()
    return success({"id": course.id, "title": course.title})


@router.get("/courses")
async def list_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Course).where(
            Course.org_id == current_user.org_id,
            Course.status == CourseStatus.published
        ).order_by(Course.created_at.desc())
    )
    courses = result.scalars().all()
    return success([{
        "id": c.id, "title": c.title, "description": c.description,
        "difficulty": c.difficulty.value, "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
        "thumbnail_url": c.thumbnail_url, "skill_ids": c.skill_ids,
    } for c in courses])


@router.get("/courses/{course_id}")
async def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    sections_res = await db.execute(
        select(CourseSection).where(CourseSection.course_id == course_id).order_by(CourseSection.order_index)
    )
    sections = sections_res.scalars().all()

    section_data = []
    for s in sections:
        quiz_res = await db.execute(select(SectionQuiz).where(SectionQuiz.section_id == s.id))
        quizzes = [{
            "id": q.id, "question_text": q.question_text, "options": q.options,
            "correct_answer": q.correct_answer, "explanation": q.explanation, "marks": float(q.marks),
        } for q in quiz_res.scalars()]
        section_data.append({
            "id": s.id, "title": s.title, "order_index": s.order_index,
            "content_type": s.content_type.value, "content_url": s.content_url,
            "duration_minutes": s.duration_minutes, "quizzes": quizzes,
        })

    # Check enrollment + progress
    enroll_res = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    enrollment = enroll_res.scalar_one_or_none()

    progress_data = {}
    if enrollment:
        prog_res = await db.execute(
            select(LearningProgress).where(LearningProgress.enrollment_id == enrollment.id)
        )
        for p in prog_res.scalars():
            progress_data[p.section_id] = {
                "completed": p.completed, "video_progress_seconds": p.video_progress_seconds,
                "quiz_score": float(p.quiz_score) if p.quiz_score else None,
            }

    return success({
        "id": course.id, "title": course.title, "description": course.description,
        "difficulty": course.difficulty.value, "estimated_hours": float(course.estimated_hours) if course.estimated_hours else None,
        "sections": section_data,
        "enrollment": {"id": enrollment.id, "progress_percent": float(enrollment.progress_percent)} if enrollment else None,
        "progress": progress_data,
    })


@router.post("/courses/{course_id}/publish")
async def publish_course(
    course_id: int,
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Not found")
    course.status = CourseStatus.published
    await db.commit()
    return success(message="Course published")


# ── Enrollment ────────────────────────────────────────────────────────────────

@router.post("/enroll")
async def enroll_in_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    if existing.scalar_one_or_none():
        return success(message="Already enrolled")

    enrollment = Enrollment(
        user_id=current_user.id,
        course_id=course_id,
        triggered_by=EnrollmentTrigger.manual,
    )
    db.add(enrollment)
    await db.commit()
    return success({"enrollment_id": enrollment.id}, "Enrolled successfully")


# ── Inline Certificate Generation ─────────────────────────────────────────────

async def _generate_certificate_inline(enrollment_id: int, user_id: int, db: AsyncSession):
    """Generate a PDF certificate inline — no Celery required."""
    import io
    import logging
    from app.utils.s3 import upload_bytes_to_s3
    from app.models.user import User as UserModel

    logger = logging.getLogger(__name__)

    enrollment_res = await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
    enrollment = enrollment_res.scalar_one_or_none()
    if not enrollment:
        return

    user_res = await db.execute(select(UserModel).where(UserModel.id == enrollment.user_id))
    user = user_res.scalar_one_or_none()

    course_res = await db.execute(select(Course).where(Course.id == enrollment.course_id))
    course = course_res.scalar_one_or_none()

    if not user or not course:
        return

    # Check if certificate already exists
    existing_res = await db.execute(
        select(Certificate).where(Certificate.user_id == user.id, Certificate.course_id == course.id)
    )
    if existing_res.scalar_one_or_none():
        return

    verification_code = secrets.token_hex(8).upper()

    # Generate PDF
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.colors import HexColor
        from reportlab.pdfgen import canvas as pdf_canvas

        buffer = io.BytesIO()
        c = pdf_canvas.Canvas(buffer, pagesize=landscape(A4))
        w, h = landscape(A4)

        purple = HexColor("#7C3AED")
        light_purple = HexColor("#EDE9FE")

        c.setFillColor(light_purple)
        c.rect(0, 0, w, h, fill=1, stroke=0)
        c.setStrokeColor(purple)
        c.setLineWidth(8)
        c.rect(20, 20, w - 40, h - 40, stroke=1, fill=0)
        c.setLineWidth(2)
        c.rect(28, 28, w - 56, h - 56, stroke=1, fill=0)
        c.setFillColor(purple)
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(w / 2, h - 100, "CERTIFICATE OF COMPLETION")
        c.setFont("Helvetica", 18)
        c.setFillColor(HexColor("#6B21A8"))
        c.drawCentredString(w / 2, h - 140, "PHYGITRON 360")
        c.setStrokeColor(purple)
        c.setLineWidth(1.5)
        c.line(100, h - 160, w - 100, h - 160)
        c.setFillColor(HexColor("#374151"))
        c.setFont("Helvetica", 14)
        c.drawCentredString(w / 2, h - 200, "This is to certify that")
        c.setFillColor(HexColor("#1E1B4B"))
        c.setFont("Helvetica-Bold", 32)
        c.drawCentredString(w / 2, h - 245, user.full_name or user.email)
        c.setFillColor(HexColor("#374151"))
        c.setFont("Helvetica", 14)
        c.drawCentredString(w / 2, h - 285, "has successfully completed")
        c.setFillColor(purple)
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(w / 2, h - 330, course.title)
        c.setFillColor(HexColor("#6B7280"))
        c.setFont("Helvetica", 11)
        from app.config import settings
        completion_date = datetime.utcnow().strftime("%B %d, %Y")
        c.drawCentredString(w / 2, 90, f"Issued on: {completion_date}  |  Verification Code: {verification_code}")
        c.drawCentredString(w / 2, 72, f"Verify at: {settings.FRONTEND_URL}/verify-certificate/{verification_code}")
        c.save()
        pdf_bytes = buffer.getvalue()
    except ImportError:
        pdf_bytes = b"%PDF-1.4 certificate placeholder"

    # Upload
    s3_key = f"{course.org_id}/certificates/{user.id}/{course.id}/certificate.pdf"
    try:
        cert_url = await upload_bytes_to_s3(pdf_bytes, s3_key, "application/pdf")
    except Exception:
        cert_url = f"http://localhost:8000/uploads/{s3_key}"

    cert = Certificate(
        user_id=user.id,
        course_id=course.id,
        verification_code=verification_code,
        pdf_url=cert_url,
    )
    db.add(cert)
    logger.info(f"Certificate generated inline for user {user.id}, course {course.id}: {verification_code}")


# ── Section Completion ────────────────────────────────────────────────────────

class SectionCompleteRequest(BaseModel):
    enrollment_id: int
    video_progress_seconds: Optional[int] = None
    quiz_score: Optional[float] = None


@router.post("/sections/{section_id}/complete")
async def complete_section(
    section_id: int,
    body: SectionCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import logging
    logger = logging.getLogger(__name__)

    prog_res = await db.execute(
        select(LearningProgress).where(
            LearningProgress.enrollment_id == body.enrollment_id,
            LearningProgress.section_id == section_id,
        )
    )
    prog = prog_res.scalar_one_or_none()
    if not prog:
        prog = LearningProgress(enrollment_id=body.enrollment_id, section_id=section_id)
        db.add(prog)

    prog.completed = True
    prog.completed_at = datetime.utcnow()
    if body.video_progress_seconds:
        prog.video_progress_seconds = body.video_progress_seconds
    if body.quiz_score is not None:
        prog.quiz_score = body.quiz_score

    # Update enrollment progress %
    enroll_res = await db.execute(select(Enrollment).where(Enrollment.id == body.enrollment_id))
    enrollment = enroll_res.scalar_one_or_none()
    if enrollment:
        total_sections_res = await db.execute(
            select(func.count()).select_from(CourseSection).where(CourseSection.course_id == enrollment.course_id)
        )
        completed_sections_res = await db.execute(
            select(func.count()).select_from(LearningProgress).where(
                LearningProgress.enrollment_id == body.enrollment_id,
                LearningProgress.completed == True
            )
        )
        total = total_sections_res.scalar() or 1
        completed = completed_sections_res.scalar() or 0
        enrollment.progress_percent = round((completed / total) * 100, 2)
        enrollment.last_accessed_at = datetime.utcnow()

        if enrollment.progress_percent >= 100:
            enrollment.completed_at = datetime.utcnow()
            # Generate certificate inline
            try:
                await _generate_certificate_inline(enrollment.id, current_user.id, db)
            except Exception as e:
                logger.warning(f"Certificate generation failed: {e}")

    await db.commit()
    return success({"progress_percent": float(enrollment.progress_percent) if enrollment else 0})


# ── Certificates ──────────────────────────────────────────────────────────────

@router.get("/certificates/{user_id}")
async def get_certificates(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != user_id and current_user.role.value not in ["hr", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Certificate, Course).join(Course).where(Certificate.user_id == user_id)
        .order_by(Certificate.issued_at.desc())
    )
    rows = result.all()
    return success([{
        "id": cert.id, "course_title": course.title,
        "issued_at": cert.issued_at.isoformat(), "verification_code": cert.verification_code,
        "pdf_url": cert.pdf_url,
    } for cert, course in rows])


@router.get("/verify-certificate/{code}")
async def verify_certificate(code: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — no auth required."""
    result = await db.execute(
        select(Certificate, Course, User).join(Course).join(User, User.id == Certificate.user_id)
        .where(Certificate.verification_code == code)
    )
    row = result.one_or_none()
    if not row:
        return {"success": False, "error": "Certificate not found", "code": 404}
    cert, course, user = row
    return success({
        "valid": True,
        "learner_name": user.full_name or user.email,
        "course_title": course.title,
        "issued_at": cert.issued_at.isoformat(),
        "verification_code": code,
    })


# ── Team Analytics ────────────────────────────────────────────────────────────

@router.get("/team-analytics")
async def team_analytics(
    current_user: User = Depends(require_role(["manager", "hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from app.models.deploy import Employee
    # Get team members
    if current_user.role.value == "manager":
        manager_emp = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        mgr = manager_emp.scalar_one_or_none()
        if mgr:
            subs = await db.execute(select(Employee).where(Employee.manager_id == mgr.id))
            team_employees = subs.scalars().all()
        else:
            team_employees = []
    else:
        subs = await db.execute(select(Employee).where(Employee.org_id == current_user.org_id))
        team_employees = subs.scalars().all()

    team_data = []
    for emp in team_employees:
        user_res = await db.execute(select(User).where(User.id == emp.user_id))
        user = user_res.scalar_one_or_none()
        enrolled = await db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.user_id == emp.user_id))
        completed = await db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.user_id == emp.user_id, Enrollment.completed_at != None))
        certs = await db.execute(select(func.count()).select_from(Certificate).where(Certificate.user_id == emp.user_id))
        team_data.append({
            "employee_id": emp.id,
            "name": user.full_name if user else str(emp.user_id),
            "department": emp.department,
            "enrolled": enrolled.scalar() or 0,
            "completed": completed.scalar() or 0,
            "certificates": certs.scalar() or 0,
        })

    return success(team_data)


@router.get("/transcript")
async def get_transcript(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enroll_res = await db.execute(
        select(Enrollment, Course).join(Course)
        .where(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.created_at.desc())
    )
    certs_res = await db.execute(
        select(Certificate, Course).join(Course)
        .where(Certificate.user_id == current_user.id)
    )
    return success({
        "enrollments": [{
            "course_title": course.title, "progress_percent": float(enroll.progress_percent),
            "enrolled_at": enroll.created_at.isoformat() if enroll.created_at else None,
            "completed_at": enroll.completed_at.isoformat() if enroll.completed_at else None,
        } for enroll, course in enroll_res.all()],
        "certificates": [{
            "course_title": course.title, "issued_at": cert.issued_at.isoformat(),
            "verification_code": cert.verification_code, "pdf_url": cert.pdf_url,
        } for cert, course in certs_res.all()],
    })
