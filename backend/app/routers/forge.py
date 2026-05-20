import json
import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, Header, BackgroundTasks
from starlette.concurrency import run_in_threadpool
import os
import shutil
import uuid
import zipfile
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.forge import (
    Course, CourseSection, SectionQuiz, Enrollment, LearningProgress,
    Certificate, CourseStatus, EnrollmentTrigger, CourseDifficulty
)
from app.models.skill_taxonomy import SkillTaxonomy
from app.models.verify import AssessmentResult
from app.utils.auth import get_current_user, require_role, require_module
from app.utils.s3 import upload_bytes_to_s3
from app.utils.email import send_course_assignment_notification_email
from app.utils.bulk_zip import process_bulk_zip
from app.utils.disk import ensure_free_space, safe_proactive_cleanup


router = APIRouter(prefix="/api/v1/forge", tags=["Forge"], dependencies=[Depends(require_module("forge"))])


def success(data=None, message=""):
    return {"success": True, "data": data or {}, "message": message}


def _safe_course_difficulty(value: str) -> str:
    return value if value in {"beginner", "intermediate", "advanced"} else "beginner"


def _safe_content_type(value: str) -> str:
    if value == "document":
        return "pdf"
    return value if value in {"video", "pdf", "quiz", "lab", "article"} else "article"


def _url_path(*parts: str) -> str:
    return "/".join(str(part).strip("/").replace("\\", "/") for part in parts if part)


async def _save_bulk_zip_upload(request: Request, file: Optional[UploadFile], zip_path: str) -> tuple[str, int]:
    content_type = request.headers.get("content-type", "")
    filename = "course-package.zip"
    bytes_written = 0

    try:
        with open(zip_path, "wb") as handle:
            if content_type.startswith("multipart/form-data"):
                if file is None:
                    raise HTTPException(status_code=400, detail="Please attach a ZIP file using the 'file' field.")
                filename = file.filename or filename
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    bytes_written += len(chunk)
                    handle.write(chunk)
            else:
                filename = request.headers.get("x-filename") or filename
                async for chunk in request.stream():
                    if not chunk:
                        continue
                    bytes_written += len(chunk)
                    handle.write(chunk)
    except OSError as e:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        if getattr(e, "errno", None) == 28:
            raise HTTPException(
                status_code=507,
                detail="Server storage is full. Clear old temporary uploads and try again.",
            )
        raise

    return filename, bytes_written


SCORM_12_API_SHIM = """<script>
(function () {
  var data = {
    "cmi.core.student_id": "learner",
    "cmi.core.student_name": "Learner",
    "cmi.learner_id": "learner",
    "cmi.learner_name": "Learner",
    "cmi.core.lesson_location": "",
    "cmi.location": "",
    "cmi.core.lesson_status": "not attempted",
    "cmi.completion_status": "incomplete",
    "cmi.success_status": "unknown",
    "cmi.suspend_data": "",
    "cmi.core.suspend_data": "",
    "cmi.launch_data": "",
    "cmi.core.launch_data": "",
    "cmi.core.score.raw": "",
    "cmi.score.raw": ""
  };
  var lastError = "0";
  function ok() { lastError = "0"; return "true"; }
  
  var api = {
    LMSInitialize: function () { return ok(); },
    Initialize: function () { return ok(); },
    LMSFinish: function () { return ok(); },
    Terminate: function () { return ok(); },
    LMSCommit: function () {
      try { window.parent.postMessage({ type: "phygitron:scorm-commit", data: data }, "*"); } catch (e) {}
      return ok();
    },
    Commit: function () { return this.LMSCommit(); },
    LMSGetValue: function (key) { lastError = "0"; return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : ""; },
    GetValue: function (key) { return this.LMSGetValue(key); },
    LMSSetValue: function (key, value) {
      data[key] = String(value == null ? "" : value);
      lastError = "0";
      try { window.parent.postMessage({ type: "phygitron:scorm-set", key: key, value: data[key] }, "*"); } catch (e) {}
      return "true";
    },
    SetValue: function (key, value) { return this.LMSSetValue(key, value); },
    LMSGetLastError: function () { return lastError; },
    GetLastError: function () { return lastError; },
    LMSGetErrorString: function (code) { return code === "0" ? "No error" : "SCORM runtime error"; },
    GetErrorString: function (code) { return this.LMSGetErrorString(code); },
    LMSGetDiagnostic: function () { return ""; },
    GetDiagnostic: function () { return ""; }
  };
  
  window.API = api;
  window.API_1484_11 = api;
})();
</script>
"""


def _inject_scorm_api_shim(launch_html_path: str) -> None:
    """Make Storyline SCORM 1.2 packages playable inside our local iframe player."""
    try:
        with open(launch_html_path, "r", encoding="utf-8", errors="ignore") as handle:
            html = handle.read()
    except OSError:
        return

    if "phygitron:scorm-commit" in html or "window.API" in html[:2000]:
        return

    head_pos = html.lower().find("<head>")
    if head_pos != -1:
        insert_pos = head_pos + len("<head>")
        html = html[:insert_pos] + "\n" + SCORM_12_API_SHIM + "\n" + html[insert_pos:]
    else:
        html = SCORM_12_API_SHIM + "\n" + html

    with open(launch_html_path, "w", encoding="utf-8", newline="") as handle:
        handle.write(html)


def _patch_storyline_scorm_driver(package_dir: str) -> None:
    """Articulate Storyline specific fix: force it to use our window.API."""
    # Look for scormdriver.js in common locations
    driver_paths = [
        os.path.join(package_dir, "lms", "scormdriver.js"),
        os.path.join(package_dir, "html5", "lib", "scripts", "scormdriver.js")
    ]
    
    for driver_path in driver_paths:
        try:
            if not os.path.exists(driver_path):
                continue
            with open(driver_path, "r", encoding="utf-8", errors="ignore") as handle:
                js = handle.read()
            
            # Patch both SCORM 1.2 and 2004 variables globally
            new_js = js.replace("var API = null;", "var API = window.API || null;")
            new_js = new_js.replace("var SCORM_objAPI = null;", "var SCORM_objAPI = window.API || null;")
            new_js = new_js.replace("var SCORM2004_objAPI = null;", "var SCORM2004_objAPI = window.API_1484_11 || null;")
            
            # Patch ADL search algorithm to check local API first (replace all)
            new_js = new_js.replace(
                "if ((window.parent != null) && (window.parent != window))",
                "if ((typeof API == 'undefined' || API == null) && (window.parent != null) && (window.parent != window))"
            )
            
            if new_js != js:
                with open(driver_path, "w", encoding="utf-8", newline="") as handle:
                    handle.write(new_js)
        except OSError:
            continue


def _persist_imported_asset(s_data: dict, extract_path: str, upload_dir: str, org_id: int, persisted_packages: dict = None) -> tuple[str, str, str]:
    """Copy imported package assets out of temp storage and return playable section values."""
    content_type = _safe_content_type(s_data.get("content_type", "article"))
    content_url = s_data.get("content_url")
    content_markdown = s_data.get("content_markdown")
    extract_root = Path(extract_path).resolve()

    if s_data.get("is_scorm") and s_data.get("source_path"):
        package_rel = s_data.get("package_root") or "."
        package_src = Path(extract_path, package_rel).resolve()
        launch_src = Path(extract_path, s_data["source_path"]).resolve()
        try:
            package_src.relative_to(extract_root)
            launch_src.relative_to(package_src)
        except ValueError:
            return content_type, content_url, content_markdown
        if package_src.exists() and launch_src.exists():
            # Optimization: Don't re-copy the same SCORM package for every section
            if persisted_packages is not None and package_rel in persisted_packages:
                package_dest_rel = persisted_packages[package_rel]
                launch_rel = os.path.relpath(str(launch_src), str(package_src))
            else:
                package_id = str(uuid.uuid4())
                package_dest_rel = _url_path(str(org_id), "forge", "scorm", package_id)
                package_dest_abs = os.path.join(upload_dir, *package_dest_rel.split("/"))
                os.makedirs(os.path.dirname(package_dest_abs), exist_ok=True)
                try:
                    # Optimization: Move instead of Copy if source is in temp
                    if "temp" in str(package_src):
                        if os.path.exists(package_dest_abs):
                            shutil.rmtree(package_dest_abs, ignore_errors=True)
                        shutil.move(str(package_src), package_dest_abs)
                    else:
                        shutil.copytree(str(package_src), package_dest_abs, dirs_exist_ok=True)
                except OSError:
                    shutil.rmtree(package_dest_abs, ignore_errors=True)
                    raise
                
                launch_rel = os.path.relpath(str(launch_src), str(package_src))
                
                # Inject shim into all HTML files (to handle redirects/iframes)
                for root, _, files in os.walk(package_dest_abs):
                    for file in files:
                        if file.lower().endswith((".html", ".htm")):
                            _inject_scorm_api_shim(os.path.join(root, file))
                
                _patch_storyline_scorm_driver(package_dest_abs)
                
                if persisted_packages is not None:
                    persisted_packages[package_rel] = package_dest_rel

            content_type = "lab"
            content_url = f"/uploads/{_url_path(package_dest_rel, launch_rel)}"
            content_markdown = content_markdown or f"SCORM lesson launch: {content_url}"
            return content_type, content_url, content_markdown

    source_path = s_data.get("source_path")
    if source_path and content_type in {"video", "pdf"}:
        source_abs = Path(extract_path, source_path).resolve()
        try:
            source_abs.relative_to(extract_root)
        except ValueError:
            return content_type, content_url, content_markdown
        if source_abs.exists():
            safe_name = os.path.basename(str(source_abs)).replace(" ", "_")
            dest_rel = _url_path(str(org_id), "forge", "materials", f"{uuid.uuid4()}_{safe_name}")
            dest_abs = os.path.join(upload_dir, *dest_rel.split("/"))
            os.makedirs(os.path.dirname(dest_abs), exist_ok=True)
            shutil.copy2(str(source_abs), dest_abs)
            content_url = f"/uploads/{dest_rel}"

    return content_type, content_url, content_markdown


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
    content_markdown: Optional[str] = None
    duration_minutes: Optional[int] = None
    pass_score: float = 50.0
    quizzes: Optional[list] = None


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    skill_ids: Optional[List[int]] = None
    category: Optional[str] = "General"
    difficulty: str = "beginner"
    estimated_hours: Optional[float] = None
    sections: Optional[List[SectionCreate]] = None


@router.post("/courses")
async def create_course(
    body: CourseCreate,
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    course = Course(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        skill_ids=body.skill_ids or [],
        category=body.category,
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
            content_markdown=section_data.content_markdown,
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


@router.post("/courses/bulk-zip")
async def bulk_upload_zip(
    request: Request,
    file: Optional[UploadFile] = File(None),
    x_filename: Optional[str] = Header(None),
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    # 1. Save ZIP temporarily
    print("Starting bulk ZIP upload...")
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    try:
        ensure_free_space(upload_dir, required_mb=500) # Ensure at least 500MB free
    except Exception as e:
        print(f"Disk check failed (non-fatal): {e}")
    
    temp_id = str(uuid.uuid4())
    os.makedirs(os.path.join(upload_dir, "temp"), exist_ok=True)
    zip_path = os.path.join(upload_dir, "temp", f"{temp_id}.zip")

    filename = x_filename or "course-package.zip"
    try:
        saved_filename, bytes_written = await _save_bulk_zip_upload(request, file, zip_path)
        filename = x_filename or saved_filename or filename
    except HTTPException:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        raise
    except OSError as e:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        if getattr(e, "errno", None) == 28:
            raise HTTPException(
                status_code=507,
                detail="Server storage is full. Clear old temporary uploads and try again.",
            )
        raise

    if not filename.lower().endswith(".zip"):
        if os.path.exists(zip_path):
            os.remove(zip_path)
        raise HTTPException(status_code=400, detail="Please upload a .zip SCORM package or materials archive.")

    if bytes_written == 0:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        raise HTTPException(status_code=400, detail="Uploaded ZIP was empty.")

    if not zipfile.is_zipfile(zip_path):
        if os.path.exists(zip_path):
            os.remove(zip_path)
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP archive.")
        
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Processing bulk ZIP upload: {filename} ({bytes_written} bytes) for user {current_user.id}")
        
        # 2. Process with AI Architect
        print(f"Extracting and analyzing ZIP: {zip_path}")
        res = await run_in_threadpool(process_bulk_zip, zip_path, upload_dir)
        plan = res["plan"]
        extract_path = res["extract_path"]
        print(f"Extraction complete. Plan sections: {len(plan.get('sections', []))}")
        
        # Immediate Cleanup: Remove ZIP after extraction to free space
        if os.path.exists(zip_path):
            os.remove(zip_path)
        
        # 3. Create Course
        course = Course(
            org_id=current_user.org_id,
            title=plan.get("title", "Generated Course"),
            description=plan.get("description", ""),
            category=plan.get("category", "General"),
            difficulty=_safe_course_difficulty(plan.get("difficulty", "beginner")),
            estimated_hours=plan.get("estimated_hours", 2.0),
            status=CourseStatus.draft,
            instructor_id=current_user.id,
        )
        db.add(course)
        await db.flush()
        
        # 4. Create Sections
        persisted_packages = {}
        for idx, s_data in enumerate(plan.get("sections", [])):
            content_type, final_content_url, content_markdown = _persist_imported_asset(
                s_data,
                extract_path,
                upload_dir,
                current_user.org_id,
                persisted_packages
            )

            section = CourseSection(
                course_id=course.id,
                title=s_data.get("title", f"Lesson {idx+1}"),
                order_index=idx,
                content_type=content_type,
                content_url=final_content_url,
                content_markdown=content_markdown if content_type not in {"video", "pdf"} else None,
                duration_minutes=s_data.get("duration_minutes", 15),
            )
            db.add(section)
            await db.flush()
            
            # Quizzes
            for q_data in s_data.get("quizzes", []):
                quiz = SectionQuiz(
                    section_id=section.id,
                    question_text=q_data.get("question_text", ""),
                    options=q_data.get("options", []),
                    correct_answer=q_data.get("correct_answer", ""),
                    explanation=q_data.get("explanation"),
                    marks=q_data.get("marks", 1.0),
                )
                db.add(quiz)
                
        await db.commit()
        # Cleanup
        shutil.rmtree(extract_path, ignore_errors=True)
        # ZIP is already removed above
        
        return success({
            "id": course.id,
            "title": course.title,
            "import_summary": plan.get("import_summary", {}),
            "sections_created": len(plan.get("sections", [])),
        }, "Course successfully architected from ZIP!")
        
    except (zipfile.BadZipFile, zipfile.LargeZipFile) as e:
        await db.rollback()
        if os.path.exists(zip_path): os.remove(zip_path)
        if "extract_path" in locals():
            shutil.rmtree(extract_path, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Invalid ZIP archive: {str(e)}")
    except OSError as e:
        await db.rollback()
        if os.path.exists(zip_path): os.remove(zip_path)
        if "extract_path" in locals():
            shutil.rmtree(extract_path, ignore_errors=True)
        if getattr(e, "errno", None) == 28:
            raise HTTPException(
                status_code=507,
                detail="Server storage is full while unpacking the SCORM package. Clear old uploads and try again.",
            )
        raise HTTPException(status_code=500, detail=f"Bulk upload failed: {str(e)}")
    except HTTPException:
        await db.rollback()
        if os.path.exists(zip_path): os.remove(zip_path)
        if "extract_path" in locals():
            shutil.rmtree(extract_path, ignore_errors=True)
        raise
    except Exception as e:
        await db.rollback()
        # Cleanup
        if os.path.exists(zip_path): os.remove(zip_path)
        if "extract_path" in locals():
            shutil.rmtree(extract_path, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Bulk upload failed: {str(e)}")


@router.get("/courses")
async def list_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Course).where(Course.status == CourseStatus.published).order_by(Course.created_at.desc())
    if current_user.role.value != "super_admin":
        query = query.where(Course.org_id == current_user.org_id)
    result = await db.execute(query)
    courses = result.scalars().all()
    return success([{
        "id": c.id, "title": c.title, "description": c.description,
        "difficulty": c.difficulty.value, "category": c.category, "is_featured": c.is_featured,
        "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
        "thumbnail_url": c.thumbnail_url, "skill_ids": c.skill_ids,
    } for c in courses])


@router.get("/courses/{course_id}")
async def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Course).where(Course.id == course_id)
    if current_user.role.value != "super_admin":
        query = query.where(Course.org_id == current_user.org_id)
    result = await db.execute(query)
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or access denied")

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
            "content_markdown": s.content_markdown,
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
                "progress_percent": float(p.progress_percent or 0),
                "scorm_progress_percent": float(p.scorm_progress_percent) if p.scorm_progress_percent is not None else None,
                "scorm_score": float(p.scorm_score) if p.scorm_score is not None else None,
                "scorm_status": p.scorm_status,
                "scorm_location": p.scorm_location,
                "last_scorm_commit_at": p.last_scorm_commit_at.isoformat() if p.last_scorm_commit_at else None,
            }

    return success({
        "id": course.id, "title": course.title, "description": course.description,
        "difficulty": course.difficulty.value, "category": course.category, "is_featured": course.is_featured,
        "estimated_hours": float(course.estimated_hours) if course.estimated_hours else None,
        "sections": section_data,
        "enrollment": {
            "id": enrollment.id,
            "progress_percent": float(enrollment.progress_percent),
            "last_accessed_at": enrollment.last_accessed_at.isoformat() if enrollment.last_accessed_at else None,
            "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
        } if enrollment else None,
        "progress": progress_data,
    })


@router.post("/courses/{course_id}/publish")
async def publish_course(
    course_id: int,
    current_user: User = Depends(require_role(["org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id, Course.org_id == current_user.org_id))
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
    completed: Optional[bool] = None
    progress_percent: Optional[float] = None
    video_progress_seconds: Optional[int] = None
    quiz_score: Optional[float] = None
    scorm_progress_percent: Optional[float] = None
    scorm_score: Optional[float] = None
    scorm_status: Optional[str] = None
    scorm_location: Optional[str] = None
    scorm_suspend_data: Optional[str] = None


def _clamp_percent(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    try:
        return max(0.0, min(100.0, float(value)))
    except (TypeError, ValueError):
        return None


def _derive_completion_status(
    completed_flag: Optional[bool],
    progress_percent: Optional[float],
    scorm_status: Optional[str],
    quiz_score: Optional[float],
    quiz_pass_score: Optional[float] = None,
) -> bool:
    if completed_flag is True:
        return True
    if progress_percent is not None and progress_percent >= 100:
        return True
    if quiz_score is not None and quiz_pass_score is not None and quiz_score >= quiz_pass_score:
        return True
    normalized = (scorm_status or "").strip().lower()
    return normalized in {"completed", "complete", "passed", "success"}


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

    section_res = await db.execute(select(CourseSection).where(CourseSection.id == section_id))
    section = section_res.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    raw_progress = body.progress_percent
    if raw_progress is None:
        raw_progress = body.scorm_progress_percent
    if raw_progress is None and body.quiz_score is not None:
        raw_progress = 100.0
    if raw_progress is None and body.completed is True:
        raw_progress = 100.0

    progress_percent = _clamp_percent(raw_progress)
    scorm_progress = _clamp_percent(body.scorm_progress_percent)
    scorm_score = _clamp_percent(body.scorm_score)

    quiz_pass_score = float(section.pass_score) if section.content_type.value == "quiz" and section.pass_score is not None else None
    if section.content_type.value == "quiz" and body.quiz_score is not None:
        progress_percent = 100.0 if quiz_pass_score is not None and body.quiz_score >= quiz_pass_score else max(0.0, min(99.0, float(body.quiz_score)))

    is_complete = _derive_completion_status(body.completed, progress_percent, body.scorm_status, body.quiz_score, quiz_pass_score)
    if section.content_type.value != "lab" and body.completed is None and progress_percent is None:
        is_complete = True
        progress_percent = 100.0

    if progress_percent is not None:
        prog.progress_percent = progress_percent
    if body.video_progress_seconds:
        prog.video_progress_seconds = body.video_progress_seconds
    if body.quiz_score is not None:
        prog.quiz_score = body.quiz_score
    if scorm_progress is not None:
        prog.scorm_progress_percent = scorm_progress
        prog.progress_percent = scorm_progress
    if scorm_score is not None:
        prog.scorm_score = scorm_score
    if body.scorm_status is not None:
        prog.scorm_status = body.scorm_status[:64]
    if body.scorm_location is not None:
        prog.scorm_location = body.scorm_location[:255]
    if body.scorm_suspend_data is not None:
        prog.scorm_suspend_data = body.scorm_suspend_data
    if any(v is not None for v in [body.scorm_progress_percent, body.scorm_score, body.scorm_status, body.scorm_location, body.scorm_suspend_data]):
        prog.last_scorm_commit_at = datetime.utcnow()

    prog.completed = is_complete
    if is_complete:
        prog.progress_percent = 100.0
        prog.completed_at = prog.completed_at or datetime.utcnow()
    elif body.completed is False:
        prog.completed_at = None

    # Update enrollment progress %
    enroll_res = await db.execute(select(Enrollment).where(Enrollment.id == body.enrollment_id))
    enrollment = enroll_res.scalar_one_or_none()
    if enrollment:
        section_progress_res = await db.execute(
            select(CourseSection.id, LearningProgress.progress_percent)
            .select_from(CourseSection)
            .outerjoin(
                LearningProgress,
                and_(
                    LearningProgress.section_id == CourseSection.id,
                    LearningProgress.enrollment_id == body.enrollment_id,
                ),
            )
            .where(CourseSection.course_id == enrollment.course_id)
        )
        section_rows = section_progress_res.all()
        total = len(section_rows) or 1
        total_progress = sum(float(pct or 0) for _, pct in section_rows)
        enrollment.progress_percent = round(total_progress / total, 2)
        enrollment.last_accessed_at = datetime.utcnow()

        if enrollment.progress_percent >= 100:
            enrollment.completed_at = enrollment.completed_at or datetime.utcnow()
            # Generate certificate inline
            try:
                await _generate_certificate_inline(enrollment.id, current_user.id, db)
            except Exception as e:
                logger.warning(f"Certificate generation failed: {e}")
        else:
            enrollment.completed_at = None

    await db.commit()
    return success({"progress_percent": float(enrollment.progress_percent) if enrollment else 0})


# ── Certificates ──────────────────────────────────────────────────────────────

@router.get("/certificates/{user_id}")
async def get_certificates(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != user_id and current_user.role.value not in ["hr", "org_admin", "manager"]:
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
    current_user: User = Depends(require_role(["manager", "hr", "org_admin"])),
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
        avg_progress_res = await db.execute(select(func.avg(Enrollment.progress_percent)).where(Enrollment.user_id == emp.user_id))
        in_progress_res = await db.execute(
            select(func.count()).select_from(Enrollment).where(
                Enrollment.user_id == emp.user_id,
                Enrollment.progress_percent > 0,
                Enrollment.completed_at == None,
            )
        )
        last_access_res = await db.execute(select(func.max(Enrollment.last_accessed_at)).where(Enrollment.user_id == emp.user_id))
        last_accessed = last_access_res.scalar()
        team_data.append({
            "employee_id": emp.id,
            "name": user.full_name if user else str(emp.user_id),
            "department": emp.department,
            "enrolled": enrolled.scalar() or 0,
            "completed": completed.scalar() or 0,
            "certificates": certs.scalar() or 0,
            "avg_progress_percent": round(float(avg_progress_res.scalar() or 0), 2),
            "in_progress": in_progress_res.scalar() or 0,
            "last_accessed_at": last_accessed.isoformat() if last_accessed else None,
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
            "last_accessed_at": enroll.last_accessed_at.isoformat() if enroll.last_accessed_at else None,
        } for enroll, course in enroll_res.all()],
        "certificates": [{
            "course_title": course.title, "issued_at": cert.issued_at.isoformat(),
            "verification_code": cert.verification_code, "pdf_url": cert.pdf_url,
        } for cert, course in certs_res.all()],
    })


# ── Course Library (search + filter) ────────────────────────────────────────

@router.get("/library")
async def course_library(
    q: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Course).where(
        Course.org_id == current_user.org_id,
        Course.status == CourseStatus.published
    )
    if q:
        query = query.where(or_(
            Course.title.ilike(f"%{q}%"),
            Course.description.ilike(f"%{q}%")
        ))
    if difficulty:
        query = query.where(Course.difficulty == difficulty)

    count_q = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_q)
    total = total_res.scalar() or 0

    query = query.order_by(Course.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    courses = result.scalars().all()

    # For each course, check if user is enrolled
    enrolled_ids = set()
    if courses:
        enroll_res = await db.execute(
            select(Enrollment.course_id).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id.in_([c.id for c in courses])
            )
        )
        enrolled_ids = {r for r in enroll_res.scalars()}

    return success({
        "courses": [{
            "id": c.id, "title": c.title, "description": c.description,
            "difficulty": c.difficulty.value, "category": c.category, "is_featured": c.is_featured,
            "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
            "thumbnail_url": c.thumbnail_url, "skill_ids": c.skill_ids,
            "enrolled": c.id in enrolled_ids,
            "created_at": c.created_at.isoformat(),
        } for c in courses],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total else 1,
    })


# ── Instructor: My Courses ───────────────────────────────────────────────────

@router.get("/my-courses")
async def my_courses(
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value in ["org_admin", "hr", "super_admin"]:
        query = select(Course)
        if current_user.role.value != "super_admin":
            query = query.where(Course.org_id == current_user.org_id)
    else:
        # Let instructors see all courses in their organization too, to allow collaborative assignment,
        # or fall back to their own courses if desired. In our case, allowing org-level visibility aligns with the Assessment Hub.
        query = select(Course).where(Course.org_id == current_user.org_id)

    result = await db.execute(query.order_by(Course.created_at.desc()))
    courses = result.scalars().all()

    out = []
    for c in courses:
        sec_count = await db.execute(select(func.count()).select_from(CourseSection).where(CourseSection.course_id == c.id))
        enroll_count = await db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.course_id == c.id))
        completed_count = await db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.course_id == c.id, Enrollment.completed_at != None))
        cert_count = await db.execute(select(func.count()).select_from(Certificate).where(Certificate.course_id == c.id))
        out.append({
            "id": c.id, "title": c.title, "description": c.description,
            "difficulty": c.difficulty.value, "status": c.status.value,
            "category": c.category, "is_featured": c.is_featured,
            "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
            "thumbnail_url": c.thumbnail_url,
            "sections": sec_count.scalar() or 0,
            "enrollments": enroll_count.scalar() or 0,
            "completions": completed_count.scalar() or 0,
            "certificates_issued": cert_count.scalar() or 0,
            "created_at": c.created_at.isoformat(),
        })
    return success(out)


# ── Update Course ────────────────────────────────────────────────────────────

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    estimated_hours: Optional[float] = None
    thumbnail_url: Optional[str] = None


@router.put("/courses/{course_id}")
async def update_course(
    course_id: int,
    body: CourseUpdate,
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id, Course.org_id == current_user.org_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id != current_user.id and current_user.role.value != "org_admin":
        raise HTTPException(status_code=403, detail="Access denied")

    if body.title is not None:
        course.title = body.title
    if body.description is not None:
        course.description = body.description
    if body.category is not None:
        course.category = body.category
    if body.difficulty is not None:
        course.difficulty = body.difficulty
    if body.estimated_hours is not None:
        course.estimated_hours = body.estimated_hours
    if body.thumbnail_url is not None:
        course.thumbnail_url = body.thumbnail_url

    await db.commit()
    return success({"id": course.id}, "Course updated")


# ── Delete Course ────────────────────────────────────────────────────────────

@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: int,
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    # Use selectinload to eagerly load sections for disk cleanup
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.sections))
        .where(Course.id == course_id, Course.org_id == current_user.org_id)
    )
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id != current_user.id and current_user.role.value != "org_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Identify folders to delete on disk
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    paths_to_delete = set()
    for section in course.sections:
        if section.content_url and section.content_url.startswith("/uploads/"):
            parts = section.content_url.split("/")
            if len(parts) > 5 and "scorm" in parts:
                package_dir = os.path.join(upload_dir, *parts[2:6])
                paths_to_delete.add(package_dir)
            elif len(parts) > 2:
                file_path = os.path.join(upload_dir, *parts[2:])
                paths_to_delete.add(file_path)

    # Manually delete all dependencies to avoid FK constraints
    
    # 1. Learning Progress and Quizzes (linked to sections)
    section_ids = [s.id for s in course.sections]
    if section_ids:
        await db.execute(delete(LearningProgress).where(LearningProgress.section_id.in_(section_ids)))
        await db.execute(delete(SectionQuiz).where(SectionQuiz.section_id.in_(section_ids)))
    
    # 2. Enrollments and Certificates (linked to course)
    await db.execute(delete(Certificate).where(Certificate.course_id == course_id))
    await db.execute(delete(Enrollment).where(Enrollment.course_id == course_id))
    
    # 3. Sections
    await db.execute(delete(CourseSection).where(CourseSection.course_id == course_id))
    
    # 4. Finally the course
    await db.delete(course)
    await db.commit()

    # Delete files on disk
    for path in paths_to_delete:
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            elif os.path.isfile(path):
                os.remove(path)
        except Exception as e:
            print(f"Failed to delete disk path {path}: {e}")

    return success(message="Course and associated assets deleted successfully")


# ── Submit for Review ────────────────────────────────────────────────────────

@router.post("/courses/{course_id}/submit-review")
async def submit_for_review(
    course_id: int,
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id, Course.org_id == current_user.org_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id != current_user.id and current_user.role.value != "org_admin":
        raise HTTPException(status_code=403, detail="Access denied")

    course.status = CourseStatus.pending_review
    await db.commit()
    return success(message="Course submitted for review")


# ── Enrollments List for an Instructor's Course ──────────────────────────────

@router.get("/courses/{course_id}/enrollments")
async def course_enrollments(
    course_id: int,
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    enroll_res = await db.execute(
        select(Enrollment, User).join(User, User.id == Enrollment.user_id)
        .where(Enrollment.course_id == course_id)
        .order_by(Enrollment.created_at.desc())
    )
    rows = enroll_res.all()
    return success([{
        "enrollment_id": e.id,
        "user_id": u.id,
        "learner_name": u.full_name or u.email,
        "progress_percent": float(e.progress_percent),
        "enrolled_at": e.created_at.isoformat() if e.created_at else None,
        "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        "last_accessed_at": e.last_accessed_at.isoformat() if e.last_accessed_at else None,
        "triggered_by": e.triggered_by.value,
    } for e, u in rows])


# ── HR Bulk Enroll ───────────────────────────────────────────────────────────

class BulkEnrollBody(BaseModel):
    course_id: int
    user_ids: List[int]
    deadline: Optional[str] = None


@router.post("/bulk-enroll")
async def bulk_enroll(
    body: BulkEnrollBody,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    course_res = await db.execute(select(Course).where(Course.id == body.course_id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    users_res = await db.execute(select(User).where(User.id.in_(body.user_ids)))
    users_map = {u.id: u for u in users_res.scalars()}

    enrolled = 0
    skipped = 0
    new_enrollments = []

    for uid in body.user_ids:
        user = users_map.get(uid)
        if not user:
            skipped += 1
            continue

        existing = await db.execute(
            select(Enrollment).where(Enrollment.user_id == uid, Enrollment.course_id == body.course_id)
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        deadline = datetime.fromisoformat(body.deadline) if body.deadline else None
        e = Enrollment(
            user_id=uid,
            course_id=body.course_id,
            triggered_by=EnrollmentTrigger.hr_push,
            deadline=deadline,
        )
        db.add(e)
        enrolled += 1
        new_enrollments.append(user)

    await db.commit()

    for user in new_enrollments:
        background_tasks.add_task(
            send_course_assignment_notification_email,
            to_email=user.email,
            candidate_name=user.full_name or user.email,
            course_title=course.title,
            deadline=body.deadline,
            difficulty=course.difficulty.value,
            estimated_hours=float(course.estimated_hours) if course.estimated_hours else None
        )

    return success({"enrolled": enrolled, "skipped": skipped})


@router.post("/upload-video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["instructor", "org_admin", "hr"])),
    db: AsyncSession = Depends(get_db),
):
    # Basic validation for video files
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are accepted")

    # Read bytes
    video_bytes = await file.read()
    
    # Enforce a reasonable limit for now (e.g., 200MB)
    if len(video_bytes) > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video file size exceeds 200MB limit")

    # Generate a unique key for storage
    file_ext = os.path.splitext(file.filename)[1]
    s3_key = f"{current_user.org_id}/forge/videos/{uuid.uuid4()}{file_ext}"

    try:
        # Upload to S3 (or local fallback defined in s3.py)
        video_url = await upload_bytes_to_s3(video_bytes, s3_key, file.content_type)
        return success({"url": video_url}, "Video uploaded successfully")
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Video upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")

