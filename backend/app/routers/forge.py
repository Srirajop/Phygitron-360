import io
import json
import logging
import os
import re
import secrets
import shutil
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, date
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from pydantic import BaseModel
from sqlalchemy import (
    DECIMAL,
    DateTime,
    and_,
    delete,
    desc,
    func,
    or_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.database import get_db
from app.models.deploy import Employee, EmployeeStatus
from app.models.forge import (
    Certificate,
    ContentType,
    Course,
    CourseDifficulty,
    CourseDomain,
    CourseSection,
    CourseStatus,
    Enrollment,
    EnrollmentTrigger,
    LearningProgress,
    SectionQuiz,
)
from app.models.user import User
from app.utils.auth import get_current_user, require_module, require_role
from app.utils.disk import ensure_free_space
from app.utils.email import (
    send_course_assignment_notification_email,
    send_course_completion_congratulations_email,
    send_course_deadline_reminder_email,
)
from app.utils.s3 import upload_bytes_to_s3

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/forge", tags=["Forge"], dependencies=[Depends(require_module("forge"))])


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


def _safe_course_difficulty(value: Optional[str]) -> CourseDifficulty:
    if value in {"intermediate", "advanced"}:
        return CourseDifficulty(value)
    return CourseDifficulty.beginner


def _url_path(*parts: str) -> str:
    return "/".join(str(part).strip("/").replace("\\", "/") for part in parts if part)


# ── SCORM 1.2 & 2004 Runtime API Shim ─────────────────────────────────────────

SCORM_RUNTIME_SHIM = """<script>
(function () {
  var data = {
    "cmi.core.student_id": "employee",
    "cmi.core.student_name": "Learner",
    "cmi.learner_id": "employee",
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
    "cmi.score.raw": "",
    "cmi.core.score.min": "0",
    "cmi.core.score.max": "100",
    "cmi.score.scaled": "0",
    "cmi.core.lesson_mode": "normal",
    "cmi.mode": "normal"
  };
  var lastError = "0";
  function ok() { lastError = "0"; return "true"; }

  // Receive initial resume data from parent player window
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "phygitron:scorm-init-data") {
      var init = event.data.data || {};
      for (var k in init) {
        if (Object.prototype.hasOwnProperty.call(init, k) && init[k] != null) {
          data[k] = String(init[k]);
        }
      }
    }
  });

  var api = {
    LMSInitialize: function () { 
      try { window.parent.postMessage({ type: "phygitron:scorm-ready" }, "*"); } catch(e){}
      return ok(); 
    },
    Initialize: function () { return this.LMSInitialize(); },
    LMSFinish: function () { 
      try { window.parent.postMessage({ type: "phygitron:scorm-finish", data: data }, "*"); } catch(e){}
      return ok(); 
    },
    Terminate: function () { return this.LMSFinish(); },
    LMSCommit: function () {
      try { window.parent.postMessage({ type: "phygitron:scorm-commit", data: data }, "*"); } catch (e) {}
      return ok();
    },
    Commit: function () { return this.LMSCommit(); },
    LMSGetValue: function (key) {
      lastError = "0";
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : "";
    },
    GetValue: function (key) { return this.LMSGetValue(key); },
    LMSSetValue: function (key, value) {
      data[key] = String(value == null ? "" : value);
      // Synchronize alias keys between SCORM 1.2 and 2004
      if (key === "cmi.core.lesson_location") data["cmi.location"] = data[key];
      if (key === "cmi.location") data["cmi.core.lesson_location"] = data[key];
      if (key === "cmi.core.suspend_data") data["cmi.suspend_data"] = data[key];
      if (key === "cmi.suspend_data") data["cmi.core.suspend_data"] = data[key];
      if (key === "cmi.core.score.raw") data["cmi.score.raw"] = data[key];
      if (key === "cmi.score.raw") data["cmi.core.score.raw"] = data[key];

      lastError = "0";
      try {
        window.parent.postMessage({ type: "phygitron:scorm-set", key: key, value: data[key], allData: data }, "*");
      } catch (e) {}
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

  try {
    window.parent.postMessage({ type: "phygitron:scorm-ready" }, "*");
  } catch (e) {}
})();
</script>
"""


def _inject_scorm_api_shim(launch_html_path: str) -> None:
    """Inject SCORM runtime shim into HTML files so packages play locally without external LMS."""
    try:
        with open(launch_html_path, "r", encoding="utf-8", errors="ignore") as handle:
            html = handle.read()
    except OSError:
        return

    if "phygitron:scorm-commit" in html or "window.API" in html[:3000]:
        return

    head_pos = html.lower().find("<head>")
    if head_pos != -1:
        insert_pos = head_pos + len("<head>")
        html = html[:insert_pos] + "\n" + SCORM_RUNTIME_SHIM + "\n" + html[insert_pos:]
    else:
        html = SCORM_RUNTIME_SHIM + "\n" + html

    with open(launch_html_path, "w", encoding="utf-8", newline="") as handle:
        handle.write(html)


def _patch_storyline_scorm_driver(package_dir: str) -> None:
    """Patch Articulate Storyline driver scripts to bind to window.API directly."""
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

            new_js = js.replace("var API = null;", "var API = window.API || null;")
            new_js = new_js.replace("var SCORM_objAPI = null;", "var SCORM_objAPI = window.API || null;")
            new_js = new_js.replace("var SCORM2004_objAPI = null;", "var SCORM2004_objAPI = window.API_1484_11 || null;")
            new_js = new_js.replace(
                "if ((window.parent != null) && (window.parent != window))",
                "if ((typeof API == 'undefined' || API == null) && (window.parent != null) && (window.parent != window))"
            )

            if new_js != js:
                with open(driver_path, "w", encoding="utf-8", newline="") as handle:
                    handle.write(new_js)
        except OSError:
            continue


def _parse_scorm_manifest(extract_path: str) -> dict:
    """Find and parse imsmanifest.xml from extracted SCORM package."""
    manifest_path = None
    manifest_rel_dir = ""
    for root, dirs, files in os.walk(extract_path):
        for f in files:
            if f.lower() == "imsmanifest.xml":
                manifest_path = os.path.join(root, f)
                manifest_rel_dir = os.path.relpath(root, extract_path)
                if manifest_rel_dir == ".":
                    manifest_rel_dir = ""
                break
        if manifest_path:
            break

    if not manifest_path or not os.path.exists(manifest_path):
        raise HTTPException(
            status_code=400,
            detail="Invalid SCORM package: imsmanifest.xml not found in archive."
        )

    try:
        with open(manifest_path, "r", encoding="utf-8", errors="ignore") as f:
            xml_content = f.read()

        # Handle undeclared XML namespace prefixes common in legacy SCORM packages
        prefixes = set(re.findall(r'<([a-zA-Z0-9_-]+):', xml_content) + re.findall(r'\s([a-zA-Z0-9_-]+):[a-zA-Z0-9_-]+=', xml_content))
        known_namespaces = {
            "adlcp": "http://www.adlnet.org/xsd/adlcp_rootv1p2",
            "adlseq": "http://www.adlnet.org/xsd/adlseq_v1p3",
            "adlnav": "http://www.adlnet.org/xsd/adlnav_v1p3",
            "imsss": "http://www.imsglobal.org/xsd/imsss",
            "xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "lom": "http://ltsc.ieee.org/xsd/LOM",
        }
        missing_declarations = []
        for p in prefixes:
            if f"xmlns:{p}=" not in xml_content:
                uri = known_namespaces.get(p, f"http://example.com/{p}")
                missing_declarations.append(f'xmlns:{p}="{uri}"')

        if missing_declarations:
            xml_content = re.sub(
                r'(<manifest\b[^>]*)>',
                r'\1 ' + ' '.join(missing_declarations) + '>',
                xml_content,
                count=1,
                flags=re.IGNORECASE
            )

        root = ET.fromstring(xml_content)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse imsmanifest.xml: {str(e)}"
        )

    def _local_tag(elem):
        return elem.tag.split("}")[-1].lower() if "}" in elem.tag else elem.tag.lower()

    title = ""
    version = "1.2"
    launch_href = ""
    mastery_score = 70.0

    # 1. Look for schemaversion
    for elem in root.iter():
        tag = _local_tag(elem)
        if tag == "schemaversion":
            ver_text = (elem.text or "").strip().lower()
            if "2004" in ver_text or "1.3" in ver_text:
                version = "2004"
            else:
                version = "1.2"
        elif tag == "masteryscore":
            try:
                mastery_score = float((elem.text or "").strip())
            except ValueError:
                pass

    # 2. Look for title in organizations/organization
    for elem in root.iter():
        if _local_tag(elem) == "organization":
            for child in elem:
                if _local_tag(child) == "title" and child.text:
                    title = child.text.strip()
                    break
            if title:
                break

    if not title:
        for elem in root.iter():
            if _local_tag(elem) == "title" and elem.text and elem.text.strip():
                title = elem.text.strip()
                break

    # 3. Look for launch resource
    for elem in root.iter():
        if _local_tag(elem) == "resource":
            href = elem.attrib.get("href") or elem.attrib.get("HREF")
            scorm_type = elem.attrib.get("{http://www.adlnet.org/xsd/adlcp_rootv1p2}scormType") or \
                         elem.attrib.get("{http://www.adlnet.org/xsd/adlcp_v1p3}scormType") or \
                         elem.attrib.get("scormType") or elem.attrib.get("type") or ""
            if href and (not launch_href or "sco" in scorm_type.lower() or "webcontent" in scorm_type.lower()):
                launch_href = href
                if "sco" in scorm_type.lower():
                    break

    # If href still empty, search for common launch files
    if not launch_href:
        common_launch_names = ["index_lms.html", "story.html", "index.html", "launch.html", "default.htm", "player.html"]
        for candidate in common_launch_names:
            check_path = os.path.join(os.path.dirname(manifest_path), candidate)
            if os.path.exists(check_path):
                launch_href = candidate
                break

    if not launch_href:
        for f in os.listdir(os.path.dirname(manifest_path)):
            if f.lower().endswith((".html", ".htm")):
                launch_href = f
                break

    if not launch_href:
        raise HTTPException(
            status_code=400,
            detail="Could not determine SCORM launch file from imsmanifest.xml."
        )

    final_rel_launch = os.path.normpath(os.path.join(manifest_rel_dir, launch_href)).replace("\\", "/")

    return {
        "title": title or "SCORM Course",
        "version": version,
        "launch_href": final_rel_launch,
        "mastery_score": mastery_score,
        "manifest_path": manifest_path,
    }


# ── Inline Certificate Generator ─────────────────────────────────────────────

async def _generate_certificate_inline(enrollment_id: int, user_id: int, db: AsyncSession):
    enrollment_res = await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
    enrollment = enrollment_res.scalar_one_or_none()
    if not enrollment:
        return

    user_res = await db.execute(select(User).where(User.id == enrollment.user_id))
    user = user_res.scalar_one_or_none()

    course_res = await db.execute(select(Course).where(Course.id == enrollment.course_id))
    course = course_res.scalar_one_or_none()

    if not user or not course:
        return

    existing_res = await db.execute(
        select(Certificate).where(Certificate.user_id == user.id, Certificate.course_id == course.id)
    )
    if existing_res.scalar_one_or_none():
        return

    verification_code = secrets.token_hex(8).upper()

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
        c.drawCentredString(w / 2, h - 285, "has successfully completed the training course")
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
    except Exception as e:
        logger.warning(f"ReportLab failed, using fallback certificate: {e}")
        pdf_bytes = b"%PDF-1.4 certificate placeholder"

    s3_key = f"{course.org_id}/certificates/{user.id}/{course.id}/certificate.pdf"
    try:
        cert_url = await upload_bytes_to_s3(pdf_bytes, s3_key, "application/pdf")
    except Exception:
        cert_url = f"/uploads/{s3_key}"

    cert = Certificate(
        user_id=user.id,
        course_id=course.id,
        verification_code=verification_code,
        pdf_url=cert_url,
    )
    db.add(cert)
    await db.flush()


# ── Domains CRUD ─────────────────────────────────────────────────────────────

class DomainCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#7C3AED"
    icon: Optional[str] = "Layers"


class DomainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


@router.get("/domains")
async def list_domains(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(
            CourseDomain,
            func.count(Course.id).label("course_count")
        )
        .outerjoin(Course, and_(Course.domain_id == CourseDomain.id, Course.status == CourseStatus.published))
        .where(CourseDomain.org_id == current_user.org_id)
        .group_by(CourseDomain.id)
        .order_by(CourseDomain.name.asc())
    )
    res = await db.execute(query)
    rows = res.all()
    domains_data = []
    for d, count in rows:
        domains_data.append({
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "color": d.color or "#7C3AED",
            "icon": d.icon or "Layers",
            "course_count": count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })
    return success(domains_data)


@router.post("/domains")
async def create_domain(
    body: DomainCreate,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    domain = CourseDomain(
        org_id=current_user.org_id,
        name=body.name.strip(),
        description=body.description,
        color=body.color or "#7C3AED",
        icon=body.icon or "Layers",
    )
    db.add(domain)
    await db.commit()
    return success({
        "id": domain.id,
        "name": domain.name,
        "description": domain.description,
        "color": domain.color,
        "icon": domain.icon,
    }, "Domain created successfully")


@router.put("/domains/{domain_id}")
async def update_domain(
    domain_id: int,
    body: DomainUpdate,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(CourseDomain).where(CourseDomain.id == domain_id, CourseDomain.org_id == current_user.org_id))
    domain = res.scalar_one_or_none()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    if body.name is not None:
        domain.name = body.name.strip()
    if body.description is not None:
        domain.description = body.description
    if body.color is not None:
        domain.color = body.color
    if body.icon is not None:
        domain.icon = body.icon

    await db.commit()
    return success({
        "id": domain.id,
        "name": domain.name,
        "description": domain.description,
        "color": domain.color,
        "icon": domain.icon,
    }, "Domain updated")


@router.delete("/domains/{domain_id}")
async def delete_domain(
    domain_id: int,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(CourseDomain).where(CourseDomain.id == domain_id, CourseDomain.org_id == current_user.org_id))
    domain = res.scalar_one_or_none()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Unlink any courses assigned to this domain
    await db.execute(
        select(Course).where(Course.domain_id == domain_id)
    )
    # Set domain_id to NULL
    courses_res = await db.execute(select(Course).where(Course.domain_id == domain_id))
    for c in courses_res.scalars().all():
        c.domain_id = None

    await db.delete(domain)
    await db.commit()
    return success(message="Domain deleted successfully")


# ── SCORM Upload ─────────────────────────────────────────────────────────────

@router.post("/scorm/upload")
async def upload_scorm_package(
    title: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    domain_id: Optional[int] = Query(None),
    difficulty: Optional[str] = Query("beginner"),
    estimated_hours: Optional[float] = Query(2.0),
    pass_score: Optional[float] = Query(70.0),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip SCORM packages are supported.")

    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    ensure_free_space(upload_dir, required_mb=300)

    package_id = str(uuid.uuid4())
    temp_zip_path = os.path.join(upload_dir, "temp", f"{package_id}.zip")
    os.makedirs(os.path.dirname(temp_zip_path), exist_ok=True)

    dest_package_rel = _url_path(str(current_user.org_id), "forge", "scorm", package_id)
    dest_package_abs = os.path.join(upload_dir, *dest_package_rel.split("/"))
    os.makedirs(dest_package_abs, exist_ok=True)

    try:
        # 1. Save uploaded zip
        with open(temp_zip_path, "wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

        if not zipfile.is_zipfile(temp_zip_path):
            raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP archive.")

        # 2. Extract into destination package directory
        with zipfile.ZipFile(temp_zip_path, "r") as zf:
            zf.extractall(dest_package_abs)

        # 3. Parse manifest
        manifest_meta = _parse_scorm_manifest(dest_package_abs)

        # 4. Inject runtime shim into all HTML files in package
        for root_dir, _, files in os.walk(dest_package_abs):
            for f in files:
                if f.lower().endswith((".html", ".htm")):
                    _inject_scorm_api_shim(os.path.join(root_dir, f))

        # 5. Patch Storyline driver if present
        _patch_storyline_scorm_driver(dest_package_abs)

        # 6. Verify domain if provided
        final_domain_id = None
        domain_name = "General"
        if domain_id:
            d_res = await db.execute(select(CourseDomain).where(CourseDomain.id == domain_id, CourseDomain.org_id == current_user.org_id))
            dom = d_res.scalar_one_or_none()
            if dom:
                final_domain_id = dom.id
                domain_name = dom.name

        course_title = (title or "").strip() or manifest_meta["title"] or "Untitled SCORM Course"
        launch_rel_url = f"/uploads/{_url_path(dest_package_rel, manifest_meta['launch_href'])}"

        # 7. Create Course record
        course = Course(
            org_id=current_user.org_id,
            title=course_title,
            description=description or f"SCORM package ({manifest_meta['version']}) training module.",
            domain_id=final_domain_id,
            category=domain_name,
            difficulty=_safe_course_difficulty(difficulty),
            estimated_hours=estimated_hours or 2.0,
            status=CourseStatus.published,
            instructor_id=current_user.id,
            is_scorm=True,
            scorm_package_path=dest_package_rel,
            scorm_entry_url=launch_rel_url,
            scorm_version=manifest_meta["version"],
            scorm_mastery_score=pass_score or manifest_meta["mastery_score"] or 70.0,
        )
        db.add(course)
        await db.flush()

        # 8. Add single CourseSection so section-level progress bridges work uniformly
        section = CourseSection(
            course_id=course.id,
            title="SCORM Module",
            order_index=0,
            content_type=ContentType.lab,
            content_url=launch_rel_url,
            content_markdown="Interactive SCORM Module",
            duration_minutes=int((estimated_hours or 2.0) * 60),
            pass_score=pass_score or manifest_meta["mastery_score"] or 70.0,
        )
        db.add(section)
        await db.commit()

        return success({
            "id": course.id,
            "title": course.title,
            "domain_id": course.domain_id,
            "domain_name": domain_name,
            "scorm_entry_url": course.scorm_entry_url,
            "scorm_version": course.scorm_version,
            "mastery_score": float(course.scorm_mastery_score),
            "status": course.status.value,
        }, "SCORM course package uploaded and ready for assignment!")

    except HTTPException:
        await db.rollback()
        if os.path.exists(dest_package_abs):
            shutil.rmtree(dest_package_abs, ignore_errors=True)
        raise
    except Exception as e:
        await db.rollback()
        if os.path.exists(dest_package_abs):
            shutil.rmtree(dest_package_abs, ignore_errors=True)
        logger.error(f"SCORM upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"SCORM upload failed: {str(e)}")
    finally:
        if os.path.exists(temp_zip_path):
            try:
                os.remove(temp_zip_path)
            except OSError:
                pass


# ── Assignable Employees (Exclusively from Employee DB) ──────────────────────

@router.get("/assignable-employees")
async def get_assignable_employees(
    course_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns active employees exclusively from the Employee database.
    Zero candidates, verify applicants, or external users are ever returned.
    """
    query = (
        select(Employee, User)
        .join(User, Employee.user_id == User.id)
        .where(
            Employee.org_id == current_user.org_id,
            Employee.status != EmployeeStatus.exited,
            Employee.status != EmployeeStatus.offboarded,
        )
    )

    # If manager role, prioritize their reporting team, or let them see all org employees if none
    if current_user.role.value == "manager":
        mgr_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        mgr_emp = mgr_res.scalar_one_or_none()
        if mgr_emp:
            # Check if has direct reports
            sub_count = await db.execute(
                select(func.count(Employee.id)).where(Employee.manager_id == mgr_emp.id)
            )
            if (sub_count.scalar() or 0) > 0:
                query = query.where(Employee.manager_id == mgr_emp.id)

    if department:
        query = query.where(Employee.department == department)

    query = query.order_by(User.full_name.asc())
    res = await db.execute(query)
    rows = res.all()

    # If course_id provided, check existing enrollments
    enrolled_user_ids = set()
    if course_id:
        enroll_res = await db.execute(
            select(Enrollment.user_id).where(Enrollment.course_id == course_id)
        )
        enrolled_user_ids = {r for r in enroll_res.scalars()}

    employees_data = []
    for emp, u in rows:
        employees_data.append({
            "employee_id": emp.id,
            "user_id": u.id,
            "employee_code": emp.emp_id or f"EMP-{emp.id:04d}",
            "name": u.full_name or u.email,
            "email": u.email,
            "department": emp.department or "General",
            "designation": emp.designation or "Employee",
            "status": emp.status.value if hasattr(emp.status, "value") else str(emp.status),
            "is_enrolled": u.id in enrolled_user_ids,
        })

    return success(employees_data)


# ── Bulk Assign Course ───────────────────────────────────────────────────────

class CourseAssignRequest(BaseModel):
    employee_ids: List[int]
    deadline: Optional[str] = None  # ISO format string


@router.post("/courses/{course_id}/assign")
async def assign_course_to_employees(
    course_id: int,
    body: CourseAssignRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    course_res = await db.execute(
        select(Course)
        .options(selectinload(Course.domain))
        .where(Course.id == course_id, Course.org_id == current_user.org_id)
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not body.employee_ids:
        raise HTTPException(status_code=400, detail="Please select at least one employee.")

    emp_res = await db.execute(
        select(Employee, User)
        .join(User, Employee.user_id == User.id)
        .where(
            Employee.id.in_(body.employee_ids),
            Employee.org_id == current_user.org_id,
        )
    )
    employees = emp_res.all()

    deadline_dt = None
    deadline_str_formatted = None
    if body.deadline:
        try:
            deadline_dt = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
            deadline_str_formatted = deadline_dt.strftime("%B %d, %Y")
        except Exception:
            deadline_dt = None

    assigned_count = 0
    skipped_count = 0
    notifications_to_send = []

    domain_name = course.domain.name if course.domain else (course.category or "General")

    for emp, u in employees:
        existing = await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == u.id,
                Enrollment.course_id == course_id,
            )
        )
        if existing.scalar_one_or_none():
            skipped_count += 1
            continue

        enrollment = Enrollment(
            user_id=u.id,
            employee_id=emp.id,
            course_id=course_id,
            triggered_by=EnrollmentTrigger.manual,
            progress_percent=0.0,
            status="not_started",
            deadline=deadline_dt,
            assigned_by_id=current_user.id,
        )
        db.add(enrollment)
        assigned_count += 1
        notifications_to_send.append((u.email, u.full_name or u.email))

    await db.commit()

    # Dispatch transactional assignment emails in background
    for to_email, emp_name in notifications_to_send:
        background_tasks.add_task(
            send_course_assignment_notification_email,
            to_email=to_email,
            candidate_name=emp_name,
            course_title=course.title,
            deadline=deadline_str_formatted,
            difficulty=course.difficulty.value if hasattr(course.difficulty, "value") else str(course.difficulty),
            estimated_hours=float(course.estimated_hours) if course.estimated_hours else None,
            domain_name=domain_name,
        )

    return success({
        "assigned": assigned_count,
        "skipped": skipped_count,
        "total_selected": len(body.employee_ids),
    }, f"Successfully assigned course to {assigned_count} employee(s).")


# ── Course Details & SCORM Player ────────────────────────────────────────────

@router.get("/courses/{course_id}")
async def get_course_details(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    course_res = await db.execute(
        select(Course)
        .options(selectinload(Course.domain))
        .where(Course.id == course_id)
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check user enrollment
    enroll_res = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id,
        )
    )
    enrollment = enroll_res.scalar_one_or_none()

    # Check certificate if completed
    cert_res = await db.execute(
        select(Certificate).where(
            Certificate.user_id == current_user.id,
            Certificate.course_id == course_id,
        )
    )
    cert = cert_res.scalar_one_or_none()

    return success({
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "difficulty": course.difficulty.value if hasattr(course.difficulty, "value") else str(course.difficulty),
        "category": course.category,
        "domain_id": course.domain_id,
        "domain_name": course.domain.name if course.domain else course.category,
        "domain_color": course.domain.color if course.domain else "#7C3AED",
        "estimated_hours": float(course.estimated_hours) if course.estimated_hours else None,
        "is_scorm": course.is_scorm,
        "scorm_entry_url": course.scorm_entry_url,
        "scorm_version": course.scorm_version,
        "scorm_mastery_score": float(course.scorm_mastery_score or 70.0),
        "status": course.status.value if hasattr(course.status, "value") else str(course.status),
        "enrollment": {
            "id": enrollment.id,
            "progress_percent": float(enrollment.progress_percent or 0.0),
            "score": float(enrollment.score) if enrollment.score is not None else None,
            "status": enrollment.status or "not_started",
            "scorm_location": enrollment.scorm_location,
            "scorm_suspend_data": enrollment.scorm_suspend_data,
            "deadline": enrollment.deadline.isoformat() if enrollment.deadline else None,
            "last_accessed_at": enrollment.last_accessed_at.isoformat() if enrollment.last_accessed_at else None,
            "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
        } if enrollment else None,
        "certificate": {
            "id": cert.id,
            "verification_code": cert.verification_code,
            "pdf_url": cert.pdf_url,
            "issued_at": cert.issued_at.isoformat(),
        } if cert else None,
    })


# ── SCORM Bookmark & Real-time Progress Sync ─────────────────────────────────

class ScormProgressSync(BaseModel):
    scorm_location: Optional[str] = None
    scorm_suspend_data: Optional[str] = None
    score: Optional[float] = None
    progress_percent: Optional[float] = None
    status: Optional[str] = None  # completed, passed, incomplete, failed, in_progress


@router.post("/courses/{course_id}/progress")
async def sync_scorm_progress(
    course_id: int,
    body: ScormProgressSync,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    enroll_res = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id,
        )
    )
    enrollment = enroll_res.scalar_one_or_none()
    if not enrollment:
        # Auto-enroll if not enrolled yet
        emp_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        emp = emp_res.scalar_one_or_none()
        enrollment = Enrollment(
            user_id=current_user.id,
            employee_id=emp.id if emp else None,
            course_id=course_id,
            triggered_by=EnrollmentTrigger.manual,
            progress_percent=0.0,
            status="in_progress",
        )
        db.add(enrollment)
        await db.flush()

    # Update bookmark & suspend data
    if body.scorm_location is not None:
        enrollment.scorm_location = str(body.scorm_location)[:255]
    if body.scorm_suspend_data is not None:
        enrollment.scorm_suspend_data = str(body.scorm_suspend_data)

    if body.score is not None:
        enrollment.score = max(0.0, min(100.0, float(body.score)))

    # Compute progress %
    new_progress = float(enrollment.progress_percent or 0.0)
    if body.progress_percent is not None:
        new_progress = max(new_progress, min(100.0, float(body.progress_percent)))

    status_str = (body.status or "").strip().lower()
    is_completed = (
        status_str in {"completed", "passed", "complete", "success"}
        or new_progress >= 100.0
        or (body.score is not None and float(course.scorm_mastery_score or 70.0) <= float(body.score))
    )

    enrollment.last_accessed_at = datetime.utcnow()

    was_completed = enrollment.completed_at is not None

    if is_completed:
        enrollment.status = "completed"
        enrollment.progress_percent = 100.0
        if not was_completed:
            now = datetime.utcnow()
            enrollment.completed_at = now
            enrollment.completion_date = now

            # 1. Inline certificate generation
            try:
                await _generate_certificate_inline(enrollment.id, current_user.id, db)
            except Exception as e:
                logger.warning(f"Certificate generation error: {e}")

            # 2. Email employee congratulating them on completion with score
            completion_date_str = now.strftime("%B %d, %Y")
            background_tasks.add_task(
                send_course_completion_congratulations_email,
                to_email=current_user.email,
                employee_name=current_user.full_name or current_user.email,
                course_title=course.title,
                score=float(enrollment.score) if enrollment.score is not None else None,
                completion_date=completion_date_str,
            )
    else:
        enrollment.progress_percent = round(new_progress, 1)
        if enrollment.status == "not_started":
            enrollment.status = "in_progress"

    # Also sync section learning progress for legacy section progress tracker
    sec_res = await db.execute(select(CourseSection).where(CourseSection.course_id == course_id).limit(1))
    sec = sec_res.scalar_one_or_none()
    if sec:
        lp_res = await db.execute(
            select(LearningProgress).where(
                LearningProgress.enrollment_id == enrollment.id,
                LearningProgress.section_id == sec.id,
            )
        )
        lp = lp_res.scalar_one_or_none()
        if not lp:
            lp = LearningProgress(enrollment_id=enrollment.id, section_id=sec.id)
            db.add(lp)
        lp.progress_percent = enrollment.progress_percent
        lp.completed = is_completed
        lp.scorm_location = enrollment.scorm_location
        lp.scorm_suspend_data = enrollment.scorm_suspend_data
        lp.scorm_score = enrollment.score
        lp.scorm_status = enrollment.status
        lp.last_scorm_commit_at = datetime.utcnow()
        if is_completed and not lp.completed_at:
            lp.completed_at = datetime.utcnow()

    await db.commit()

    return success({
        "progress_percent": float(enrollment.progress_percent),
        "status": enrollment.status,
        "scorm_location": enrollment.scorm_location,
        "completed": is_completed,
    }, "SCORM progress and bookmark synced")


# ── Learner Portal: My Learning ──────────────────────────────────────────────

@router.get("/my-learning")
async def get_my_learning(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Enrollment, Course, CourseDomain)
        .join(Course, Course.id == Enrollment.course_id)
        .outerjoin(CourseDomain, CourseDomain.id == Course.domain_id)
        .where(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.last_accessed_at.desc().nullslast(), Enrollment.created_at.desc())
    )
    res = await db.execute(query)
    rows = res.all()

    continue_learning = None
    in_progress = []
    completed = []
    assigned_not_started = []

    for enroll, course, domain in rows:
        item = {
            "enrollment_id": enroll.id,
            "course_id": course.id,
            "title": course.title,
            "description": course.description,
            "domain_id": course.domain_id,
            "domain_name": domain.name if domain else (course.category or "General"),
            "domain_color": domain.color if domain else "#7C3AED",
            "difficulty": course.difficulty.value if hasattr(course.difficulty, "value") else str(course.difficulty),
            "estimated_hours": float(course.estimated_hours) if course.estimated_hours else None,
            "scorm_entry_url": course.scorm_entry_url,
            "progress_percent": float(enroll.progress_percent or 0.0),
            "score": float(enroll.score) if enroll.score is not None else None,
            "status": enroll.status or "not_started",
            "scorm_location": enroll.scorm_location,
            "deadline": enroll.deadline.isoformat() if enroll.deadline else None,
            "is_overdue": bool(enroll.deadline and enroll.deadline < datetime.utcnow() and not enroll.completed_at),
            "last_accessed_at": enroll.last_accessed_at.isoformat() if enroll.last_accessed_at else None,
            "completed_at": enroll.completed_at.isoformat() if enroll.completed_at else None,
        }

        if enroll.completed_at:
            completed.append(item)
        elif enroll.status == "in_progress" or (enroll.progress_percent and enroll.progress_percent > 0):
            in_progress.append(item)
            if not continue_learning:
                continue_learning = item
        else:
            assigned_not_started.append(item)

    # Fetch user's certificates
    certs_res = await db.execute(
        select(Certificate, Course)
        .join(Course, Course.id == Certificate.course_id)
        .where(Certificate.user_id == current_user.id)
        .order_by(Certificate.issued_at.desc())
    )
    certs_data = [{
        "id": cert.id,
        "course_title": c.title,
        "verification_code": cert.verification_code,
        "pdf_url": cert.pdf_url,
        "issued_at": cert.issued_at.isoformat(),
    } for cert, c in certs_res.all()]

    return success({
        "continue_learning": continue_learning or (assigned_not_started[0] if assigned_not_started else None),
        "in_progress": in_progress,
        "completed": completed,
        "assigned": assigned_not_started,
        "certificates": certs_data,
        "stats": {
            "total_assigned": len(rows),
            "in_progress_count": len(in_progress),
            "completed_count": len(completed),
            "certificates_count": len(certs_data),
        }
    })


# ── Course Library ───────────────────────────────────────────────────────────

@router.get("/library")
async def course_library(
    q: Optional[str] = Query(None),
    domain_id: Optional[int] = Query(None),
    difficulty: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Course, CourseDomain)
        .outerjoin(CourseDomain, CourseDomain.id == Course.domain_id)
        .where(
            Course.org_id == current_user.org_id,
            Course.status == CourseStatus.published,
        )
    )

    if q:
        query = query.where(or_(
            Course.title.ilike(f"%{q}%"),
            Course.description.ilike(f"%{q}%")
        ))
    if domain_id:
        query = query.where(Course.domain_id == domain_id)
    if difficulty:
        query = query.where(Course.difficulty == difficulty)

    count_q = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_q)
    total = total_res.scalar() or 0

    query = query.order_by(Course.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    # Check user enrollment in these courses
    course_ids = [c.id for c, _ in rows]
    user_enrollments = {}
    if course_ids:
        enroll_res = await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id.in_(course_ids),
            )
        )
        for e in enroll_res.scalars().all():
            user_enrollments[e.course_id] = {
                "enrollment_id": e.id,
                "progress_percent": float(e.progress_percent or 0.0),
                "status": e.status,
                "completed": bool(e.completed_at),
                "scorm_location": e.scorm_location,
            }

    courses_data = []
    for c, domain in rows:
        enroll_info = user_enrollments.get(c.id)
        courses_data.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "domain_id": c.domain_id,
            "domain_name": domain.name if domain else (c.category or "General"),
            "domain_color": domain.color if domain else "#7C3AED",
            "difficulty": c.difficulty.value if hasattr(c.difficulty, "value") else str(c.difficulty),
            "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
            "thumbnail_url": c.thumbnail_url,
            "is_scorm": c.is_scorm,
            "scorm_version": c.scorm_version,
            "enrolled": enroll_info is not None,
            "enrollment": enroll_info,
            "created_at": c.created_at.isoformat(),
        })

    return success({
        "courses": courses_data,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total else 1,
    })


# ── Update & Delete Course ───────────────────────────────────────────────────

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    domain_id: Optional[int] = None
    difficulty: Optional[str] = None
    estimated_hours: Optional[float] = None
    pass_score: Optional[float] = None


@router.put("/courses/{course_id}")
async def update_course(
    course_id: int,
    body: CourseUpdate,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Course).where(Course.id == course_id, Course.org_id == current_user.org_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if body.title is not None:
        course.title = body.title.strip()
    if body.description is not None:
        course.description = body.description
    if body.domain_id is not None:
        course.domain_id = body.domain_id
    if body.difficulty is not None:
        course.difficulty = _safe_course_difficulty(body.difficulty)
    if body.estimated_hours is not None:
        course.estimated_hours = body.estimated_hours
    if body.pass_score is not None:
        course.scorm_mastery_score = body.pass_score

    await db.commit()
    return success({"id": course.id}, "Course updated")


@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: int,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "instructor", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Course).where(Course.id == course_id, Course.org_id == current_user.org_id))
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_title = course.title

    # Clean up files on disk if scorm_package_path exists
    if course.scorm_package_path:
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
        package_disk_path = os.path.join(upload_dir, *course.scorm_package_path.split("/"))
        if os.path.exists(package_disk_path):
            try:
                shutil.rmtree(package_disk_path, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Could not remove package path {package_disk_path}: {e}")

    # Remove all dependencies in strict order to prevent foreign key violations
    enrollment_ids_res = await db.execute(select(Enrollment.id).where(Enrollment.course_id == course_id))
    enrollment_ids = [r[0] for r in enrollment_ids_res.fetchall()]

    section_ids_res = await db.execute(select(CourseSection.id).where(CourseSection.course_id == course_id))
    section_ids = [r[0] for r in section_ids_res.fetchall()]

    if enrollment_ids:
        await db.execute(delete(LearningProgress).where(LearningProgress.enrollment_id.in_(enrollment_ids)))
    if section_ids:
        await db.execute(delete(LearningProgress).where(LearningProgress.section_id.in_(section_ids)))
        await db.execute(delete(SectionQuiz).where(SectionQuiz.section_id.in_(section_ids)))

    await db.execute(delete(Certificate).where(Certificate.course_id == course_id))
    await db.execute(delete(Enrollment).where(Enrollment.course_id == course_id))
    await db.execute(delete(CourseSection).where(CourseSection.course_id == course_id))
    await db.delete(course)
    await db.commit()

    return success(message=f"Course '{course_title}' deleted successfully")


# ── Executive Analytics Overview ─────────────────────────────────────────────

@router.get("/analytics/overview")
async def get_analytics_overview(
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Executive Analytics Dashboard:
    - High-level KPIs (Total Courses, Total Enrolled, Completed, Avg Score, Overdue)
    - Top Learners Leaderboard
    - Course-by-course breakdown with status counts
    """
    now = datetime.utcnow()

    # 1. Total published courses
    courses_query = (
        select(Course, CourseDomain)
        .outerjoin(CourseDomain, CourseDomain.id == Course.domain_id)
        .where(Course.org_id == current_user.org_id)
        .order_by(Course.title.asc())
    )
    courses_res = await db.execute(courses_query)
    all_courses = courses_res.all()
    total_courses = len(all_courses)

    # 2. Enrollments in this organization
    enroll_query = (
        select(Enrollment, Course, User, Employee)
        .join(Course, Course.id == Enrollment.course_id)
        .join(User, User.id == Enrollment.user_id)
        .outerjoin(Employee, Employee.id == Enrollment.employee_id)
        .where(Course.org_id == current_user.org_id)
    )

    if current_user.role.value == "manager":
        mgr_res = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
        mgr = mgr_res.scalar_one_or_none()
        if mgr:
            sub_count = await db.execute(
                select(func.count(Employee.id)).where(Employee.manager_id == mgr.id)
            )
            if (sub_count.scalar() or 0) > 0:
                enroll_query = enroll_query.where(Employee.manager_id == mgr.id)

    enroll_res = await db.execute(enroll_query)
    all_enrollments = enroll_res.all()

    total_enrollments = len(all_enrollments)
    completed_enrollments = [e for e, _, _, _ in all_enrollments if e.completed_at is not None]
    in_progress_enrollments = [e for e, _, _, _ in all_enrollments if not e.completed_at and (e.progress_percent or 0) > 0]
    overdue_enrollments = [
        e for e, _, _, _ in all_enrollments
        if e.deadline and e.deadline < now and not e.completed_at
    ]

    scores = [float(e.score) for e, _, _, _ in all_enrollments if e.score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    completion_rate = (
        round((len(completed_enrollments) / total_enrollments) * 100, 1)
        if total_enrollments > 0
        else 0.0
    )

    # 3. Top Learners Leaderboard
    learner_map = {}
    for enroll, course, user, emp in all_enrollments:
        uid = user.id
        if uid not in learner_map:
            learner_map[uid] = {
                "user_id": uid,
                "employee_id": emp.id if emp else None,
                "employee_code": (emp.emp_id or f"EMP-{emp.id:04d}") if emp else "EMP",
                "name": user.full_name or user.email,
                "email": user.email,
                "department": emp.department if emp else "General",
                "designation": emp.designation if emp else "Employee",
                "enrolled_count": 0,
                "completed_count": 0,
                "total_score": 0.0,
                "score_count": 0,
                "last_active": None,
            }
        l = learner_map[uid]
        l["enrolled_count"] += 1
        if enroll.completed_at:
            l["completed_count"] += 1
        if enroll.score is not None:
            l["total_score"] += float(enroll.score)
            l["score_count"] += 1
        if enroll.last_accessed_at:
            if not l["last_active"] or enroll.last_accessed_at > l["last_active"]:
                l["last_active"] = enroll.last_accessed_at

    top_learners = []
    for l in learner_map.values():
        avg_s = round(l["total_score"] / l["score_count"], 1) if l["score_count"] > 0 else None
        top_learners.append({
            "user_id": l["user_id"],
            "employee_id": l["employee_id"],
            "employee_code": l["employee_code"],
            "name": l["name"],
            "email": l["email"],
            "department": l["department"],
            "designation": l["designation"],
            "enrolled_count": l["enrolled_count"],
            "completed_count": l["completed_count"],
            "avg_score": avg_s,
            "last_active": l["last_active"].isoformat() if l["last_active"] else None,
        })
    # Sort top learners by completed_count desc, avg_score desc
    top_learners.sort(key=lambda x: (x["completed_count"], x["avg_score"] or 0), reverse=True)

    # 4. Course-by-course breakdown
    course_stats_map = {}
    for c, domain in all_courses:
        course_stats_map[c.id] = {
            "id": c.id,
            "title": c.title,
            "domain_id": c.domain_id,
            "domain_name": domain.name if domain else (c.category or "General"),
            "domain_color": domain.color if domain else "#7C3AED",
            "difficulty": c.difficulty.value if hasattr(c.difficulty, "value") else str(c.difficulty),
            "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
            "assigned_count": 0,
            "completed_count": 0,
            "in_progress_count": 0,
            "overdue_count": 0,
            "scores": [],
            "progress_list": [],
        }

    for enroll, course, user, emp in all_enrollments:
        if course.id in course_stats_map:
            cs = course_stats_map[course.id]
            cs["assigned_count"] += 1
            if enroll.completed_at:
                cs["completed_count"] += 1
            elif (enroll.progress_percent or 0) > 0:
                cs["in_progress_count"] += 1
            if enroll.deadline and enroll.deadline < now and not enroll.completed_at:
                cs["overdue_count"] += 1
            if enroll.score is not None:
                cs["scores"].append(float(enroll.score))
            if enroll.progress_percent is not None:
                cs["progress_list"].append(float(enroll.progress_percent))

    courses_breakdown = []
    for cs in course_stats_map.values():
        c_scores = cs["scores"]
        c_prog = cs["progress_list"]
        courses_breakdown.append({
            "id": cs["id"],
            "title": cs["title"],
            "domain_id": cs["domain_id"],
            "domain_name": cs["domain_name"],
            "domain_color": cs["domain_color"],
            "difficulty": cs["difficulty"],
            "estimated_hours": cs["estimated_hours"],
            "assigned_count": cs["assigned_count"],
            "completed_count": cs["completed_count"],
            "in_progress_count": cs["in_progress_count"],
            "overdue_count": cs["overdue_count"],
            "avg_score": round(sum(c_scores) / len(c_scores), 1) if c_scores else None,
            "avg_progress": round(sum(c_prog) / len(c_prog), 1) if c_prog else 0.0,
            "completion_rate": round((cs["completed_count"] / cs["assigned_count"]) * 100, 1) if cs["assigned_count"] > 0 else 0.0,
        })

    return success({
        "kpis": {
            "total_courses": total_courses,
            "total_enrollments": total_enrollments,
            "completed_enrollments": len(completed_enrollments),
            "in_progress_enrollments": len(in_progress_enrollments),
            "overdue_enrollments": len(overdue_enrollments),
            "completion_rate": completion_rate,
            "avg_score": avg_score,
        },
        "top_learners": top_learners[:20],
        "courses_breakdown": courses_breakdown,
    })


# ── Course-by-Course Drilldown Roster ────────────────────────────────────────

@router.get("/analytics/courses/{course_id}")
async def get_course_analytics_drilldown(
    course_id: int,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    course_res = await db.execute(
        select(Course)
        .options(selectinload(Course.domain))
        .where(Course.id == course_id, Course.org_id == current_user.org_id)
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    query = (
        select(Enrollment, User, Employee)
        .join(User, User.id == Enrollment.user_id)
        .outerjoin(Employee, Employee.id == Enrollment.employee_id)
        .where(Enrollment.course_id == course_id)
        .order_by(Enrollment.progress_percent.desc(), Enrollment.created_at.desc())
    )
    res = await db.execute(query)
    rows = res.all()

    now = datetime.utcnow()
    roster = []
    for enroll, user, emp in rows:
        is_overdue = bool(enroll.deadline and enroll.deadline < now and not enroll.completed_at)
        roster.append({
            "enrollment_id": enroll.id,
            "user_id": user.id,
            "employee_id": emp.id if emp else None,
            "employee_code": (emp.emp_id or f"EMP-{emp.id:04d}") if emp else "EMP",
            "name": user.full_name or user.email,
            "email": user.email,
            "department": emp.department if emp else "General",
            "designation": emp.designation if emp else "Employee",
            "progress_percent": float(enroll.progress_percent or 0.0),
            "score": float(enroll.score) if enroll.score is not None else None,
            "status": enroll.status or "not_started",
            "scorm_location": enroll.scorm_location,
            "deadline": enroll.deadline.isoformat() if enroll.deadline else None,
            "is_overdue": is_overdue,
            "last_accessed_at": enroll.last_accessed_at.isoformat() if enroll.last_accessed_at else None,
            "completed_at": enroll.completed_at.isoformat() if enroll.completed_at else None,
            "enrolled_at": enroll.created_at.isoformat() if enroll.created_at else None,
        })

    return success({
        "course": {
            "id": course.id,
            "title": course.title,
            "domain_name": course.domain.name if course.domain else (course.category or "General"),
            "domain_color": course.domain.color if course.domain else "#7C3AED",
            "scorm_version": course.scorm_version,
            "difficulty": course.difficulty.value if hasattr(course.difficulty, "value") else str(course.difficulty),
            "estimated_hours": float(course.estimated_hours) if course.estimated_hours else None,
        },
        "roster": roster,
        "total_enrolled": len(roster),
    })


# ── One-Click Deadline Nudge ─────────────────────────────────────────────────

class NudgeRequest(BaseModel):
    enrollment_id: int


@router.post("/analytics/nudge")
async def nudge_employee_deadline(
    body: NudgeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["org_admin", "hr", "manager", "super_admin"])),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Enrollment, Course, User)
        .join(Course, Course.id == Enrollment.course_id)
        .join(User, User.id == Enrollment.user_id)
        .where(Enrollment.id == body.enrollment_id, Course.org_id == current_user.org_id)
    )
    res = await db.execute(query)
    row = res.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    enroll, course, user = row
    if enroll.completed_at:
        return success(message="Course is already completed by the employee.")

    deadline_str = enroll.deadline.strftime("%B %d, %Y") if enroll.deadline else "Soon"
    progress = float(enroll.progress_percent or 0.0)

    background_tasks.add_task(
        send_course_deadline_reminder_email,
        to_email=user.email,
        employee_name=user.full_name or user.email,
        course_title=course.title,
        deadline=deadline_str,
        progress_percent=progress,
    )

    return success(message=f"Reminder email sent to {user.full_name or user.email}")


# ── Employee Profile Learning Tab Integration ────────────────────────────────

@router.get("/employee-courses/{employee_id}")
async def get_employee_courses_for_profile(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns learning transcript & course status for the Employee Profile page.
    """
    emp_res = await db.execute(select(Employee).where(Employee.id == employee_id, Employee.org_id == current_user.org_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    query = (
        select(Enrollment, Course, CourseDomain)
        .join(Course, Course.id == Enrollment.course_id)
        .outerjoin(CourseDomain, CourseDomain.id == Course.domain_id)
        .where(Enrollment.user_id == emp.user_id)
        .order_by(Enrollment.created_at.desc())
    )
    res = await db.execute(query)
    rows = res.all()

    now = datetime.utcnow()
    courses_data = []
    for enroll, course, domain in rows:
        courses_data.append({
            "enrollment_id": enroll.id,
            "course_id": course.id,
            "title": course.title,
            "domain_name": domain.name if domain else (course.category or "General"),
            "domain_color": domain.color if domain else "#7C3AED",
            "progress_percent": float(enroll.progress_percent or 0.0),
            "score": float(enroll.score) if enroll.score is not None else None,
            "status": enroll.status or "not_started",
            "deadline": enroll.deadline.isoformat() if enroll.deadline else None,
            "is_overdue": bool(enroll.deadline and enroll.deadline < now and not enroll.completed_at),
            "completed_at": enroll.completed_at.isoformat() if enroll.completed_at else None,
            "last_accessed_at": enroll.last_accessed_at.isoformat() if enroll.last_accessed_at else None,
        })

    # Certificates
    certs_res = await db.execute(
        select(Certificate, Course)
        .join(Course, Course.id == Certificate.course_id)
        .where(Certificate.user_id == emp.user_id)
        .order_by(Certificate.issued_at.desc())
    )
    certs_data = [{
        "id": cert.id,
        "course_title": c.title,
        "verification_code": cert.verification_code,
        "pdf_url": cert.pdf_url,
        "issued_at": cert.issued_at.isoformat(),
    } for cert, c in certs_res.all()]

    return success({
        "employee_id": emp.id,
        "courses": courses_data,
        "certificates": certs_data,
        "total_assigned": len(courses_data),
        "total_completed": len([c for c in courses_data if c["completed_at"]]),
    })


# ── Public Certificate Verification ──────────────────────────────────────────

@router.get("/verify-certificate/{code}")
async def verify_certificate(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Certificate, Course, User)
        .join(Course, Course.id == Certificate.course_id)
        .join(User, User.id == Certificate.user_id)
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
        "pdf_url": cert.pdf_url,
    })
