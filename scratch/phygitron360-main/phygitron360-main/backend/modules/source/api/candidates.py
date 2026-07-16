"""
Phygitron 360 — Source Module: Candidates API
===============================================
Handles resume upload, candidate management, AI parsing, offer letter generation,
and ATS scoring for the Talent Vault (Source) module.
"""
import json
import os
import uuid
import logging
from typing import List, Optional, Any
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os

from backend.core.database import DATA_DIR
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.source.services.candidate_service import CandidateService
from backend.core.email_service_extended import send_generic_notification_email
from backend.modules.deploy.repositories.notification_repo import NotificationRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/source/candidates", tags=["Source - Candidates"])

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ManualCandidateCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: float = 0
    current_designation: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    primary_skills: Optional[List[str]] = []
    secondary_skills: Optional[List[str]] = []


class CandidateUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: Optional[float] = None
    current_designation: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    ai_summary: Optional[str] = None
    certifications: Optional[List[Any]] = None
    experience: Optional[List[dict]] = None
    education: Optional[List[dict]] = None
    primary_skills: Optional[List[str]] = None
    secondary_skills: Optional[List[str]] = None


class StatusUpdate(BaseModel):
    status: str
    role_id: Optional[int] = None


class NoteCreate(BaseModel):
    content: str


class OfferPreviewRequest(BaseModel):
    salary: str
    role_title: str
    department: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None


class ConvertRequest(BaseModel):
    salary: str
    role_title: str
    department: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    offer_content: Optional[dict] = None

class NotificationRequest(BaseModel):
    subject: str
    message: str


# ---------------------------------------------------------------------------
def get_candidate_service(user=Depends(get_current_user)):
    return CandidateService(tenant_id=user.get('tenant_id', 'public'))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    service: CandidateService = Depends(get_candidate_service)
):
    """Upload a single resume PDF/DOCX/TXT and run AI parse pipeline."""
    allowed_exts = (".pdf", ".docx", ".doc", ".txt")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(allowed_exts)}")

    try:
        content = await file.read()
        result = await service.process_and_save_resume(content, file.filename)
        return {
            "success": True,
            "message": "Resume uploaded and parsed successfully",
            "data": result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"Resume upload failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


@router.post("/bulk-upload")
async def bulk_upload_resumes(
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Process multiple resume files at once. Returns a job ID to track progress."""
    import tempfile
    import shutil
    import os
    
    files_data = []
    temp_dir = tempfile.mkdtemp(prefix="bulk_upload_")
    
    try:
        for f in files:
            temp_path = os.path.join(temp_dir, f.filename)
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            files_data.append((f.filename, temp_path))
            
        result = await service.bulk_upload_resumes(files_data, user.get("id"), temp_dir)
        return {
            "success": True,
            "data": result,
            "message": result.get("message", "Bulk upload queued.")
        }
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise e

@router.get("/bulk-upload/active")
async def get_active_bulk_upload(
    service: CandidateService = Depends(get_candidate_service)
):
    """Get the currently active bulk upload job, if any."""
    job = service.repo.get_active_bulk_upload_job()
    if not job:
        return {"success": True, "data": None}
    
    progress = service.repo.get_bulk_upload_job_progress(job["id"])
    return {
        "success": True,
        "data": progress
    }

@router.get("/bulk-upload/{job_id}")
async def get_bulk_upload_status(
    job_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Get the progress of a bulk upload job."""
    progress = service.repo.get_bulk_upload_job_progress(job_id)
    if not progress["job"]:
        raise HTTPException(status_code=404, detail="Bulk upload job not found")
        
    return {
        "success": True,
        "data": progress
    }

@router.post("/bulk-upload/{job_id}/cancel")
async def cancel_bulk_upload(
    job_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Cancel a bulk upload job and stop further processing."""
    success = service.cancel_bulk_upload_job(job_id)
    return {
        "success": success,
        "message": "Job cancelled successfully."
    }


@router.post("/bulk-upload/{job_id}/pause")
async def pause_bulk_upload(
    job_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Pause a bulk upload job."""
    success = service.pause_bulk_upload_job(job_id)
    return {
        "success": success,
        "message": "Job paused successfully."
    }


@router.post("/bulk-upload/{job_id}/resume")
async def resume_bulk_upload(
    job_id: int, 
    user: dict = Depends(get_current_user)
):
    service = CandidateService(tenant_id=user.get("tenant_id"))
    success = service.resume_bulk_upload_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to resume bulk upload")
    return {"message": "Job resumed successfully"}

@router.post("/bulk-upload/{job_id}/retry-failed")
async def retry_failed_bulk_upload(
    job_id: int, 
    user: dict = Depends(get_current_user)
):
    service = CandidateService(tenant_id=user.get("tenant_id"))
    success = service.retry_failed_bulk_upload_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to retry bulk upload items")
    return {"message": "Failed items queued for retry"}


@router.post("/manual")
def create_manual_candidate(
    data: ManualCandidateCreate,
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Create a candidate record from a manual entry form (no resume)."""
    try:
        actor_name = current_user.get("name") or current_user.get("username")
        candidate_id = service.create_manual_candidate(data.dict(), actor_name)
        return {"success": True, "message": "Candidate created successfully", "data": {"candidate_id": candidate_id}}
    except Exception as exc:
        logger.error(f"Manual candidate creation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to create candidate: {str(exc)}")


@router.get("/search")
def search_candidates(
    pool: Optional[str] = Query(None),          # all, candidate, trainee, employee
    location: Optional[str] = Query(None),
    min_exp: Optional[float] = Query(None),
    exp_range: Optional[str] = Query(None),     # fresher, 1-2, 2-5, 5+
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("newest"),   # newest, experience
    role_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Advanced candidate search with optional ATS scoring against a job role."""
    try:
        results, total_count = service.search_candidates(
            pool=pool, location=location, min_exp=min_exp, exp_range=exp_range,
            search=search, sort_by=sort_by, role_id=role_id, limit=limit
        )
        return {"success": True, "data": results, "count": len(results), "total_count": total_count}
    except Exception as exc:
        logger.error(f"search_candidates failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/active")
def list_active_candidates(service: CandidateService = Depends(get_candidate_service)):
    """List active candidates (those that have first_login or employee-type status)."""
    try:
        rows = service.get_active_candidates()
        return {"success": True, "data": rows, "count": len(rows)}
    except Exception as exc:
        logger.error(f"Active candidates list failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/activity")
def get_global_activity(
    limit: int = Query(10, ge=1, le=100),
    service: CandidateService = Depends(get_candidate_service)
):
    """Get recent global activity logs across all candidates."""
    try:
        rows = service.get_global_activity(limit=limit)
        return {"success": True, "data": rows}
    except Exception as e:
        logger.error(f"Failed to get global activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-applications")
def get_my_applications(
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Fetch all candidate applications linked to the logged-in employee."""
    try:
        user_id = current_user.get("id")
        if not user_id:
            return []
            
        repo = service.repo
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                repo._set_search_path(cur)
                cur.execute("""
                    SELECT c.id, c.full_name, c.email, c.status, c.created_at,
                           ci.status as invite_status, ci.email_sent_at,
                           COALESCE(jr_inv.title, jr_app.title) as job_title,
                           COALESCE(jr_inv.id, jr_app.id) as job_id
                    FROM candidates c
                    LEFT JOIN candidate_invites ci ON ci.candidate_id = c.id
                    LEFT JOIN job_roles jr_inv ON ci.job_role_id = jr_inv.id
                    LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
                    LEFT JOIN job_roles jr_app ON ca.job_role_id = jr_app.id
                    WHERE c.user_id = %s
                    ORDER BY c.created_at DESC
                """, (user_id,))
                columns = [desc[0] for desc in cur.description]
                results = [dict(zip(columns, row)) for row in cur.fetchall()]
                
                for r in results:
                    if r["created_at"] and hasattr(r["created_at"], "isoformat"):
                        r["created_at"] = r["created_at"].isoformat()
                    if r["email_sent_at"] and hasattr(r["email_sent_at"], "isoformat"):
                        r["email_sent_at"] = r["email_sent_at"].isoformat()
                return results
        finally:
            conn.close()
    except Exception as exc:
        import traceback
        err_msg = f"get_my_applications failed: {exc}\n{traceback.format_exc()}"
        logger.error(err_msg)
        with open("/tmp/my_apps_error.log", "w") as f:
            f.write(err_msg)
        raise HTTPException(status_code=500, detail=err_msg)


@router.get("/{candidate_id}")
def get_candidate(
    candidate_id: int,
    role_id: Optional[int] = Query(None),
    service: CandidateService = Depends(get_candidate_service)
):
    """Full candidate profile with skills, notes, AI scores, and latest offer letter."""
    try:
        candidate = service.get_full_candidate_profile(candidate_id, role_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return {"success": True, "data": candidate}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"get_candidate failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/{candidate_id}")
def update_candidate(
    candidate_id: int,
    body: CandidateUpdate,
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Manually update candidate details and skill taxonomy mapping."""
    try:
        actor_name = current_user.get("name") or current_user.get("username")
        success = service.update_candidate(candidate_id, body.dict(exclude_unset=True), actor_name)
        if not success:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return {"success": True, "message": "Candidate updated successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to update candidate {candidate_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{candidate_id}/resume")
def get_candidate_resume(
    candidate_id: int, 
    service: CandidateService = Depends(get_candidate_service)
):
    """Download the candidate's stored resume file."""
    candidate = service.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    row = candidate

    if not row or not row["resume_path"]:
        raise HTTPException(status_code=404, detail="Resume not found")

    file_path = row["resume_path"]

    # If the resume is stored in S3, generate a pre-signed URL (bucket is private)
    if file_path.startswith("https://") or file_path.startswith("http://"):
        from fastapi.responses import RedirectResponse
        from backend.common.services.storage_service import generate_presigned_url
        presigned = generate_presigned_url(file_path, expiry_seconds=900)  # 15 min
        return RedirectResponse(url=presigned)

    # Local disk fallback
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume file missing from storage")

    return FileResponse(file_path, filename=os.path.basename(file_path))


@router.put("/{candidate_id}/status")
def update_status(
    candidate_id: int,
    body: StatusUpdate,
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Update a candidate's pipeline status."""
    updated = service.update_status(candidate_id, body.status, role_id=body.role_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found")

    author = current_user.get("name") or current_user.get("username")
    service.repo.log_activity(candidate_id, author, "status_changed", f"Status changed to {body.status}")
    return {"success": True, "message": "Status updated successfully"}


@router.post("/{candidate_id}/notes")
def add_note(
    candidate_id: int,
    body: NoteCreate,
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Add a note to the candidate's timeline."""
    author = current_user.get("name") or current_user.get("username")
    note = service.add_note(candidate_id, author, body.content)
    return {"success": True, "data": note}


@router.post("/{candidate_id}/offer-preview")
async def offer_preview(
    candidate_id: int,
    body: OfferPreviewRequest,
    user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """
    Generate an AI offer letter preview for a candidate.
    Does NOT persist — returns content only.
    """
    tenant_id = user.get("tenant_id", "public")
    company = tenant_id.replace("tenant_", "").upper() if tenant_id != "public" else "Phygitron 360"
    
    hiring_details = {
        "role_title": body.role_title,
        "salary": body.salary,
        "department": body.department,
        "location": body.location,
        "start_date": body.start_date,
        "company": company,
    }
    
    preview = await service.generate_offer_preview(candidate_id, hiring_details)
    if not preview:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {"success": True, "data": {"offer_content": preview}}


@router.post("/{candidate_id}/convert")
async def convert_to_offer(
    candidate_id: int,
    body: ConvertRequest,
    user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """
    Create an offer letter (starts in 'pending' status).
    Moves candidate to 'Offered' status.
    """
    tenant_id = user.get("tenant_id", "public")
    company = tenant_id.replace("tenant_", "").upper() if tenant_id != "public" else "Phygitron 360"
    
    hiring_details = {
        "role_title": body.role_title,
        "salary": body.salary,
        "department": body.department,
        "location": body.location,
        "start_date": body.start_date,
        "company": company
    }
    
    try:
        await service.convert_to_offer(candidate_id, hiring_details, body.offer_content)
        return {"success": True, "message": "Offer letter created"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"convert_to_offer failed for candidate {candidate_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Permanently delete a candidate and all related records."""
    try:
        deleted = service.delete_candidate(candidate_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return {"success": True, "message": "Candidate deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"delete_candidate({candidate_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

class BulkDeleteRequest(BaseModel):
    candidate_ids: List[int]

@router.post("/bulk-delete")
def bulk_delete_candidates(
    req: BulkDeleteRequest,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Delete multiple candidates at once."""
    try:
        deleted_count = service.bulk_delete_candidates(req.candidate_ids)
        return {"success": True, "message": f"{deleted_count} candidates deleted", "deleted_count": deleted_count}
    except Exception as exc:
        logger.error(f"bulk_delete_candidates failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/{candidate_id}/notify")
def notify_candidate(
    candidate_id: int,
    payload: NotificationRequest,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Send a custom HR notification to a candidate/trainee."""
    try:
        candidate = service.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        user_id = candidate.get("user_id")
        email = candidate.get("email")
        full_name = candidate.get("full_name") or "Candidate"
        company_name = current_user.get("company_name", "Phygitron 360")
        tenant_id = current_user.get("tenant_id", "public")

        if not email:
            raise HTTPException(status_code=400, detail="Candidate does not have an email address.")
        
        # 1. Send Email
        sent = send_generic_notification_email(
            to_email=email,
            candidate_name=full_name,
            notification_subject=payload.subject,
            notification_message=payload.message,
            company_name=company_name
        )
        if not sent:
            raise HTTPException(status_code=500, detail="Failed to dispatch email.")

        # 2. Save Notification to Database
        if user_id:
            repo = NotificationRepository()
            repo.create_notification(
                employee_code=None,
                user_id=user_id,
                title=payload.subject,
                message=payload.message,
                n_type="CandidateUpdate",
                tenant_id=tenant_id
            )

        return {"success": True, "message": "Notification sent and logged."}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"notify_candidate({candidate_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))



# ---------------------------------------------------------------------------
# Employee revert (testing utility)
# ---------------------------------------------------------------------------

@router.post("/employees/{employee_id}/revert")
def revert_employee_to_candidate(
    employee_id: int,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """
    Revert an employee back to candidate status.
    Testing/correction utility — restores candidate status to 'New' and clears employee link.
    """
    try:
        reverted = service.revert_employee(employee_id)
        if not reverted:
            raise HTTPException(status_code=404, detail="Candidate/employee not found")
        return {"success": True, "message": "Reverted to candidate status", "data": {"candidate_id": employee_id}}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
