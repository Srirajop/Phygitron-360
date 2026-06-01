import os
import asyncio
import tempfile
import json
import logging
import hashlib
import zipfile
import uuid
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body, BackgroundTasks, Form
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, EmailStr
from app.database import get_db, AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.source import (
    Candidate, CandidateSkill, JobRole, CandidateInvite, CandidateStatus, 
    InviteStatus, OfferLetter, OfferStatus, BulkUploadJob, JobStatus
)
from app.models.ai_score import AIScore, EntityType, ScoreType
from app.models.skill_taxonomy import SkillTaxonomy
from app.models.organisation import Organisation
from app.models.deploy import Employee, EmployeeSkill, EmployeeStatus
from app.utils.auth import get_current_user, require_role, hash_password, generate_temp_password
from app.utils.s3 import upload_bytes_to_s3
from app.utils.pdf import extract_text_from_pdf, clean_extracted_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/source", tags=["Source"])

RESUME_PDF_SIZE_LIMIT_BYTES = 30 * 1024 * 1024
RESUME_ZIP_SIZE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024
RESUME_ZIP_CHUNK_SIZE = 4 * 1024 * 1024  # 4 MB chunks — faster I/O throughput
MAX_TRACKED_BULK_FILES = 100
IN_PROCESS_PARSE_WORKERS = 8             # was 4 — more parallel AI workers
DB_COMMIT_BATCH_SIZE = 50               # commit to DB every N resumes (not every 1)
DB_DETAIL_WRITE_EVERY = 10              # persist processed_details every N resumes
TEMP_UPLOAD_DIR = Path(tempfile.gettempdir()) / "phygitron360-source"
ALLOWED_PDF_MIME_TYPES = {"application/pdf", "application/x-pdf"}
ALLOWED_ZIP_MIME_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
    "multipart/x-zip",
}

_resume_parse_queue: asyncio.Queue | None = None
_resume_parse_workers: list[asyncio.Task] = []

# ── Per-job cancellation events ───────────────────────────────────────────────
# Maps job_id → asyncio.Event that is set when the job should stop immediately.
_job_cancel_events: dict[int, asyncio.Event] = {}


def _get_cancel_event(job_id: int) -> asyncio.Event:
    if job_id not in _job_cancel_events:
        _job_cancel_events[job_id] = asyncio.Event()
    return _job_cancel_events[job_id]


def _fire_cancel_event(job_id: int) -> None:
    """Signal the background task for job_id to stop immediately."""
    if job_id in _job_cancel_events:
        _job_cancel_events[job_id].set()


def _cleanup_cancel_event(job_id: int) -> None:
    _job_cancel_events.pop(job_id, None)


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


def _is_pdf_filename(filename: Optional[str]) -> bool:
    return str(filename or "").lower().endswith(".pdf")


def _is_zip_filename(filename: Optional[str]) -> bool:
    return str(filename or "").lower().endswith(".zip")


def _compute_resume_hash(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()


async def _save_large_upload_to_path(file: UploadFile, destination: Path, max_bytes: int) -> int:
    """Stream-save an upload to disk using a thread-pool for file I/O so the
    async event loop stays free to handle other HTTP requests during the upload."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    bytes_written = 0
    loop = asyncio.get_event_loop()

    try:
        handle = await loop.run_in_executor(None, lambda: open(destination, "wb"))
        try:
            while True:
                chunk = await file.read(RESUME_ZIP_CHUNK_SIZE)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"ZIP file size exceeds the {max_bytes // (1024 * 1024 * 1024)}GB limit",
                    )
                # Write in thread pool — never blocks the event loop
                await loop.run_in_executor(None, handle.write, chunk)
        finally:
            await loop.run_in_executor(None, handle.close)
    except Exception:
        if destination.exists():
            await loop.run_in_executor(None, destination.unlink)
        raise
    finally:
        await file.close()

    return bytes_written


async def _create_candidate_from_pdf_bytes(
    *,
    filename: str,
    pdf_bytes: bytes,
    org_id: int,
    db: AsyncSession,
    parse_inline: bool = True,
) -> tuple[Optional[Candidate], bool, str]:
    resume_hash = _compute_resume_hash(pdf_bytes)
    existing_candidate_res = await db.execute(
        select(Candidate).where(
            Candidate.org_id == org_id,
            Candidate.resume_hash == resume_hash,
        )
    )
    existing_candidate = existing_candidate_res.scalar_one_or_none()
    if existing_candidate:
        logger.info("Skipping duplicate resume %s for org %s", filename, org_id)
        return existing_candidate, False, ""

    try:
        extracted_text = extract_text_from_pdf(pdf_bytes)
        extracted_text = clean_extracted_text(extracted_text)
    except Exception as e:
        logger.warning(f"PDF text extraction failed for {filename}: {e}")
        extracted_text = ""

    email_stub = f"candidate_{uuid.uuid4().hex}@{org_id}.phygitron.local"
    display_name = Path(filename).stem.replace("_", " ").replace("-", " ").title()
    new_user = User(
        email=email_stub,
        password_hash=hash_password(generate_temp_password()),
        role=UserRole.candidate,
        org_id=org_id,
        first_login=True,
        full_name=display_name,
    )
    db.add(new_user)
    await db.flush()

    candidate = Candidate(
        user_id=new_user.id,
        org_id=org_id,
        resume_hash=resume_hash,
        status=CandidateStatus.invited,
    )
    db.add(candidate)
    await db.flush()

    safe_filename = Path(filename).name or f"resume-{candidate.id}.pdf"
    s3_key = f"{org_id}/resumes/{candidate.id}/{safe_filename}"
    try:
        resume_url = await upload_bytes_to_s3(pdf_bytes, s3_key, "application/pdf")
        candidate.resume_url = resume_url
    except Exception as e:
        logger.warning(f"S3 upload failed for {safe_filename}, using mock URL: {e}")
        candidate.resume_url = f"mock://{s3_key}"

    if parse_inline:
        await _parse_resume_inline(candidate.id, extracted_text, org_id, db)
    return candidate, True, extracted_text


def _serialize_bulk_job(job: BulkUploadJob, include_details: bool = True) -> dict:
    return {
        "id": job.id,
        "filename": job.filename,
        "total_files": job.total_files or 0,
        "processed_files": job.processed_files or 0,
        "processed_details": (job.processed_details or []) if include_details else [],
        "status": job.status.value if hasattr(job.status, "value") else str(job.status),
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


def _trim_job_details(details: list[dict]) -> list[dict]:
    if len(details) <= MAX_TRACKED_BULK_FILES:
        return details
    return details[-MAX_TRACKED_BULK_FILES:]


async def _resume_parse_worker() -> None:
    """Async worker that pulls parse jobs from the queue and runs the CPU-bound
    AI agent in a thread executor so it never blocks the event loop."""
    global _resume_parse_queue
    while True:
        if _resume_parse_queue is None:
            return

        job = await _resume_parse_queue.get()
        if job is None:
            _resume_parse_queue.task_done()
            return

        candidate_id, extracted_text, org_id = job
        try:
            async with AsyncSessionLocal() as db:
                await _parse_resume_inline(candidate_id, extracted_text, org_id, db)
                await db.commit()
        except Exception:
            logger.exception("In-process parse worker failed for candidate %s", candidate_id)
        finally:
            _resume_parse_queue.task_done()


async def start_resume_parse_workers() -> None:
    global _resume_parse_queue, _resume_parse_workers
    if _resume_parse_workers:
        return

    _resume_parse_queue = asyncio.Queue()
    _resume_parse_workers = [
        asyncio.create_task(_resume_parse_worker(), name=f"resume-parse-worker-{idx}")
        for idx in range(IN_PROCESS_PARSE_WORKERS)
    ]


async def stop_resume_parse_workers() -> None:
    global _resume_parse_queue, _resume_parse_workers
    if _resume_parse_queue is None:
        return

    for _ in _resume_parse_workers:
        await _resume_parse_queue.put(None)

    await asyncio.gather(*_resume_parse_workers, return_exceptions=True)
    _resume_parse_workers = []
    _resume_parse_queue = None


async def enqueue_resume_parse(candidate_id: int, extracted_text: str, org_id: int) -> None:
    if _resume_parse_queue is None:
        await start_resume_parse_workers()
    if _resume_parse_queue is not None:
        await _resume_parse_queue.put((candidate_id, extracted_text, org_id))


async def _process_bulk_resume_zip(job_id: int, zip_path: str) -> None:
    """
    Background task to process a bulk resume ZIP.

    Performance improvements vs original:
    - Cancel is instant via asyncio.Event (no DB round-trip per file)
    - DB commits are batched every DB_COMMIT_BATCH_SIZE files (was every 1)
    - processed_details column only written every DB_DETAIL_WRITE_EVERY files
    - ZIP reading uses executor for CPU-bound PDF byte extraction
    """
    cancel_event = _get_cancel_event(job_id)
    temp_zip_path = Path(zip_path)
    loop = asyncio.get_event_loop()

    async with AsyncSessionLocal() as db:
        try:
            job = await db.get(BulkUploadJob, job_id)
            if not job:
                return

            job.status = JobStatus.processing
            await db.commit()

            # Open the ZIP in a thread (disk I/O)
            try:
                archive = await loop.run_in_executor(
                    None, lambda: zipfile.ZipFile(temp_zip_path, "r")
                )
            except zipfile.BadZipFile:
                job = await db.get(BulkUploadJob, job_id)
                if job:
                    job.status = JobStatus.failed
                    job.error_message = "The uploaded file is not a valid ZIP archive."
                    await db.commit()
                return

            try:
                pdf_entries = [
                    info for info in archive.infolist()
                    if not info.is_dir() and _is_pdf_filename(info.filename)
                ]
            finally:
                pass  # keep archive open for processing below

            job.total_files = len(pdf_entries)
            job.processed_files = 0
            job.processed_details = []
            await db.commit()

            if not pdf_entries:
                job.status = JobStatus.failed
                job.error_message = "The ZIP archive does not contain any PDF resumes."
                await db.commit()
                archive.close()
                return

            failed_count = 0
            pending_details: list[dict] = []
            pending_commits = 0  # count files since last DB commit

            for index, info in enumerate(pdf_entries):
                # ── Instant cancellation check (no DB needed) ──────────────
                if cancel_event.is_set():
                    job = await db.get(BulkUploadJob, job_id)
                    if job and job.status != JobStatus.cancelled:
                        job.status = JobStatus.cancelled
                        await db.commit()
                    archive.close()
                    return

                detail: dict = {
                    "filename": Path(info.filename).name or info.filename,
                    "status": "done",
                }
                try:
                    if info.file_size > RESUME_PDF_SIZE_LIMIT_BYTES:
                        raise ValueError("PDF exceeds the 30MB per-file limit inside the ZIP")

                    # Read PDF bytes in thread pool (CPU/IO bound)
                    def _read_pdf_bytes(arc=archive, entry=info):
                        with arc.open(entry, "r") as fh:
                            return fh.read()

                    pdf_bytes = await loop.run_in_executor(None, _read_pdf_bytes)

                    candidate, created, extracted_text = await _create_candidate_from_pdf_bytes(
                        filename=info.filename,
                        pdf_bytes=pdf_bytes,
                        org_id=job.org_id,
                        db=db,
                        parse_inline=False,
                    )
                    if not created:
                        detail["status"] = "duplicate"
                    elif candidate:
                        # Don't commit yet — batched below
                        await enqueue_resume_parse(candidate.id, extracted_text, job.org_id)

                except Exception as exc:
                    logger.warning(
                        "Bulk resume processing failed for %s in job %s: %s",
                        info.filename, job_id, exc
                    )
                    detail["status"] = "error"
                    detail["error"] = str(exc)[:300]
                    failed_count += 1

                pending_details.append(detail)
                pending_commits += 1
                job.processed_files = index + 1

                # ── Batch commit every N files ──────────────────────────────
                if pending_commits >= DB_COMMIT_BATCH_SIZE:
                    # Only update the JSON column every DB_DETAIL_WRITE_EVERY files
                    if (index + 1) % DB_DETAIL_WRITE_EVERY == 0 or pending_commits >= DB_COMMIT_BATCH_SIZE:
                        all_details = list(job.processed_details or []) + pending_details
                        job.processed_details = _trim_job_details(all_details)
                        pending_details = []
                    await db.commit()
                    pending_commits = 0

            # ── Final flush of any remaining un-committed files ────────────
            if pending_details:
                all_details = list(job.processed_details or []) + pending_details
                job.processed_details = _trim_job_details(all_details)

            archive.close()

            # Only mark completed if not cancelled
            if not cancel_event.is_set():
                if failed_count and failed_count == len(pdf_entries):
                    job.status = JobStatus.failed
                    job.error_message = "No resumes could be imported from the ZIP archive."
                else:
                    job.status = JobStatus.completed
                    if failed_count:
                        job.error_message = f"{failed_count} file(s) failed during import."
            else:
                job.status = JobStatus.cancelled

            await db.commit()

        except Exception as exc:
            logger.exception("Bulk resume ZIP job %s failed", job_id)
            try:
                job = await db.get(BulkUploadJob, job_id)
                if job:
                    job.status = JobStatus.failed
                    job.error_message = str(exc)[:500]
                    await db.commit()
            except Exception:
                pass
        finally:
            _cleanup_cancel_event(job_id)
            if temp_zip_path.exists():
                try:
                    await loop.run_in_executor(None, temp_zip_path.unlink)
                except Exception:
                    pass


# ── Inline resume parsing (no Celery needed) ─────────────────────────────────

async def _parse_resume_inline(candidate_id: int, extracted_text: str, org_id: int, db: AsyncSession):
    """Parse resume text with AI and store skills — runs inline, no Celery required."""
    from app.agents.agents import run_parse_resume_agent
    from app.models.source import SkillGraphEdge

    try:
        if not extracted_text or len(extracted_text.strip()) < 20:
            logger.warning(f"Resume text too short for candidate {candidate_id}, skipping AI parse")
            candidate = await db.get(Candidate, candidate_id)
            if candidate:
                candidate.status = CandidateStatus.active
            return

        # Run the AI agent in a thread pool — it's CPU-bound/synchronous and
        # MUST NOT block the async event loop (would freeze all other requests)
        loop = asyncio.get_event_loop()
        ai_result = await loop.run_in_executor(None, run_parse_resume_agent, extracted_text)

        # Update candidate user with actual name if found
        extracted_name = ai_result.get("name")
        if extracted_name and len(extracted_name.strip()) > 1:
            candidate_res = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
            candidate_for_user = candidate_res.scalar_one_or_none()
            user_rec = await db.get(User, candidate_for_user.user_id) if candidate_for_user else None
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

        # Process skill graph edges without reloading the full taxonomy table for every resume
        relation_names = set()
        for rel in ai_result.get("relationships", []):
            from_name = rel.get("from", "").lower().strip()
            to_name = rel.get("to", "").lower().strip()
            if from_name:
                relation_names.add(from_name)
            if to_name:
                relation_names.add(to_name)

        relation_skills = await db.execute(
            select(SkillTaxonomy).where(SkillTaxonomy.normalized_name.in_(list(relation_names)))
        ) if relation_names else None
        skill_lookup = {s.normalized_name: s.id for s in relation_skills.scalars()} if relation_skills else {}

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
        candidate = await db.get(Candidate, candidate_id)
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
        candidate = await db.get(Candidate, candidate_id)
        if candidate:
            candidate.status = CandidateStatus.active  # Still set active so it shows up
            # If we want to show parse_failed instead: candidate.status = CandidateStatus.parse_failed


# ── Resume Upload ─────────────────────────────────────────────────────────────
@router.post("/upload-resume")
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_role_id: Optional[int] = Form(None),
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    del job_role_id  # Reserved for future resume-to-role linking.

    filename = file.filename or "resume.pdf"
    content_type = (file.content_type or "").lower()

    if _is_zip_filename(filename) or content_type in ALLOWED_ZIP_MIME_TYPES:
        temp_dir = TEMP_UPLOAD_DIR / str(current_user.org_id)
        temp_dir.mkdir(parents=True, exist_ok=True)
        zip_path = temp_dir / f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.zip"
        await _save_large_upload_to_path(file, zip_path, RESUME_ZIP_SIZE_LIMIT_BYTES)

        if not zipfile.is_zipfile(zip_path):
            if zip_path.exists():
                zip_path.unlink()
            raise HTTPException(status_code=400, detail="Please upload a valid ZIP archive.")

        job = BulkUploadJob(
            org_id=current_user.org_id,
            created_by=current_user.id,
            filename=filename,
            total_files=0,
            processed_files=0,
            processed_details=[],
            status=JobStatus.pending,
        )
        db.add(job)
        await db.flush()
        await db.commit()
        await db.refresh(job)

        background_tasks.add_task(_process_bulk_resume_zip, job.id, str(zip_path))
        return success(
            {"job_id": job.id, "status": job.status.value},
            "ZIP upload received. Resume extraction is running in the background.",
        )

    if content_type not in ALLOWED_PDF_MIME_TYPES and not _is_pdf_filename(filename):
        raise HTTPException(status_code=400, detail="Only PDF resumes or ZIP archives are accepted")

    pdf_bytes = await file.read()
    await file.close()
    if len(pdf_bytes) > RESUME_PDF_SIZE_LIMIT_BYTES:
        raise HTTPException(status_code=400, detail="PDF file size exceeds 30MB limit")

    candidate, created, _ = await _create_candidate_from_pdf_bytes(
        filename=filename,
        pdf_bytes=pdf_bytes,
        org_id=current_user.org_id,
        db=db,
    )
    if not created:
        await db.rollback()
        return success(
            {"status": "duplicate"},
            "This resume already exists in Talent Vault and was skipped.",
        )
    await db.commit()

    return success(
        {"candidate_id": candidate.id, "status": "processed"},
        "Resume uploaded and parsed successfully.",
    )


@router.get("/bulk-uploads")
async def list_bulk_uploads(
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            BulkUploadJob.id,
            BulkUploadJob.filename,
            BulkUploadJob.total_files,
            BulkUploadJob.processed_files,
            BulkUploadJob.status,
            BulkUploadJob.error_message,
            BulkUploadJob.created_at,
            BulkUploadJob.updated_at,
        )
        .where(BulkUploadJob.org_id == current_user.org_id)
        .order_by(BulkUploadJob.id.desc())
        .limit(20)
    )
    jobs = []
    for row in result.all():
        jobs.append({
            "id": row.id,
            "filename": row.filename,
            "total_files": row.total_files or 0,
            "processed_files": row.processed_files or 0,
            "processed_details": [],
            "status": row.status.value if hasattr(row.status, "value") else str(row.status),
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        })
    return success(jobs)


@router.get("/bulk-uploads/{job_id}")
async def get_bulk_upload_status(
    job_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(BulkUploadJob, job_id)
    if not job or job.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Bulk upload job not found")
    return success(_serialize_bulk_job(job, include_details=True))


@router.post("/bulk-uploads/{job_id}/cancel")
async def cancel_bulk_upload(
    job_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(BulkUploadJob, job_id)
    if not job or job.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Bulk upload job not found")
    if job.status in {JobStatus.completed, JobStatus.failed, JobStatus.cancelled}:
        raise HTTPException(status_code=400, detail="This bulk upload can no longer be cancelled")

    # Fire the in-process cancel event immediately — the background task will
    # stop at its next iteration (< 1 resume delay) without waiting for a DB poll.
    _fire_cancel_event(job_id)

    job.status = JobStatus.cancelled
    await db.commit()
    await db.refresh(job)
    return success(_serialize_bulk_job(job, include_details=True), "Job cancellation requested")


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
NOISE_TOKENS = {"and", "or", "the", "of", "for", "with", "in", "at", "a", "an", "to", "on", "is", "are"}
# Skills shorter than this are only matched if they are whole words
MIN_TOKEN_LEN = 1 
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
    """Convert job role required_skills into a canonical list.
    
    Priority:
    1. Use skills explicitly defined in the JD (required_skills field) — always preferred.
    2. If NO skills were defined, infer from title/description using keyword presets.
    3. Last resort: tokenise the title itself.
    
    Critically: if the user SAVED skills on the role, we ONLY use those — no mixing with presets.
    """
    if not role:
        return []

    # Step 1: Parse explicitly saved required_skills
    normalised = []
    raw = role.required_skills or []
    for item in raw:
        if isinstance(item, str):
            name = item.strip()
            level = "intermediate"
        elif isinstance(item, dict):
            name = (
                item.get("skill") or item.get("name") or
                item.get("title") or item.get("normalized_name") or ""
            ).strip()
            level = (
                item.get("level") or item.get("min_level") or
                item.get("required_level") or "intermediate"
            )
        else:
            continue
        name = _clean_skill_name(name)
        if name:
            normalised.append({"skill": name, "level": _normalise_level(level)})

    # If JD has explicit skills, return them ONLY — do not blend with AI presets
    if normalised:
        return normalised

    # Step 2: No explicit skills — infer from role title + description keywords
    haystack = f"{role.title or ''} {role.description or ''}".lower()
    inferred = []
    for keyword, skills in ROLE_SKILL_PRESETS.items():
        if keyword in haystack:
            inferred.extend(skills)

    # Step 3: Last resort — tokenise the title
    if not inferred and role.title:
        inferred = [
            part.strip() for part in
            role.title.replace("/", " ").replace("-", " ").split()
            if len(part.strip()) > 2
        ]

    seen = set()
    fallback = []
    for skill in inferred:
        key = skill.lower()
        if key not in seen:
            fallback.append({"skill": skill, "level": "intermediate"})
            seen.add(key)
    return fallback


def _skill_tokens(value: str) -> set:
    # Keep 1+ letter tokens, but exclude noise. 
    # alphanumeric only to avoid "c++" vs "c" issues if needed, but let's keep it simple first.
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in str(value or ""))
    return {token for token in cleaned.split() if len(token) >= MIN_TOKEN_LEN and token not in NOISE_TOKENS}


def _skill_similarity(required: str, candidate: str) -> float:
    """Return similarity score 0..1 between a required skill and a candidate's skill."""
    req = " ".join(str(required or "").lower().split())
    cand = " ".join(str(candidate or "").lower().split())
    if not req or not cand:
        return 0.0

    # 1. Perfect match
    if req == cand:
        return 1.0

    # 2. Whole-word substring check (e.g. "React" matches "React JS")
    # This prevents "C" from matching "InstruCtional"
    import re
    # Escape special chars and check for word boundaries
    pattern = r'\b' + re.escape(req) + r'\b'
    if re.search(pattern, cand) or re.search(r'\b' + re.escape(cand) + r'\b', req):
        return 0.95

    # 3. Token-based overlap for multi-word phrases
    req_tokens = _skill_tokens(req)
    cand_tokens = _skill_tokens(cand)
    if not req_tokens or not cand_tokens:
        return 0.0

    overlap = req_tokens & cand_tokens
    if not overlap:
        return 0.0

    coverage = len(overlap) / len(req_tokens)
    jaccard = len(overlap) / len(req_tokens | cand_tokens)

    if coverage >= 1.0:
        return 0.9  # All required tokens found in candidate skill (but not as a single phrase)
    if coverage >= 0.5:
        return 0.5 * coverage + 0.2
    
    return 0.1



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


# ── Candidate Search ───────────────────────────────────────────────────────────────────────────────────

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

    # Clamp limit to a safe ceiling to prevent accidental full-table loads
    limit = min(max(limit, 1), 500)

    # Base queries
    cand_query = select(Candidate, User).join(User, Candidate.user_id == User.id)
    if current_user.role.value != "super_admin":
        cand_query = cand_query.where(Candidate.org_id == current_user.org_id)

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
        # Performance: when no role scoring is needed, apply LIMIT at the
        # SQL level so the DB only reads `limit` rows instead of the full table.
        if not role_id:
            q = q.order_by(Candidate.created_at.desc()).limit(limit)
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
        if not role_id:
            q = q.order_by(Employee.created_at.desc()).limit(limit)
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
        if not role or (current_user.role.value != "super_admin" and role.org_id != current_user.org_id):
            raise HTTPException(status_code=404, detail="Role not found")
        req_skills = normalise_required_skills(role)

    # ── BATCH SKILLS LOAD ────────────────────────────────────────────────────────────────────────────
    # Previously: one DB query per candidate → O(N) round-trips (4 000+ queries
    # for 4 000 resumes).  Now: two IN-clause queries regardless of result size.
    cand_ids = [item["id"] for item in results if not item["is_employee"]]
    emp_ids  = [item["id"] for item in results if item["is_employee"]]

    cand_skills_map: dict[int, list] = {}
    if cand_ids:
        batch_res = await db.execute(
            select(CandidateSkill, SkillTaxonomy)
            .join(SkillTaxonomy)
            .where(CandidateSkill.candidate_id.in_(cand_ids))
        )
        for cs, st in batch_res:
            cand_skills_map.setdefault(cs.candidate_id, []).append(
                {"name": st.name, "level": cs.level.value}
            )

    emp_skills_map: dict[int, list] = {}
    if emp_ids:
        emp_batch_res = await db.execute(
            select(EmployeeSkill, SkillTaxonomy)
            .join(SkillTaxonomy)
            .where(EmployeeSkill.employee_id.in_(emp_ids))
        )
        for es, st in emp_batch_res:
            emp_skills_map.setdefault(es.employee_id, []).append(
                {"name": st.name, "level": es.level.value}
            )
    # ────────────────────────────────────────────────────────────────────────────────────

    output = results
    for item in output:
        # Assign pre-loaded skills — zero extra DB queries
        item["skills"] = (
            cand_skills_map.get(item["id"], []) if not item["is_employee"]
            else emp_skills_map.get(item["id"], [])
        )

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
    # When a role is selected, ALWAYS rank by fit score first (highest match on top)
    sort_keys = [s.strip() for s in sort_by.split(",") if s.strip()]
    if role_id:
        # Primary sort: role fit score (descending), secondary: experience, tertiary: newest
        output.sort(
            key=lambda x: (x.get("ats_score") or 0, x.get("exp_years") or 0, x.get("created_at") or ""),
            reverse=True
        )
    elif "experience" in sort_keys:
        output.sort(key=lambda x: (x["exp_years"] or 0, x.get("created_at") or ""), reverse=True)
    else:
        output.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    output = output[:limit]

    return success(output)


@router.get("/candidates/{candidate_id}")
async def get_candidate(
    candidate_id: int,
    role_id: Optional[int] = Query(None),
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    # Level 1 (super_admin) sees ALL candidates across ALL orgs
    # Level 2 (org_admin), Level 3 (hr, manager) only see their org's candidates
    is_super = role_val == "super_admin"

    logger.info(f"Fetching candidate {candidate_id} for user {current_user.id} (Role: {role_val}, Org: {current_user.org_id})")

    # Fetch Candidate — super_admin bypasses org filter
    query = select(Candidate).where(Candidate.id == candidate_id)
    if not is_super:
        query = query.where(Candidate.org_id == current_user.org_id)
    
    result = await db.execute(query)
    candidate = result.scalar_one_or_none()
    if not candidate:
        logger.warning(f"❌ Candidate {candidate_id} not found or access denied for user {current_user.id}")
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. Fetch Skills
    skills_res = await db.execute(
        select(CandidateSkill, SkillTaxonomy).join(SkillTaxonomy).where(CandidateSkill.candidate_id == candidate_id)
    )
    cand_skills = [{"id": cs.id, "skill_id": cs.skill_id, "name": st.name, "level": cs.level.value, "source": cs.source.value, "years_of_use": cs.years_of_use, "evidence": cs.evidence} for cs, st in skills_res]

    # 3. Fetch User
    user_res = await db.execute(select(User).where(User.id == candidate.user_id))
    user = user_res.scalar_one_or_none()

    # 4. Check if Employee
    emp_res = await db.execute(select(Employee).where(Employee.user_id == candidate.user_id))
    emp = emp_res.scalar_one_or_none()

    # 5. Get Latest Offer
    offer_res = await db.execute(
        select(OfferLetter).where(OfferLetter.candidate_id == candidate_id).order_by(OfferLetter.created_at.desc())
    )
    offer = offer_res.scalars().first()
    offer_data = None
    if offer:
        offer_data = {
            "id": offer.id,
            "status": offer.status.value,
            "feedback": offer.feedback,
            "role_title": offer.role_title,
            "salary": offer.salary,
            "department": offer.department,
            "location": offer.location,
            "start_date": offer.start_date.isoformat() if offer.start_date else None,
            "offer_content": offer.offer_content,
        }

    # 6. AI scores
    scores_res = await db.execute(
        select(AIScore).where(AIScore.entity_type == EntityType.candidate, AIScore.entity_id == candidate_id)
    )
    scores = [{"type": s.score_type.value, "score": float(s.score) if s.score else None, "reasoning": s.reasoning} for s in scores_res.scalars()]

    # 7. Role Fit Analysis
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

    # 8. Calculate basic ATS Score
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
        "latest_offer": offer_data,
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
    query = select(JobRole)
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_val != "super_admin":
        query = query.where(JobRole.org_id == current_user.org_id)
    
    result = await db.execute(query)
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
    required_skills = body.required_skills or []
    if not required_skills and body.description:
        try:
            from app.agents.agents import run_extract_jd_skills_agent
            import asyncio
            ai_result = await asyncio.to_thread(run_extract_jd_skills_agent, body.description)
            required_skills = [{"skill": s.get("name"), "level": s.get("level", "intermediate")} for s in ai_result.get("skills", [])]
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to extract skills from JD: {e}")

    role = JobRole(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        required_skills=required_skills,
        min_experience=body.min_experience,
    )
    db.add(role)
    await db.commit()
    return success({"id": role.id, "title": role.title, "required_skills": normalise_required_skills(role)})


@router.put("/job-roles/{role_id}")
async def update_job_role(
    role_id: int,
    body: JobRoleCreate,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    role_res = await db.execute(select(JobRole).where(JobRole.id == role_id, JobRole.org_id == current_user.org_id))
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    required_skills = body.required_skills or []
    if not required_skills and body.description:
        try:
            from app.agents.agents import run_extract_jd_skills_agent
            import asyncio
            ai_result = await asyncio.to_thread(run_extract_jd_skills_agent, body.description)
            required_skills = [{"skill": s.get("name"), "level": s.get("level", "intermediate")} for s in ai_result.get("skills", [])]
        except Exception as e:
            logger.warning(f"Failed to extract skills from JD: {e}")

    role.title = body.title
    role.description = body.description
    role.required_skills = required_skills
    role.min_experience = body.min_experience
    await db.commit()
    await db.refresh(role)
    return success({
        "id": role.id,
        "title": role.title,
        "description": role.description,
        "min_experience": role.min_experience,
        "required_skills": normalise_required_skills(role),
    }, "Job role updated")


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
    
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_super = role_val == "super_admin"
    if not candidate or (not is_super and str(candidate.org_id) != str(current_user.org_id)):
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
    
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_super = role_val == "super_admin"
    if not candidate or (not is_super and str(candidate.org_id) != str(current_user.org_id)):
        raise HTTPException(status_code=404, detail="Candidate not found")

    user_res = await db.execute(select(User).where(User.id == candidate.user_id))
    user = user_res.scalar_one_or_none()

    org_res = await db.execute(select(Organisation).where(Organisation.id == current_user.org_id))
    org = org_res.scalar_one_or_none()

    # Check if Employee already exists
    emp_res = await db.execute(select(Employee).where(Employee.user_id == user.id))
    if emp_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Candidate is already an employee")

    # Create Offer Letter record (Pending Approval)
    offer = OfferLetter(
        candidate_id=candidate.id,
        org_id=current_user.org_id,
        created_by=current_user.id,
        role_title=body.role_title,
        salary=body.salary,
        department=body.department,
        location=body.location,
        start_date=datetime.strptime(body.start_date, "%Y-%m-%d") if body.start_date else None,
        offer_content=body.offer_content or {},
        status=OfferStatus.pending
    )
    
    # If content was NOT provided, generate it now for review
    if not body.offer_content:
        from app.agents.agents import run_generate_offer_letter_agent
        hiring_details = {
            "role": body.role_title,
            "salary": body.salary,
            "location": body.location,
            "start_date": body.start_date,
            "department": body.department
        }
        offer.offer_content = run_generate_offer_letter_agent(user.full_name or user.email, hiring_details)

    db.add(offer)
    candidate.status = CandidateStatus.offered
    
    try:
        await db.commit()
    except Exception as e:
        logger.error(f"❌ Failed to commit offer letter: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return success({"offer_id": offer.id}, "Offer letter created and submitted for approval.")


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
    
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    is_super = role_val == "super_admin"
    if not emp or (not is_super and str(emp.org_id) != str(current_user.org_id)):
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
    query = select(Candidate).where(Candidate.id == candidate_id)
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_val != "super_admin":
        query = query.where(Candidate.org_id == current_user.org_id)
    
    result = await db.execute(query)
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
    query = select(User, Candidate).join(Candidate, Candidate.user_id == User.id)
    
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_val != "super_admin":
        query = query.where(User.org_id == current_user.org_id)
    
    query = query.where(
        User.is_active == True,
        or_(
            and_(User.role == UserRole.candidate, User.first_login == False),
            User.role == UserRole.employee
        )
    ).order_by(User.created_at.desc())
    
    res = await db.execute(query)
    rows = res.all()
    
    data = []
    for u, c in rows:
        # Check if they are actually an employee in the deploy module
        from app.models.deploy import Employee
        emp_res = await db.execute(select(Employee).where(Employee.user_id == u.id))
        emp = emp_res.scalar_one_or_none()

        
        data.append({
            "id": c.id,
            "user_id": u.id,
            "employee_id": emp.id if emp else None,
            "name": u.full_name or u.email.split("@")[0],
            "email": u.email,
            "is_employee": emp is not None,
            "type": "Employee" if emp else "Trainee",
            "created_at": u.created_at.isoformat()
        })
        
    return success(data=data)



# ── Offer Approvals ──────────────────────────────────────────────────────────

@router.get("/offers")
async def list_offers(
    status: Optional[str] = "pending",
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    
    query = select(OfferLetter).options(selectinload(OfferLetter.candidate))
    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_val != "super_admin":
        query = query.where(OfferLetter.org_id == current_user.org_id)
    
    if status:
        query = query.where(OfferLetter.status == status)
    
    result = await db.execute(query)
    offers = result.scalars().all()
    
    output = []
    for o in offers:
        cand_res = await db.execute(select(User).where(User.id == o.candidate.user_id))
        user = cand_res.scalar_one_or_none()
        
        output.append({
            "id": o.id,
            "candidate_id": o.candidate_id,
            "candidate_name": user.full_name if user else "Unknown",
            "candidate_email": user.email if user else "Unknown",
            "role_title": o.role_title,
            "salary": o.salary,
            "department": o.department,
            "location": o.location,
            "start_date": o.start_date.isoformat() if o.start_date else None,
            "status": o.status.value,
            "offer_content": o.offer_content,
            "feedback": o.feedback,
            "created_at": o.created_at.isoformat(),
        })
    
    return success(output)


@router.put("/offers/{offer_id}")
async def update_offer(
    offer_id: int,
    body: dict = Body(...),
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(OfferLetter).where(OfferLetter.id == offer_id)
    if current_user.role.value != "super_admin":
        query = query.where(OfferLetter.org_id == current_user.org_id)
        
    result = await db.execute(query)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status not in [OfferStatus.pending, OfferStatus.changes_requested]:
        raise HTTPException(status_code=400, detail="Only pending or feedback offers can be edited")

    if "role_title" in body: offer.role_title = body["role_title"]
    if "salary" in body: offer.salary = body["salary"]
    if "department" in body: offer.department = body["department"]
    if "location" in body: offer.location = body["location"]
    if "offer_content" in body: offer.offer_content = body["offer_content"]
    
    # Reset to pending if it was changes_requested
    if offer.status == OfferStatus.changes_requested:
        offer.status = OfferStatus.pending
        offer.feedback = None

    if "start_date" in body and body["start_date"]:
        try:
            offer.start_date = datetime.strptime(body["start_date"], "%Y-%m-%d")
        except:
            pass

    await db.commit()
    return success(message="Offer updated successfully")


@router.post("/offers/{offer_id}/approve")
async def approve_offer(
    offer_id: int,
    body: Optional[dict] = Body(None),
    current_user: User = Depends(require_role(["org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    from app.models.deploy import Employee, EmployeeStatus
    from app.utils.pdf import generate_professional_pdf
    from app.utils.email import send_offer_letter_email
    import tempfile
    import os

    # 1. Get Offer
    query = select(OfferLetter).where(OfferLetter.id == offer_id)
    if current_user.role.value != "super_admin":
        query = query.where(OfferLetter.org_id == current_user.org_id)
        
    result = await db.execute(query)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer.status != OfferStatus.pending:
        raise HTTPException(status_code=400, detail=f"Offer is already {offer.status.value}")

    offer.status = OfferStatus.approved
    offer.approved_by = current_user.id
    
    await db.commit()
    return success(message="Offer approved and locked. Ready for HR dispatch.")


class FeedbackBody(BaseModel):
    feedback: str

@router.post("/offers/{offer_id}/request-changes")
async def request_changes_offer(
    offer_id: int,
    body: FeedbackBody,
    current_user: User = Depends(require_role(["org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(OfferLetter).where(OfferLetter.id == offer_id)
    if current_user.role.value != "super_admin":
        query = query.where(OfferLetter.org_id == current_user.org_id)
        
    result = await db.execute(query)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status != OfferStatus.pending:
        raise HTTPException(status_code=400, detail="Can only request changes on pending offers")

    offer.status = OfferStatus.changes_requested
    offer.feedback = body.feedback
    
    await db.commit()
    return success(message="Feedback sent to HR.")


@router.post("/offers/{offer_id}/send")
async def send_approved_offer(
    offer_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    from app.models.deploy import Employee, EmployeeStatus
    from app.utils.pdf import generate_professional_pdf
    from app.utils.email import send_offer_letter_email
    import tempfile
    import os

    # 1. Get Offer
    query = select(OfferLetter).where(OfferLetter.id == offer_id)
    if current_user.role.value != "super_admin":
        query = query.where(OfferLetter.org_id == current_user.org_id)
        
    result = await db.execute(query)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer.status != OfferStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved offers can be sent to candidates")

    # 2. Get Candidate/User/Org
    cand_res = await db.execute(select(Candidate).where(Candidate.id == offer.candidate_id))
    candidate = cand_res.scalar_one_or_none()
    
    user_res = await db.execute(select(User).where(User.id == candidate.user_id))
    user = user_res.scalar_one_or_none()
    
    org_res = await db.execute(select(Organisation).where(Organisation.id == offer.org_id))
    org = org_res.scalar_one_or_none()

    # 3. Generate and Send Email with PDF
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            pdf_path = tmp.name
        
        generate_professional_pdf(offer.offer_content, pdf_path)

        with open(pdf_path, "rb") as f:
            attachment_bytes = f.read()
        os.remove(pdf_path)

        await send_offer_letter_email(
            to_email=user.email,
            candidate_name=user.full_name or user.email,
            company_name=org.name if org else "Phygitron 360",
            role_title=offer.role_title,
            department=offer.department,
            salary=offer.salary,
            location=offer.location,
            attachment_bytes=attachment_bytes
        )
    except Exception as e:
        logger.error(f"❌ Failed to send approved offer email: {e}")
        # Try fallback without PDF
        await send_offer_letter_email(
            to_email=user.email,
            candidate_name=user.full_name or user.email,
            company_name=org.name if org else "Phygitron 360",
            role_title=offer.role_title,
            department=offer.department,
            salary=offer.salary,
            location=offer.location
        )

    # 4. Finalize Hire
    user.role = UserRole.employee
    candidate.status = CandidateStatus.archived
    
    emp = Employee(
        user_id=user.id,
        org_id=user.org_id,
        department=offer.department,
        join_date=offer.start_date.date() if offer.start_date else datetime.utcnow().date(),
        status=EmployeeStatus.active,
    )
    db.add(emp)
    
    offer.status = OfferStatus.sent
    
    await db.commit()
    return success({"employee_id": emp.id}, "Offer sent to candidate successfully.")


@router.post("/offers/{offer_id}/reject")
async def reject_offer(
    offer_id: int,
    current_user: User = Depends(require_role(["org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(OfferLetter).where(OfferLetter.id == offer_id)
    if current_user.role.value != "super_admin":
        query = query.where(OfferLetter.org_id == current_user.org_id)
        
    result = await db.execute(query)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer.status = OfferStatus.rejected
    
    # Revert candidate status
    cand_res = await db.execute(select(Candidate).where(Candidate.id == offer.candidate_id))
    candidate = cand_res.scalar_one_or_none()
    if candidate:
        candidate.status = CandidateStatus.shortlisted

    await db.commit()
    return success(message="Offer rejected and candidate returned to shortlist.")

