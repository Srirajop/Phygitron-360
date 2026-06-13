import json
import logging
import traceback
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks
from app.utils.import_utils import extract_text_from_file, parse_questions_with_ai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.source import Candidate
from app.models.verify import (
    Assessment, AssessmentQuestion, AssessmentAssignment,
    AssessmentResult, ProctoringFlag, ProctoringFlagType, AssessmentStatus, AssignmentStatus, AssessmentQuery,
    QuestionBankItem
)
from app.utils.auth import get_current_user, require_role, require_module
from app.utils.email import send_assignment_notification_email
from app.utils.s3 import upload_bytes_to_s3

router = APIRouter(prefix="/api/v1/verify", tags=["Verify"], dependencies=[Depends(require_module("verify"))])
logger = logging.getLogger(__name__)


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


def serialize_assessment_query(query: AssessmentQuery, user: Optional[User] = None, candidate: Optional[Candidate] = None):
    # Try to get owner from provided user or the relationship (if loaded)
    owner = user
    if not owner:
        try:
            owner = query.user
        except:
            owner = None
            
    return {
        "id": query.id,
        "assessment_id": query.assessment_id,
        "assessment_result_id": query.assessment_result_id,
        "user_id": query.user_id,
        "candidate_profile_id": candidate.id if candidate else None,
        "candidate_name": (owner.full_name or owner.email) if owner else f"User #{query.user_id}",
        "candidate_email": owner.email if owner else None,
        "subject": query.subject,
        "message": query.message,
        "status": query.status,
        "response": query.response,
        "created_at": query.created_at.isoformat() if query.created_at else None,
        "updated_at": query.updated_at.isoformat() if query.updated_at else None,
    }


def _extract_examples_from_text(text: str) -> list:
    import re

    if not text:
        return []

    def split_top_level_args(raw: str) -> list:
        parts = []
        current = []
        depth = 0
        in_string = False
        string_char = ""

        for ch in raw:
            if in_string:
                current.append(ch)
                if ch == string_char:
                    in_string = False
                continue

            if ch in {"'", '"'}:
                in_string = True
                string_char = ch
                current.append(ch)
                continue

            if ch in {"[", "{", "("}:
                depth += 1
            elif ch in {"]", "}", ")"} and depth > 0:
                depth -= 1

            if ch == "," and depth == 0:
                part = "".join(current).strip()
                if part:
                    parts.append(part)
                current = []
                continue

            current.append(ch)

        tail = "".join(current).strip()
        if tail:
            parts.append(tail)
        return parts

    cases = []
    pattern = re.compile(r"Input:\s*(.*?)\s*Output:\s*(.*?)(?=(?:\n\s*Example|\Z))", re.IGNORECASE | re.DOTALL)
    for match in pattern.finditer(text):
        raw_input = re.sub(r"`", "", match.group(1)).strip()
        raw_output = re.sub(r"`", "", match.group(2)).strip()
        if not raw_input or not raw_output:
            continue

        # Strip trailing "Explanation:", "Constraints:", "Note:", "Follow-up:" etc.
        # These appear after the actual answer and should not be part of expected_output.
        raw_output = re.split(
            r"\n\s*(?:Explanation|Constraints|Note|Follow.?up|Hint)\s*:",
            raw_output,
            maxsplit=1,
            flags=re.IGNORECASE
        )[0].strip()

        normalized_parts = []
        for part in split_top_level_args(raw_input):
            normalized_parts.append(re.sub(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*", "", part).strip())

        cases.append({
            "input": "\n".join(part for part in normalized_parts if part),
            "expected_output": raw_output,
        })
    return cases



def _pick_python_starter_code(code_snippets: list, fallback_title: str = "solution") -> str:
    for snippet in (code_snippets or []):
        lang = (snippet.get("langSlug") or "").lower()
        code = snippet.get("code") or ""
        if lang in {"python", "python3"} and code.strip():
            return code

    safe_name = "".join(ch if ch.isalnum() else "_" for ch in (fallback_title or "solution").lower()).strip("_") or "solution"
    return (
        "def "
        f"{safe_name}"
        "(input_data):\n"
        "    # Write your code here\n"
        "    pass\n"
    )


# ── Assessment Builder ────────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    question_text: str
    question_type: str  # mcq, written, coding, file_upload
    options: Optional[list] = None
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: Optional[list] = None
    programming_language: Optional[str] = None
    accepted_file_types: Optional[str] = None
    skill_id: Optional[int] = None
    marks: float = 1.0
    order_index: int = 0
    images: Optional[List[str]] = []
    tags: Optional[List[str]] = []


class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "mcq"
    time_limit_minutes: Optional[int] = None
    pass_score: float = 70.0
    shuffle_questions: bool = False
    show_result_immediately: bool = True
    questions: List[QuestionCreate] = []


class AssessmentStatusUpdate(BaseModel):
    status: AssessmentStatus


class AssessmentQueryRequest(BaseModel):
    subject: Optional[str] = "Assessment Query"
    message: str


class AssessmentQueryUpdateRequest(BaseModel):
    status: Optional[str] = None
    response: Optional[str] = None


@router.post("/assessments")
async def create_assessment(
    body: AssessmentCreate,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    assessment = Assessment(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        type=body.type,
        time_limit_minutes=body.time_limit_minutes,
        pass_score=body.pass_score,
        shuffle_questions=body.shuffle_questions,
        show_result_immediately=body.show_result_immediately,
        created_by=current_user.id,
        status=AssessmentStatus.draft,
    )
    db.add(assessment)
    await db.flush()

    for q in body.questions:
        normalized_test_cases = q.test_cases
        normalized_language = q.programming_language
        if q.question_type == "coding":
            normalized_test_cases = _prepare_test_cases(q.test_cases or [])
            if len(normalized_test_cases) < 3:
                raise HTTPException(
                    status_code=400,
                    detail="Each coding question must have at least 3 test cases before it can be saved.",
                )
            if any(not str(tc.get("expected_output", "")).strip() for tc in normalized_test_cases):
                raise HTTPException(
                    status_code=400,
                    detail="Every coding test case must include an expected output.",
                )
            try:
                normalized_language = _normalize_language(q.programming_language or "python")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

        question = AssessmentQuestion(
            assessment_id=assessment.id,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_answer=q.correct_answer,
            model_answer=q.model_answer,
            starter_code=q.starter_code,
            test_cases=normalized_test_cases,
            programming_language=normalized_language,
            accepted_file_types=q.accepted_file_types,
            skill_id=q.skill_id,
            marks=q.marks,
            order_index=q.order_index,
            images=q.images,
            tags=q.tags or [],
        )
        db.add(question)

    await db.commit()
    return success({"id": assessment.id, "title": assessment.title})


@router.post("/import-questions")
async def import_questions(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
):
    try:
        content = await file.read()
        text = await extract_text_from_file(content, file.filename)
        questions = await parse_questions_with_ai(text)
        return success(questions)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class URLImportRequest(BaseModel):
    url: str

@router.post("/import-url")
async def import_url(
    body: URLImportRequest,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
):
    try:
        import httpx
        from bs4 import BeautifulSoup
        import re
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://leetcode.com/",
        }

        # --- Specialized LeetCode Handler ---
        if "leetcode.com" in body.url.lower():
            match = re.search(r"leetcode\.com/problems/([^/]+)", body.url.lower())
            if match:
                title_slug = match.group(1)
                async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                    graphql_url = "https://leetcode.com/graphql"
                    query = """
                    query questionData($titleSlug: String!) {
                        question(titleSlug: $titleSlug) {
                            title
                            content
                            stats
                            topicTags { name }
                            codeSnippets { langSlug code }
                            exampleTestcases
                            sampleTestCase
                        }
                    }
                    """
                    payload = {
                        "operationName": "questionData",
                        "variables": {"titleSlug": title_slug},
                        "query": query
                    }
                    resp = await client.post(graphql_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json().get("data", {}).get("question", {})
                        if data and data.get("content"):
                            # Use BeautifulSoup with newline separator to preserve formatting
                            soup = BeautifulSoup(data["content"], 'html.parser')
                            
                            # Extract ALL image URLs and replace with Markdown
                            all_imgs = []
                            for img in soup.find_all('img'):
                                src = img.get('src')
                                if src:
                                    all_imgs.append(src)
                                    img.replace_with(f"![image]({src})")
                            
                            # Preserve block-level formatting
                            for tag in soup.find_all(['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote']):
                                tag.insert_before('\n\n')
                                tag.insert_after('\n\n')
                            for tag in soup.find_all('br'):
                                tag.replace_with('\n')
                            for tag in soup.find_all('li'):
                                tag.insert_before('\n- ')
                                
                            content_text = soup.get_text()
                            
                            # Clean up whitespace while preserving paragraphs
                            content_text = re.sub(r'[ \t]+', ' ', content_text)
                            content_text = re.sub(r'\n[ \t]*\n+', '\n\n', content_text).strip()
                            
                            title = data.get("title") or title_slug.replace("-", " ").title()
                            starter_code = _pick_python_starter_code(data.get("codeSnippets") or [], title)
                            test_cases = _extract_examples_from_text(content_text)

                            if not test_cases:
                                sample_blob = (data.get("exampleTestcases") or data.get("sampleTestCase") or "").strip()
                                if sample_blob:
                                    test_cases = [{"input": sample_blob, "expected_output": ""}]

                            question_text = f"# {title}\n\n{content_text}"
                            if data.get("topicTags"):
                                topic_names = [tag.get("name") for tag in data.get("topicTags", []) if tag.get("name")]
                                if topic_names:
                                    question_text += f"\n\nTopics: {', '.join(topic_names)}"

                            question = {
                                "question_text": question_text,
                                "question_type": "coding",
                                "options": [],
                                "correct_answer": None,
                                "model_answer": None,
                                "starter_code": starter_code,
                                "test_cases": test_cases,
                                "programming_language": "python",
                                "marks": 5,
                                "order_index": 0,
                                "images": all_imgs,
                            }
                            return success([question])

        # --- General Scraper Fallback ---
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(body.url, headers=headers)
            resp.raise_for_status()
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.extract()
            
        # Extract ALL image URLs and replace with Markdown for general scraper
        all_imgs = []
        for img in soup.find_all('img'):
            src = img.get('src')
            if src:
                if not src.startswith('http'):
                    from urllib.parse import urljoin
                    src = urljoin(body.url, src)
                all_imgs.append(src)
                img.replace_with(f"![image]({src})")

        text = soup.get_text(separator=' ', strip=True)
        if len(text) > 15000:
            text = text[:15000]
            
        questions = await parse_questions_with_ai(text)
        
        if questions and all_imgs:
            for q in questions:
                existing = q.get('images', [])
                if not isinstance(existing, list): existing = []
                q['images'] = list(set(existing + all_imgs))

        return success(questions)
    except Exception as e:
        logger.error(f"URL Import Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch or parse URL: {str(e)}")


@router.post("/questions/upload-image")
async def upload_question_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
):
    """Upload an image for a question and return the URL."""
    try:
        content = await file.read()
        file_ext = file.filename.split('.')[-1].lower()
        if file_ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        import uuid
        s3_key = f"questions/{uuid.uuid4()}.{file_ext}"
        url = await upload_bytes_to_s3(content, s3_key, file.content_type)
        return success({"image_url": url})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/submissions/upload-file")
async def upload_submission_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["candidate", "hr", "org_admin"])),
):
    """Upload a submission file (ZIP, PDF, etc.) to S3."""
    try:
        content = await file.read()
        file_ext = file.filename.split('.')[-1].lower()
        
        # Security: Prevent dangerous file types
        if file_ext in ['exe', 'bat', 'sh', 'php', 'aspx', 'py', 'js']:
            raise HTTPException(status_code=400, detail="Forbidden file type")
            
        import uuid
        s3_key = f"submissions/user_{current_user.id}/{uuid.uuid4()}_{file.filename}"
        url = await upload_bytes_to_s3(content, s3_key, file.content_type)
        
        return success({"file_url": url, "filename": file.filename})
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Submission Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assessments")
async def list_assessments(
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(Assessment).where(Assessment.is_deleted == False).order_by(Assessment.created_at.desc())
    if current_user.role.value != "super_admin":
        query = query.where(Assessment.org_id == current_user.org_id)
    result = await db.execute(query)
    assessments = result.scalars().all()
    return success([{
        "id": a.id, "title": a.title, "type": a.type.value, "status": a.status.value,
        "pass_score": float(a.pass_score), "time_limit_minutes": a.time_limit_minutes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in assessments])


@router.get("/assessments/{assessment_id}")
async def get_assessment(
    assessment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id, Assessment.org_id == current_user.org_id, Assessment.is_deleted == False))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found or access denied")

    q_result = await db.execute(
        select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id).order_by(AssessmentQuestion.order_index)
    )
    questions = q_result.scalars().all()
    
    is_candidate = current_user.role.value == "candidate"

    formatted_questions = [{
        "id": q.id, "question_text": q.question_text, "question_type": q.question_type.value if hasattr(q.question_type, 'value') else q.question_type,
        "options": q.options, "marks": float(q.marks), "skill_id": q.skill_id,
        "starter_code": q.starter_code, "test_cases": q.test_cases, "programming_language": q.programming_language,
        "order_index": q.order_index,
        "images": q.images or [],
        "tags": q.tags or [],
        # Only expose correct answers to HR/admin roles, never to candidates
        **({}  if is_candidate else {"correct_answer": q.correct_answer, "model_answer": q.model_answer}),
    } for q in questions]

    # For candidates (and any user taking the test), return assignment id + strike/timer state
    assignment_meta = {}
    assgn_res = await db.execute(select(AssessmentAssignment).where(AssessmentAssignment.assessment_id == assessment_id, AssessmentAssignment.user_id == current_user.id))
    assgn = assgn_res.scalar_one_or_none()
    if assgn:
        # ── session_already_started is true whenever started_at is set ─────────
        # This is the single source of truth. It MUST NOT be gated on
        # time_limit_minutes — a candidate who already started must always see
        # the resume warning, even on unlimited assessments.
        session_already_started = assgn.started_at is not None

        # ── Compute server-side time remaining ────────────────────────────────
        time_remaining_seconds = None
        if assgn.started_at and a.time_limit_minutes:
            elapsed = (datetime.utcnow() - assgn.started_at).total_seconds()
            total = a.time_limit_minutes * 60
            time_remaining_seconds = max(0, total - int(elapsed))

        assignment_meta = {
            "assignment_id": assgn.id,
            "strike_count": assgn.strike_count or 0,
            "terminated_by_proctor": assgn.terminated_by_proctor or False,
            "time_remaining_seconds": time_remaining_seconds,
            "session_already_started": session_already_started,
        }
        if is_candidate and assgn.custom_questions:
            # Strip correct_answer / model_answer from the stored custom question set
            _CANDIDATE_STRIP = {"correct_answer", "model_answer"}
            formatted_questions = [
                {k: v for k, v in cq.items() if k not in _CANDIDATE_STRIP}
                for cq in assgn.custom_questions
            ]

    return success({
        "id": a.id, "title": a.title, "description": a.description,
        "type": a.type.value, "time_limit_minutes": a.time_limit_minutes,
        "pass_score": float(a.pass_score), "shuffle_questions": a.shuffle_questions,
        "show_result_immediately": a.show_result_immediately,
        "status": a.status.value,
        "questions": formatted_questions,
        **assignment_meta,
    })


@router.post("/assessments/{assessment_id}/publish")
async def publish_assessment(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    a.status = AssessmentStatus.active
    await db.commit()
    return success(message="Assessment published")


class RecordStrikeRequest(BaseModel):
    assignment_id: int
    violation_name: str
    is_terminal: bool = False  # True when MAX_STRIKES is reached


@router.post("/record-strike")
async def record_strike(
    body: RecordStrikeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist a proctoring strike to the database so it survives page reloads."""
    assgn_res = await db.execute(
        select(AssessmentAssignment).where(
            AssessmentAssignment.id == body.assignment_id,
            AssessmentAssignment.user_id == current_user.id,
        )
    )
    assgn = assgn_res.scalar_one_or_none()
    if not assgn:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assgn.terminated_by_proctor:
        # Already terminated — return current state without incrementing
        return success({"strike_count": assgn.strike_count, "terminated": True})

    assgn.strike_count = (assgn.strike_count or 0) + 1
    if body.is_terminal:
        assgn.terminated_by_proctor = True
        assgn.status = AssignmentStatus.started  # keep it non-completed until submit

    await db.commit()
    return success({"strike_count": assgn.strike_count, "terminated": assgn.terminated_by_proctor})


class StartSessionRequest(BaseModel):
    assessment_id: int


@router.post("/start-session")
async def start_session(
    body: StartSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record the wall-clock timestamp when a candidate first opens the assessment.

    Idempotent — calling it again on a re-visit does NOT overwrite started_at,
    so the timer cannot be reset by closing and reopening the page.

    Auto-creates an AssessmentAssignment row if one doesn't exist, making
    session tracking work for any user who accesses the assessment URL.
    """
    # Verify assessment exists and belongs to user's org
    asmt_res = await db.execute(
        select(Assessment).where(Assessment.id == body.assessment_id, Assessment.org_id == current_user.org_id)
    )
    asmt = asmt_res.scalar_one_or_none()
    if not asmt:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Fetch or create the assignment row for this user
    assgn_res = await db.execute(
        select(AssessmentAssignment).where(
            AssessmentAssignment.assessment_id == body.assessment_id,
            AssessmentAssignment.user_id == current_user.id,
        )
    )
    assgn = assgn_res.scalar_one_or_none()

    if not assgn:
        # No formal assignment — create one now so session state can be tracked
        assgn = AssessmentAssignment(
            assessment_id=body.assessment_id,
            user_id=current_user.id,
            assigned_by=current_user.id,  # self-assigned (direct access)
            status=AssignmentStatus.pending,
        )
        db.add(assgn)
        await db.flush()  # get assgn.id without full commit

    if assgn.terminated_by_proctor:
        raise HTTPException(status_code=403, detail="Assessment has been terminated by proctoring system.")

    is_resume = assgn.started_at is not None

    if not is_resume:
        # First time — stamp the start time
        assgn.started_at = datetime.utcnow()
        assgn.status = AssignmentStatus.started

    await db.commit()
    await db.refresh(assgn)

    time_remaining_seconds = None
    if asmt.time_limit_minutes and assgn.started_at:
        elapsed = (datetime.utcnow() - assgn.started_at).total_seconds()
        total = asmt.time_limit_minutes * 60
        time_remaining_seconds = max(0, total - int(elapsed))

    return success({
        "assignment_id": assgn.id,
        "is_resume": is_resume,
        "time_remaining_seconds": time_remaining_seconds,
        "strike_count": assgn.strike_count or 0,
    })


@router.patch("/assessments/{assessment_id}/status")
async def update_assessment_status(
    assessment_id: int,
    body: AssessmentStatusUpdate,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id, Assessment.org_id == current_user.org_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    a.status = body.status
    await db.commit()
    return success(message=f"Assessment status updated to {body.status.value}")


@router.delete("/assessments/{assessment_id}")
async def delete_assessment(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id, Assessment.org_id == current_user.org_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    a.is_deleted = True
    await db.commit()
    return success(message="Assessment deleted")


# ── Assignment ────────────────────────────────────────────────────────────────

class AssignRequest(BaseModel):
    user_ids: List[int]
    deadline: Optional[str] = None
    question_ids: Optional[List[int]] = None  # Subset selection; None = all questions

async def generate_variants_bg(assessment_id: int, user_ids: list):
    from app.database import AsyncSessionLocal
    from app.agents.agents import call_llm
    
    async with AsyncSessionLocal() as db:
        q_res = await db.execute(select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id).order_by(AssessmentQuestion.order_index))
        base_questions = q_res.scalars().all()
        if not base_questions: return
        
        base_q_list = [{
            "id": q.id, "question_text": q.question_text, "question_type": q.question_type.value if hasattr(q.question_type, 'value') else q.question_type,
            "options": q.options, "marks": float(q.marks), "skill_id": q.skill_id,
            "starter_code": q.starter_code, "test_cases": q.test_cases, "programming_language": q.programming_language,
            "order_index": q.order_index,
        } for q in base_questions]
        
        system_prompt = "You are an expert instructional designer and anti-cheating AI."
        
        for user_id in user_ids:
            try:
                user_prompt = f"Create a cheat-proof variant of this assessment. Rewrite the 'question_text' to use completely different scenarios or wording but test the exact same concept and difficulty. ALSO, randomly shuffle the 'options' and update the 'correct_answer' accordingly to match the new options list. Return ONLY a JSON array of the updated questions. Keep the exact same JSON schema.\nQuestions:\n{json.dumps(base_q_list)}"
                ai_res = call_llm(system_prompt, user_prompt)
                custom_q = ai_res.get("questions") if isinstance(ai_res, dict) and "questions" in ai_res else ai_res
                
                if custom_q and isinstance(custom_q, list):
                    assgn_res = await db.execute(select(AssessmentAssignment).where(AssessmentAssignment.assessment_id == assessment_id, AssessmentAssignment.user_id == user_id))
                    assgn = assgn_res.scalar_one_or_none()
                    if assgn:
                        assgn.custom_questions = custom_q
                        await db.commit()
            except Exception as e:
                print(f"Failed to generate custom variant for user {user_id}: {e}")

from fastapi import BackgroundTasks

@router.post("/assessments/{assessment_id}/assign")
async def assign_assessment(
    assessment_id: int,
    body: AssignRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    import random as _random
    from datetime import datetime
    deadline = datetime.fromisoformat(body.deadline) if body.deadline else None
    assigned = 0

    # Pre-fetch assessment metadata for email
    asmt_res = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    asmt_obj = asmt_res.scalar_one_or_none()

    # Fetch all questions in this assessment
    q_res = await db.execute(
        select(AssessmentQuestion)
        .where(AssessmentQuestion.assessment_id == assessment_id)
        .order_by(AssessmentQuestion.order_index)
    )
    all_questions = q_res.scalars().all()

    # Determine subset of questions to assign (if question_ids provided)
    if body.question_ids:
        id_set = set(body.question_ids)
        pool = [q for q in all_questions if q.id in id_set]
    else:
        pool = list(all_questions)

    q_count = len(pool)
    assessment_title = asmt_obj.title if asmt_obj else "New Assessment"
    time_limit = asmt_obj.time_limit_minutes if asmt_obj else None
    pass_score = asmt_obj.pass_score if asmt_obj else None

    def _make_shuffled_question_set(questions):
        """Return a shuffled copy of questions with shuffled MCQ options per question."""
        shuffled = list(questions)
        _random.shuffle(shuffled)
        result = []
        for q in shuffled:
            qt = q.question_type.value if hasattr(q.question_type, 'value') else q.question_type
            opts = list(q.options) if q.options else []
            correct = q.correct_answer

            if qt in ("mcq", "mcq_multi") and opts:
                # Shuffle options and update correct_answer reference
                try:
                    if qt == "mcq_multi":
                        import json as _json
                        correct_list = _json.loads(correct or "[]")
                        if not isinstance(correct_list, list):
                            correct_list = []
                    else:
                        correct_list = None
                except Exception:
                    correct_list = None

                _random.shuffle(opts)

                if qt == "mcq":
                    # correct_answer is a plain string value
                    pass  # value unchanged, only positions changed
                else:
                    import json as _json
                    # rebuild the JSON array (values unchanged, order of options changed)
                    correct = _json.dumps(correct_list) if correct_list is not None else correct

            result.append({
                "id": q.id,
                "question_text": q.question_text,
                "question_type": qt,
                "options": opts,
                # correct_answer & model_answer are stored here for grading purposes
                # but are stripped out before being returned to candidates in get_assessment
                "correct_answer": correct,
                "model_answer": q.model_answer,
                "starter_code": q.starter_code,
                "test_cases": q.test_cases,
                "programming_language": q.programming_language,
                "marks": float(q.marks),
                "order_index": q.order_index,
                "images": q.images or [],
                "tags": q.tags or [],
                "skill_id": q.skill_id,
            })
        return result

    new_assignments = []
    for uid in body.user_ids:
        existing_res = await db.execute(
            select(AssessmentAssignment).where(
                AssessmentAssignment.assessment_id == assessment_id,
                AssessmentAssignment.user_id == uid
            )
        )
        existing_assgn = existing_res.scalar_one_or_none()

        # Build a per-user shuffled question set
        custom_q = _make_shuffled_question_set(pool)

        if existing_assgn:
            existing_assgn.status = AssignmentStatus.pending
            existing_assgn.started_at = None
            existing_assgn.deadline = deadline
            existing_assgn.assigned_by = current_user.id
            existing_assgn.custom_questions = custom_q
            # CRITICAL: Reset proctoring state so the user isn't instantly blocked
            existing_assgn.strike_count = 0
            existing_assgn.terminated_by_proctor = False
            new_assignments.append(uid)
            assigned += 1
        else:
            assgn = AssessmentAssignment(
                assessment_id=assessment_id,
                user_id=uid,
                assigned_by=current_user.id,
                deadline=deadline,
                status=AssignmentStatus.pending,
                custom_questions=custom_q,
            )
            db.add(assgn)
            new_assignments.append(uid)
            assigned += 1

    await db.commit()

    if skipped := len(body.user_ids) - assigned:
        print(f"Skipped {skipped} existing assignments.")

    for uid in new_assignments:
        user_res = await db.execute(select(User).where(User.id == uid))
        user_obj = user_res.scalar_one_or_none()
        if user_obj and user_obj.email:
            try:
                import asyncio
                asyncio.create_task(send_assignment_notification_email(
                    to_email=user_obj.email,
                    candidate_name=user_obj.full_name or user_obj.email.split('@')[0],
                    assessment_title=assessment_title,
                    deadline=body.deadline,
                    duration_mins=time_limit,
                    question_count=q_count,
                    pass_score=pass_score
                ))
            except Exception as e:
                print(f"Failed to trigger email for {user_obj.email}: {e}")

    return success({"assigned": assigned})


# ── Question Bank (Bucket) ────────────────────────────────────────────────────

class QuestionBankCreate(BaseModel):
    question_text: str
    question_type: str = "mcq"
    options: Optional[list] = None
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: Optional[list] = None
    programming_language: Optional[str] = None
    marks: float = 1.0
    tags: Optional[List[str]] = []
    images: Optional[List[str]] = []


class BulkAddToDraftRequest(BaseModel):
    assessment_id: int
    bank_item_ids: List[int]


@router.post("/question-bank")
async def create_bank_item(
    body: QuestionBankCreate,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """Add a new reusable question to the organisation's question bank."""
    item = QuestionBankItem(
        org_id=current_user.org_id,
        question_text=body.question_text,
        question_type=body.question_type,
        options=body.options,
        correct_answer=body.correct_answer,
        model_answer=body.model_answer,
        starter_code=body.starter_code,
        test_cases=body.test_cases,
        programming_language=body.programming_language,
        marks=body.marks,
        tags=body.tags or [],
        images=body.images or [],
        created_by=current_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return success({"id": item.id})


@router.put("/question-bank/{item_id}")
async def update_bank_item(
    item_id: int,
    body: QuestionBankCreate,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing question in the organisation's question bank."""
    result = await db.execute(
        select(QuestionBankItem).where(
            QuestionBankItem.id == item_id,
            QuestionBankItem.org_id == current_user.org_id,
            QuestionBankItem.is_deleted == False
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Question not found")

    item.question_text = body.question_text
    item.question_type = body.question_type
    item.options = body.options
    item.correct_answer = body.correct_answer
    item.model_answer = body.model_answer
    item.starter_code = body.starter_code
    item.test_cases = body.test_cases
    item.programming_language = body.programming_language
    item.marks = body.marks
    item.tags = body.tags or []
    item.images = body.images or []

    await db.commit()
    return success({"message": "Question updated successfully"})


@router.get("/question-bank")
async def list_bank_items(
    tag: Optional[str] = None,
    q: Optional[str] = None,
    question_type: Optional[str] = None,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """List all questions in the organisation's question bank, with optional tag/type/text filters."""
    query = select(QuestionBankItem).where(
        QuestionBankItem.org_id == current_user.org_id,
        QuestionBankItem.is_deleted == False,
    ).order_by(QuestionBankItem.created_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()

    # Apply in-memory filters (JSON column tag filtering is easier this way)
    if tag:
        tag_lower = tag.lower()
        items = [i for i in items if i.tags and any(t.lower() == tag_lower for t in i.tags)]
    if question_type:
        items = [i for i in items if (i.question_type.value if hasattr(i.question_type, 'value') else i.question_type) == question_type]
    if q:
        q_lower = q.lower()
        items = [i for i in items if q_lower in (i.question_text or '').lower()]

    return success([{
        "id": item.id,
        "question_text": item.question_text,
        "question_type": item.question_type.value if hasattr(item.question_type, 'value') else item.question_type,
        "options": item.options,
        "correct_answer": item.correct_answer,
        "model_answer": item.model_answer,
        "starter_code": item.starter_code,
        "test_cases": item.test_cases,
        "programming_language": item.programming_language,
        "marks": float(item.marks),
        "tags": item.tags or [],
        "images": item.images or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
    } for item in items])


@router.delete("/question-bank/{item_id}")
async def delete_bank_item(
    item_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a question from the bank."""
    result = await db.execute(
        select(QuestionBankItem).where(
            QuestionBankItem.id == item_id,
            QuestionBankItem.org_id == current_user.org_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Bank item not found")
    item.is_deleted = True
    await db.commit()
    return success(message="Deleted from question bank")


@router.post("/question-bank/bulk-add-to-assessment")
async def bulk_add_bank_to_assessment(
    body: BulkAddToDraftRequest,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """Add selected question bank items into an existing assessment draft."""
    # Verify assessment belongs to this org
    asmt_res = await db.execute(
        select(Assessment).where(
            Assessment.id == body.assessment_id,
            Assessment.org_id == current_user.org_id,
            Assessment.is_deleted == False,
        )
    )
    assessment = asmt_res.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found or access denied")

    # Get current max order_index
    order_res = await db.execute(
        select(func.max(AssessmentQuestion.order_index)).where(
            AssessmentQuestion.assessment_id == body.assessment_id
        )
    )
    max_order = order_res.scalar_one() or 0

    # Fetch bank items
    bank_res = await db.execute(
        select(QuestionBankItem).where(
            QuestionBankItem.id.in_(body.bank_item_ids),
            QuestionBankItem.org_id == current_user.org_id,
            QuestionBankItem.is_deleted == False,
        )
    )
    bank_items = bank_res.scalars().all()

    added = 0
    for idx, item in enumerate(bank_items):
        qt = item.question_type.value if hasattr(item.question_type, 'value') else item.question_type
        q = AssessmentQuestion(
            assessment_id=body.assessment_id,
            question_text=item.question_text,
            question_type=qt,
            options=item.options,
            correct_answer=item.correct_answer,
            model_answer=item.model_answer,
            starter_code=item.starter_code,
            test_cases=item.test_cases,
            programming_language=item.programming_language,
            marks=item.marks,
            tags=item.tags or [],
            images=item.images or [],
            order_index=max_order + idx + 1,
        )
        db.add(q)
        added += 1

    await db.commit()
    return success({"added": added, "assessment_id": body.assessment_id})


@router.post("/question-bank/import-file")
async def import_file_to_bank(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """Parse a CSV / JSON / PDF file and save all extracted questions into the Question Bank."""
    try:
        content = await file.read()
        text = await extract_text_from_file(content, file.filename)
        questions = await parse_questions_with_ai(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    added = 0
    for q in questions:
        qt = q.get("question_type", "written")
        item = QuestionBankItem(
            org_id=current_user.org_id,
            created_by=current_user.id,
            question_text=q.get("question_text", "").strip(),
            question_type=qt,
            options=q.get("options") or [],
            correct_answer=q.get("correct_answer"),
            model_answer=q.get("model_answer"),
            starter_code=q.get("starter_code"),
            test_cases=q.get("test_cases"),
            programming_language=q.get("programming_language"),
            marks=float(q.get("marks", 1)),
            tags=q.get("tags") or [],
            images=q.get("images") or [],
        )
        if item.question_text:
            db.add(item)
            added += 1

    await db.commit()
    return success({"added": added})


class BankURLImportRequest(BaseModel):
    url: str
    tags: Optional[List[str]] = []


@router.post("/question-bank/import-url")
async def import_url_to_bank(
    body: BankURLImportRequest,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    """Scrape a URL (e.g. LeetCode problem) and save the resulting question into the Question Bank."""
    try:
        import httpx
        from bs4 import BeautifulSoup
        import re

        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(body.url, headers=headers)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            # Remove scripts/styles
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            page_text = soup.get_text(separator="\n", strip=True)[:8000]

        questions = await parse_questions_with_ai(page_text)
        if not questions:
            raise HTTPException(status_code=422, detail="Could not extract any questions from the URL content.")

        added = 0
        for q in questions:
            item = QuestionBankItem(
                org_id=current_user.org_id,
                created_by=current_user.id,
                question_text=q.get("question_text", "").strip(),
                question_type=q.get("question_type", "written"),
                options=q.get("options") or [],
                correct_answer=q.get("correct_answer"),
                model_answer=q.get("model_answer"),
                starter_code=q.get("starter_code"),
                test_cases=q.get("test_cases"),
                programming_language=q.get("programming_language"),
                marks=float(q.get("marks", 1)),
                tags=(body.tags or []) + (q.get("tags") or []),
                images=q.get("images") or [],
            )
            if item.question_text:
                db.add(item)
                added += 1

        await db.commit()
        return success({"added": added})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))





@router.get("/my-assessments")
async def my_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentAssignment, Assessment).join(Assessment)
        .where(AssessmentAssignment.user_id == current_user.id, Assessment.is_deleted == False)
    )
    rows = result.all()
    return success([{
        "assignment_id": assgn.id,
        "assessment_id": asmt.id,
        "title": asmt.title,
        "description": asmt.description,
        "time_limit_minutes": asmt.time_limit_minutes,
        "deadline": assgn.deadline.isoformat() if assgn.deadline else None,
        "status": assgn.status.value,
        "show_result_immediately": asmt.show_result_immediately,
    } for assgn, asmt in rows])


# ── Execution Sandbox ──────────────────────────────────────────────────────────

class RunCodeRequest(BaseModel):
    language: str = "python"
    code: str
    stdin: Optional[str] = ""
    test_cases: Optional[list] = None

SUPPORTED_CODE_LANGUAGES = {"python", "javascript", "java", "cpp"}


def _normalize_language(language: str) -> str:
    lang = (language or "python").lower().strip()
    language_aliases = {
        "c++": "cpp",
        "cpp17": "cpp",
        "python3": "python",
        "py": "python",
        "js": "javascript",
        "node": "javascript",
        "nodejs": "javascript",
    }
    normalized = language_aliases.get(lang, lang)
    if normalized not in SUPPORTED_CODE_LANGUAGES:
        raise ValueError(
            f"Unsupported language '{language}'. Supported languages: Python 3, JavaScript, Java, and C++."
        )
    return normalized


def _prepare_test_cases(test_cases: list) -> list:
    prepared = []
    for tc in test_cases or []:
        if not isinstance(tc, dict):
            continue
        expected = tc.get("expected_output", tc.get("expected", ""))
        prepared.append({
            "input": "" if tc.get("input") is None else str(tc.get("input", "")),
            "expected_output": "" if expected is None else str(expected),
        })
    return prepared


def _compact_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _normalize_output_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return _compact_json(value)


def _normalize_compare_value(value) -> str:
    import ast

    if value is None:
        return ""
    if not isinstance(value, str):
        return _compact_json(value)

    text = value.strip()
    if not text:
        return ""

    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(text)
            return _compact_json(parsed) if not isinstance(parsed, str) else parsed.strip()
        except Exception:
            continue
    return "".join(text.split())


def _split_inline_args(raw: str) -> list:
    parts = []
    current = []
    depth = 0
    in_string = False
    string_char = ""

    for ch in str(raw):
        if in_string:
            current.append(ch)
            if ch == string_char:
                in_string = False
            continue

        if ch in {"'", '"'}:
            in_string = True
            string_char = ch
            current.append(ch)
            continue

        if ch in {"[", "{", "("}:
            depth += 1
        elif ch in {"]", "}", ")"} and depth > 0:
            depth -= 1

        if ch == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue

        current.append(ch)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def _clean_inline_arg(raw: str) -> str:
    import re

    return re.sub(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*", "", str(raw)).strip()


def _extract_python_entry(code: str):
    import re

    func_matches = list(re.finditer(r"^\s*def\s+([a-zA-Z0-9_]+)\s*\(", code, re.MULTILINE))
    if not func_matches:
        return None, None

    class_matches = list(re.finditer(r"^\s*class\s+([a-zA-Z0-9_]+)\s*[\(:]", code, re.MULTILINE))
    func_name = func_matches[-1].group(1)
    class_name = class_matches[-1].group(1) if class_matches else None
    return func_name, class_name


def _extract_javascript_entry(code: str):
    import re

    patterns = [
        r"function\s+([a-zA-Z0-9_]+)\s*\(",
        r"const\s+([a-zA-Z0-9_]+)\s*=\s*\(",
        r"const\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",
        r"var\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",
        r"let\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",
        r"var\s+([a-zA-Z0-9_]+)\s*=\s*\(",
        r"let\s+([a-zA-Z0-9_]+)\s*=\s*\(",
    ]
    matches = []
    for pattern in patterns:
        matches.extend(re.finditer(pattern, code))
    if not matches:
        return None
    return matches[-1].group(1)


def _supports_batch_harness(code: str, language: str) -> bool:
    if language == "python":
        return _extract_python_entry(code)[0] is not None
    if language == "javascript":
        return _extract_javascript_entry(code) is not None
    return False


def _parse_batch_results(stdout: str):
    start_marker = "---BATCH_RESULTS_START---"
    end_marker = "---BATCH_RESULTS_END---"
    if start_marker not in stdout or end_marker not in stdout:
        return []
    try:
        payload = stdout.split(start_marker, 1)[1].split(end_marker, 1)[0].strip()
        return json.loads(payload)
    except Exception:
        return []


# ── LeetCode-style Solution class detection & wrapping ────────────────────────

def _is_solution_class(code: str, language: str) -> bool:
    import re
    if language == "java":
        return bool(re.search(r'\bclass\s+Solution\b', code)) and not bool(re.search(r'public\s+static\s+void\s+main\s*\(', code))
    if language == "cpp":
        return bool(re.search(r'\bclass\s+Solution\b', code)) and not bool(re.search(r'\bint\s+main\s*\(', code))
    return False


def _extract_java_solution_method(code: str):
    import re
    for m in re.finditer(r'public\s+([\w<>\[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)', code):
        name = m.group(2)
        if name not in ("Solution", "main"):
            return m.group(1).strip(), name, m.group(3).strip()
    return None, None, None


def _parse_type_params(params_str: str):
    """Split 'int[] nums, int target' → [('int[]','nums'), ('int','target')]"""
    if not params_str.strip():
        return []
    parts, depth, cur = [], 0, ""
    for ch in params_str:
        if ch in "<([": depth += 1
        elif ch in ">)]": depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip()); cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    result = []
    for p in parts:
        seg = p.strip().rsplit(None, 1)
        if len(seg) == 2:
            result.append((seg[0].strip(), seg[1].strip()))
    return result


def _java_parse(t: str, var: str) -> str:
    t = t.strip().replace("final ", "")
    if t == "int":           return f"Integer.parseInt({var}.trim())"
    if t == "long":          return f"Long.parseLong({var}.trim())"
    if t in ("double","float"): return f"Double.parseDouble({var}.trim())"
    if t == "boolean":       return f"Boolean.parseBoolean({var}.trim())"
    if t == "char":          return var + '.trim().replaceAll("^\\"|\\"$", "").replaceAll("^\'|\'$", "").charAt(0)'
    if t == "String":        return var + '.trim().replaceAll("^\\"|\\"$", "").replaceAll("^\'|\'$", "")'
    if t == "int[]":         return f"__intArr({var})"
    if t == "long[]":        return f"__longArr({var})"
    if t == "double[]":      return f"__dblArr({var})"
    if t == "String[]":      return f"__strArr({var})"
    if t == "char[]":        return f"{var}.trim().replaceAll(\"[\\\\[\\\\]\\\"']\",\"\").toCharArray()"
    if "List<Integer>" in t: return f"__intList({var})"
    if "List<String>" in t:  return f"__strList({var})"
    if "List<List<Integer>>" in t: return f"__intListList({var})"
    return var


def _java_print(t: str, var: str) -> str:
    t = t.strip()
    if t in ("int","long","double","float","boolean","String","char","void"): return f"System.out.println({var});"
    if t == "int[]":   return f"System.out.println(java.util.Arrays.toString({var}).replace(\", \",\",\"));"
    if t == "long[]":  return f"System.out.println(java.util.Arrays.toString({var}).replace(\", \",\",\"));"
    if t == "char[]":  return f"System.out.println(new String({var}));"
    if "List" in t:    return f"System.out.println({var}.toString().replace(\", \",\",\"));"
    return f"System.out.println({var});"


def _wrap_java_solution(code: str) -> str:
    import re
    # Remove 'public' from class Solution so file can have public class Main
    code = re.sub(r'\bpublic\s+(class\s+Solution\b)', r'\1', code)
    ret, name, params_str = _extract_java_solution_method(code)
    if not name:
        return code
    params = _parse_type_params(params_str)

    read_lines = []
    call_args = []
    for i, (ptype, pname) in enumerate(params):
        vraw = f"__raw{i}"
        read_lines.append(f"        String {vraw} = __sc.hasNextLine() ? __sc.nextLine().trim() : \"\";")
        read_lines.append(f"        {ptype} {pname} = {_java_parse(ptype, vraw)};")
        call_args.append(pname)

    call = f"sol.{name}({', '.join(call_args)})"
    if ret and ret != "void":
        run_block = f"        {ret} __r = {call};\n        {_java_print(ret, '__r')}"
    else:
        run_block = f"        {call};"

    body = "\n".join(read_lines) + "\n" + run_block

    return f"""import java.util.*;
import java.util.stream.*;

{code}

public class Main {{
    static Scanner __sc = new Scanner(System.in);

    static int[]    __intArr(String s) {{ s=s.trim().replaceAll("^\\\\[|\\\\]$",""); if(s.isEmpty()) return new int[0]; return Arrays.stream(s.split(",")).mapToInt(x->Integer.parseInt(x.trim())).toArray(); }}
    static long[]   __longArr(String s) {{ s=s.trim().replaceAll("^\\\\[|\\\\]$",""); if(s.isEmpty()) return new long[0]; return Arrays.stream(s.split(",")).mapToLong(x->Long.parseLong(x.trim())).toArray(); }}
    static double[] __dblArr(String s) {{ s=s.trim().replaceAll("^\\\\[|\\\\]$",""); if(s.isEmpty()) return new double[0]; return Arrays.stream(s.split(",")).mapToDouble(x->Double.parseDouble(x.trim())).toArray(); }}
    static String[] __strArr(String s) {{ s=s.trim().replaceAll("^\\\\[|\\\\]$",""); if(s.isEmpty()) return new String[0]; return Arrays.stream(s.split(",")).map(x->x.trim().replaceAll("^\\"|\\"$","")).toArray(String[]::new); }}
    static List<Integer> __intList(String s) {{ int[] a=__intArr(s); List<Integer> l=new ArrayList<>(); for(int x:a) l.add(x); return l; }}
    static List<String>  __strList(String s) {{ return new ArrayList<>(Arrays.asList(__strArr(s))); }}
    static List<List<Integer>> __intListList(String s) {{
        s=s.trim(); List<List<Integer>> r=new ArrayList<>(); if(s.equals("[]")) return r;
        s=s.substring(1,s.length()-1); int d=0; StringBuilder c=new StringBuilder();
        for(char ch:s.toCharArray()) {{ if(ch=='[') d++; else if(ch==']') d--; if(ch==','&&d==0) {{ r.add(__intList(c.toString())); c=new StringBuilder(); }} else c.append(ch); }}
        if(c.length()>0) r.add(__intList(c.toString())); return r;
    }}

    public static void main(String[] args) {{
        try {{
            Solution sol = new Solution();
{body}
        }} catch(Exception e) {{ System.err.println(e.toString()); }}
    }}
}}"""


def _extract_cpp_solution_method(code: str):
    import re
    # Find methods inside class Solution: skip constructors/destructors
    in_class = re.search(r'\bclass\s+Solution\b.*?\{(.*)\}[\s;]*$', code, re.DOTALL)
    if not in_class:
        return None, None, None
    body = in_class.group(1)
    for m in re.finditer(r'([\w:<>\*&\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{', body):
        name = m.group(2)
        if not name[0].isupper() and name != "main":
            return m.group(1).strip(), name, m.group(3).strip()
    return None, None, None


def _cpp_parse(t: str, var: str) -> str:
    t = t.strip().replace("&","").replace("const ","").strip()
    if t == "int":          return f"stoi({var})"
    if t in ("long","long long"): return f"stoll({var})"
    if t in ("double","float"): return f"stod({var})"
    if t == "bool":         return f"({var} == \"true\")"
    if t == "char":         return f"__parseChar({var})"
    if t == "string":       return f"__parseStr({var})"
    if "vector<int>" in t or "vector<long" in t: return f"__parseVecInt({var})"
    if "vector<string>" in t: return f"__parseVecStr({var})"
    if "vector<vector<int>>" in t: return f"__parseVecVecInt({var})"
    return var


def _cpp_print(t: str, var: str) -> str:
    t = t.strip()
    if "vector<vector" in t: return f"cout << __fmtVVI({var}) << endl;"
    if "vector" in t:        return f"cout << __fmtVI({var}) << endl;"
    return f"cout << {var} << endl;"


def _wrap_cpp_solution(code: str) -> str:
    ret, name, params_str = _extract_cpp_solution_method(code)
    if not name:
        return code
    params = _parse_type_params(params_str)

    read_lines = []
    call_args = []
    for i, (ptype, pname) in enumerate(params):
        clean_type = ptype.replace("&","").replace("const ","").strip()
        read_lines.append(f"    string __raw{i}; getline(cin, __raw{i});")
        read_lines.append(f"    {clean_type} {pname} = {_cpp_parse(ptype, f'__raw{i}')};")
        call_args.append(pname)

    call = f"sol.{name}({', '.join(call_args)})"
    if ret and ret != "void":
        run_block = f"    auto __r = {call};\n    {_cpp_print(ret, '__r')}"
    else:
        run_block = f"    {call};"

    body = "\n".join(read_lines) + "\n" + run_block

    return f"""#include <bits/stdc++.h>
using namespace std;

{code}

vector<int> __parseVecInt(string s) {{
    s.erase(remove(s.begin(),s.end(),'['),s.end());
    s.erase(remove(s.begin(),s.end(),']'),s.end());
    vector<int> v; stringstream ss(s); string t;
    while(getline(ss,t,',')) {{ t.erase(remove(t.begin(),t.end(),' '),t.end()); if(!t.empty()) v.push_back(stoi(t)); }}
    return v;
}}
vector<string> __parseVecStr(string s) {{
    s.erase(remove(s.begin(),s.end(),'['),s.end());
    s.erase(remove(s.begin(),s.end(),']'),s.end());
    s.erase(remove(s.begin(),s.end(),'"'),s.end());
    vector<string> v; stringstream ss(s); string t;
    while(getline(ss,t,',')) {{ t.erase(remove(t.begin(),t.end(),' '),t.end()); if(!t.empty()) v.push_back(t); }}
    return v;
}}
vector<vector<int>> __parseVecVecInt(string s) {{
    vector<vector<int>> r; int d=0; string cur="";
    for(char c:s) {{ if(c=='['&&d++>0) cur+=c; else if(c==']'&&--d>0) cur+=c; else if(c==']'&&d==0) {{ r.push_back(__parseVecInt(cur)); cur=""; }} else if(c==','&&d==1) {{ }} else if(d>0) cur+=c; }}
    return r;
}}
string __parseStr(string s) {{
    if(!s.empty() && (s.front()=='"' || s.front()=='\'')) s.erase(0, 1);
    if(!s.empty() && (s.back()=='"' || s.back()=='\'')) s.pop_back();
    return s;
}}
char __parseChar(string s) {{
    string p = __parseStr(s);
    return p.empty() ? ' ' : p[0];
}}
string __fmtVI(vector<int>& v) {{ string s="["; for(int i=0;i<(int)v.size();i++) {{ if(i) s+=","; s+=to_string(v[i]); }} return s+"]"; }}
string __fmtVVI(vector<vector<int>>& v) {{ string s="["; for(int i=0;i<(int)v.size();i++) {{ if(i) s+=","; string t="["; for(int j=0;j<(int)v[i].size();j++) {{ if(j) t+=","; t+=to_string(v[i][j]); }} s+=t+"]"; }} return s+"]"; }}

int main() {{
    try {{
        Solution sol;
{body}
    }} catch(exception& e) {{ cerr << e.what() << endl; }}
    return 0;
}}"""


def wrap_code_for_execution(code: str, language: str, test_cases: list = None) -> str:
    test_cases = test_cases or []

    if language == "python":
        func_name, class_name = _extract_python_entry(code)
        if not func_name:
            return code

        tests_literal = _compact_json(test_cases)
        wrapper = f"""
import json, ast, traceback

__TEST_CASES = json.loads(r'''{tests_literal}''')
__ENTRY_FUNC = "{func_name}"
__ENTRY_CLASS = {repr(class_name)}

def _split_inline_args(raw):
    parts = []
    current = []
    depth = 0
    in_string = False
    string_char = ""

    for ch in str(raw):
        if in_string:
            current.append(ch)
            if ch == string_char:
                in_string = False
            continue

        if ch in {{"'", '"'}}:
            in_string = True
            string_char = ch
            current.append(ch)
            continue

        if ch in {{"[", "{{", "("}}:
            depth += 1
        elif ch in {{"]", "}}", ")"}} and depth > 0:
            depth -= 1

        if ch == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue

        current.append(ch)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts

def _clean_inline_arg(raw):
    import re
    return re.sub(r"^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*", "", str(raw)).strip()

def __parse_value(raw):
    if not isinstance(raw, str):
        return raw
    text = raw.strip()
    if not text:
        return None
    for parser in (json.loads, ast.literal_eval):
        try:
            return parser(text)
        except Exception:
            continue
    return text

def __parse_args(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        args = raw.get("args")
        if isinstance(args, list):
            return args
        return [raw]
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) > 1:
        return [__parse_value(line) for line in lines]
    inline_parts = [_clean_inline_arg(part) for part in _split_inline_args(lines[0])]
    if len(inline_parts) > 1:
        return [__parse_value(part) for part in inline_parts]
    value = __parse_value(lines[0])
    if isinstance(value, dict) and isinstance(value.get("args"), list):
        return value["args"]
    if value is None:
        return []
    return [value]

def __normalize_output(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

def __resolve_target():
    target = None
    if __ENTRY_CLASS:
        cls = globals().get(__ENTRY_CLASS)
        if cls:
            try:
                target = getattr(cls(), __ENTRY_FUNC, None)
            except Exception:
                target = None
    if target is None:
        target = globals().get(__ENTRY_FUNC)
    return target

def __run_batch_harness():
    results = []
    target = __resolve_target()
    if not callable(target):
        for _tc in __TEST_CASES:
            results.append({{"stdout": "", "stderr": f"Entrypoint '{{__ENTRY_FUNC}}' not found"}})
        print("---BATCH_RESULTS_START---")
        print(json.dumps(results))
        print("---BATCH_RESULTS_END---")
        return

    for tc in __TEST_CASES:
        try:
            args = __parse_args(tc.get("input"))
            res = target(*args)
            results.append({{"stdout": __normalize_output(res), "stderr": ""}})
        except Exception:
            results.append({{"stdout": "", "stderr": traceback.format_exc()}})

    print("---BATCH_RESULTS_START---")
    print(json.dumps(results))
    print("---BATCH_RESULTS_END---")

__run_batch_harness()
"""
        return "from typing import *\n" + code + "\n" + wrapper

    if language == "javascript":
        func_name = _extract_javascript_entry(code)
        if not func_name:
            return code
        tests_literal = _compact_json(test_cases)
        wrapper = f"""
const __TEST_CASES = JSON.parse(String.raw`{tests_literal}`);
const __ENTRY_FUNC = "{func_name}";

function __parseValue(raw) {{
  if (typeof raw !== "string") return raw;
  const text = raw.trim();
  if (!text) return null;
  try {{ return JSON.parse(text); }} catch (e) {{}}
  return text;
}}

function __splitInlineArgs(raw) {{
  const parts = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (const ch of String(raw)) {{
    if (inString) {{
      current += ch;
      if (ch === stringChar) inString = false;
      continue;
    }}

    if (ch === "'" || ch === '"') {{
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }}

    if ("[{{(".includes(ch)) depth += 1;
    else if ("]}})".includes(ch) && depth > 0) depth -= 1;

    if (ch === "," && depth === 0) {{
      const part = current.trim();
      if (part) parts.push(part);
      current = "";
      continue;
    }}

    current += ch;
  }}

  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}}

function __parseArgs(raw) {{
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {{
    if (Array.isArray(raw.args)) return raw.args;
    return [raw];
  }}
  if (raw == null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  const lines = text.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map(__parseValue);
  const inlineParts = __splitInlineArgs(lines[0])
    .map((part) => part.trim().replace(/^[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*/, ""))
    .filter(Boolean);
  if (inlineParts.length > 1) return inlineParts.map(__parseValue);
  const value = __parseValue(lines[0]);
  if (value && typeof value === "object" && Array.isArray(value.args)) return value.args;
  return value == null ? [] : [value];
}}

function __normalizeOutput(value) {{
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}}

function __runBatchHarness() {{
  const results = [];
  let target = globalThis[__ENTRY_FUNC];
  if (typeof target !== "function") {{
    try {{ target = eval(__ENTRY_FUNC); }} catch (e) {{}}
  }}
  if (typeof target !== "function") {{
    for (const _tc of __TEST_CASES) {{
      results.push({{ stdout: "", stderr: `Entrypoint '${{__ENTRY_FUNC}}' not found` }});
    }}
    console.log("---BATCH_RESULTS_START---");
    console.log(JSON.stringify(results));
    console.log("---BATCH_RESULTS_END---");
    return;
  }}

  for (const tc of __TEST_CASES) {{
    try {{
      const args = __parseArgs(tc.input);
      const res = target(...args);
      results.push({{ stdout: __normalizeOutput(res), stderr: "" }});
    }} catch (e) {{
      results.push({{ stdout: "", stderr: String(e && e.stack ? e.stack : e) }});
    }}
  }}

  console.log("---BATCH_RESULTS_START---");
  console.log(JSON.stringify(results));
  console.log("---BATCH_RESULTS_END---");
}}

__runBatchHarness();
"""
        return code + "\n" + wrapper

    return code


async def _execute_locally(language: str, wrapped_code: str, stdin: str = ""):
    import asyncio
    import os
    import subprocess
    import shutil
    import sys
    import uuid

    file_map = {
        "python": "main.py",
        "javascript": "main.js",
        "java": "Main.java",
        "cpp": "main.cpp",
    }
    if language not in file_map:
        raise RuntimeError(f"Local execution is not available for language '{language}'")

    command_map = {
        "python": [sys.executable, "main.py"],
        "javascript": ["node", "main.js"],
    }

    compiler_map = {
        "java": ["javac", "Main.java"],
        "cpp": ["g++", "main.cpp", "-O2", "-std=c++17", "-o", "main.exe"],
    }

    required_binaries = {"python": sys.executable, "javascript": "node", "java": "javac", "cpp": "g++"}
    binary_name = required_binaries.get(language)
    if language == "python":
        python_exists = os.path.exists(sys.executable) or shutil.which(sys.executable) is not None
        if not python_exists:
            raise RuntimeError("Required local runtime for Python is not available")
    elif binary_name and shutil.which(binary_name) is None:
        raise RuntimeError(f"Required local runtime '{binary_name}' is not installed")
    if language == "java" and shutil.which("java") is None:
        raise RuntimeError("Required local runtime 'java' is not installed")

    base_exec_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".verify_exec"))
    os.makedirs(base_exec_dir, exist_ok=True)
    temp_dir = os.path.join(base_exec_dir, f"{language}_{uuid.uuid4().hex}")
    os.makedirs(temp_dir, exist_ok=True)

    try:
        source_path = os.path.join(temp_dir, file_map[language])
        with open(source_path, "w", encoding="utf-8") as handle:
            handle.write(wrapped_code)

        compile_result = None
        if language in compiler_map:
            try:
                compiler = await asyncio.to_thread(
                    subprocess.run,
                    compiler_map[language],
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    timeout=20,
                )
            except subprocess.TimeoutExpired:
                raise RuntimeError("Local compilation timed out")

            compile_result = {
                "stdout": compiler.stdout,
                "stderr": compiler.stderr,
                "output": f"{compiler.stdout}{compiler.stderr}",
                "code": compiler.returncode,
                "signal": None,
            }
            if compiler.returncode != 0:
                return {
                    "language": language,
                    "version": "local",
                    "compile": compile_result,
                    "run": {"stdout": "", "stderr": compile_result["stderr"], "output": compile_result["output"], "code": compiler.returncode, "signal": None},
                }

        if language == "java":
            run_command = ["java", "Main"]
        else:
            run_command = command_map.get(language, [os.path.join(temp_dir, "main.exe")])
        try:
            runner = await asyncio.to_thread(
                subprocess.run,
                run_command,
                cwd=temp_dir,
                input=stdin or "",
                capture_output=True,
                text=True,
                timeout=20,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Local execution timed out")

        return {
            "language": language,
            "version": "local",
            **({"compile": compile_result} if compile_result else {}),
            "run": {
                "stdout": runner.stdout,
                "stderr": runner.stderr,
                "output": f"{runner.stdout}{runner.stderr}",
                "code": runner.returncode,
                "signal": None,
            },
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


async def _execute_via_judge0(language: str, source_code: str, stdin: str = "") -> dict:
    """
    Execute code via Judge0 CE public API (no API key required).
    Uses submit→poll to avoid wait=true timeout issues with compiled languages.
    """
    import asyncio
    import httpx

    language_ids = {
        "python": 71,
        "javascript": 63,
        "java": 62,
        "cpp": 54,
    }
    lang_id = language_ids.get(language)
    if not lang_id:
        raise RuntimeError(f"Language '{language}' is not supported by the remote execution engine.")

    payload = {"language_id": lang_id, "source_code": source_code, "stdin": stdin or ""}
    base = "https://ce.judge0.com"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Submit
        resp = await client.post(f"{base}/submissions?base64_encoded=false", json=payload, headers={"Content-Type": "application/json"})
        resp.raise_for_status()
        token = resp.json().get("token")
        if not token:
            raise RuntimeError("Judge0 did not return a submission token")

        # 2. Poll until done (max 30s)
        for _ in range(30):
            await asyncio.sleep(1)
            r = await client.get(f"{base}/submissions/{token}?base64_encoded=false", timeout=15.0)
            r.raise_for_status()
            data = r.json()
            status_id = (data.get("status") or {}).get("id", 0)
            if status_id not in (1, 2):  # 1=In Queue, 2=Processing
                break

    stdout = data.get("stdout") or ""
    stderr = data.get("stderr") or ""
    compile_output = data.get("compile_output") or ""
    if compile_output:
        stderr = compile_output + ("\n" + stderr if stderr.strip() else "")

    return {
        "language": language,
        "version": "*",
        "run": {
            "stdout": stdout,
            "stderr": stderr,
            "output": stdout + stderr,
            "code": 0 if status_id == 3 else 1,
            "signal": None,
        },
    }


async def _execute_code(language: str, wrapped_code: str, stdin: str = "") -> dict:
    """
    Smart execution router:
      - Python  → local subprocess (fast, always available)
      - JS      → try local node first, fall back to Judge0
      - Java/C++→ Judge0 CE (no local compilers required)
    """
    if language == "python":
        try:
            return await _execute_locally(language, wrapped_code, stdin)
        except Exception as local_exc:
            logger.warning("Local Python execution failed (%s). Trying Judge0...", local_exc)
            return await _execute_via_judge0(language, wrapped_code, stdin)

    if language == "javascript":
        try:
            return await _execute_locally(language, wrapped_code, stdin)
        except Exception as local_exc:
            logger.warning("Local JS execution failed (%s). Trying Judge0...", local_exc)
            return await _execute_via_judge0(language, wrapped_code, stdin)

    # Java / C++ — go straight to Judge0 (no local compiler assumed)
    try:
        return await _execute_via_judge0(language, wrapped_code, stdin)
    except Exception as judge0_exc:
        logger.warning("Judge0 failed for %s (%s). Trying local...", language, judge0_exc)
        try:
            return await _execute_locally(language, wrapped_code, stdin)
        except Exception as local_exc:
            raise RuntimeError(
                f"All execution engines failed for {language}. "
                f"Remote: {judge0_exc}. Local: {local_exc}"
            )


async def _run_test_cases(language: str, code: str, test_cases: list):
    test_cases = _prepare_test_cases(test_cases)
    if not test_cases:
        raise ValueError("No test cases are configured for this coding question.")

    # Auto-wrap LeetCode-style Solution classes for Java/C++
    execution_code = code
    if language in ("java", "cpp") and _is_solution_class(code, language):
        execution_code = _wrap_java_solution(code) if language == "java" else _wrap_cpp_solution(code)

    if not _supports_batch_harness(code, language):
        structured = []
        last_data = {"run": {"stdout": "", "stderr": ""}}
        for tc in test_cases:
            data = await _execute_code(language, execution_code, str(tc.get("input", "")))
            last_data = data
            run = data.get("run", {}) or {}
            actual = (run.get("stdout") or "").strip()
            stderr = (run.get("stderr") or "").strip()
            expected = str(tc.get("expected_output") or tc.get("expected") or "").strip()
            structured.append({
                "input": tc.get("input", ""),
                "expected": expected,
                "stdout": actual,
                "stderr": stderr,
                "passed": not stderr and _normalize_compare_value(actual) == _normalize_compare_value(expected),
            })
        return last_data, structured

    wrapped_code = wrap_code_for_execution(code, language, test_cases)
    data = await _execute_code(language, wrapped_code, "")
    stdout = data.get("run", {}).get("stdout", "") or ""
    stderr = data.get("run", {}).get("stderr", "") or ""
    parsed_results = _parse_batch_results(stdout)
    if not parsed_results and stderr.strip():
        return data, []
    structured = []
    for idx, tc in enumerate(test_cases):
        raw_result = parsed_results[idx] if idx < len(parsed_results) else {}
        actual = (raw_result.get("stdout") or "").strip()
        expected = str(tc.get("expected_output") or tc.get("expected") or "").strip()
        structured.append({
            "input": tc.get("input", ""),
            "expected": expected,
            "stdout": actual,
            "stderr": (raw_result.get("stderr") or "").strip(),
            "passed": _normalize_compare_value(actual) == _normalize_compare_value(expected),
        })
    return data, structured



@router.post("/run-code")
async def run_code_endpoint(
    body: RunCodeRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        p_lang = _normalize_language(body.language)
        if body.test_cases is not None:
            data, structured = await _run_test_cases(p_lang, body.code, body.test_cases)
            return success({
                "run": data.get("run", {}),
                "test_results": structured,
            })

        data = await _execute_code(p_lang, body.code, body.stdin)
        return success(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class GenerateMetaRequest(BaseModel):
    question_text: str


@router.post("/generate-coding-meta")
async def generate_coding_meta(
    body: GenerateMetaRequest,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"]))
):
    from app.agents.agents import call_llm
    
    system_prompt = "You are a coding question metadata generator."
    user_prompt = f"""Analyze this coding question and generate metadata for a LeetCode-style environment.
Question: {body.question_text}

Respond ONLY with a JSON object containing:
- "starter_code": A basic Python function signature with an indented placeholder body like `# Write your code here` followed by `pass`.
- "test_cases": Exactly 3 objects, each with "input" and "expected_output".
  CRITICAL: In "input", each argument for the function MUST be on its own line.
  - If an argument is a list/array, format it as a JSON array (e.g. [1, 2, 3]) on one line.
  - If an argument is a number or string, put it on its own line.
  - Every "expected_output" must be the exact return value or stdout text.
- "programming_language": Set to "python".
"""
    ai_res = call_llm(system_prompt, user_prompt)
    test_cases = _prepare_test_cases(ai_res.get("test_cases", []) if isinstance(ai_res, dict) else [])
    if isinstance(ai_res, dict):
        ai_res["test_cases"] = test_cases[:3]
        ai_res["programming_language"] = "python"
    return success(ai_res)


class RandomizeRequest(BaseModel):
    questions: list

@router.post("/randomize-assessment")
async def randomize_assessment_endpoint(
    body: RandomizeRequest,
    current_user: User = Depends(require_role(["hr", "org_admin", "instructor"]))
):
    from app.agents.agents import call_llm
    system_prompt = "You are an expert instructional designer and anti-cheating AI."
    user_prompt = f"""I need to create a cheat-proof variant of this assessment. For each question, rewrite the 'question_text' to use completely different scenarios or wording but test the exact same concept and difficulty. ALSO, randomly shuffle the 'options' and update the 'correct_answer' accordingly to match the new options list. Return ONLY a JSON array of the updated questions. Keep the exact same JSON schema.
Questions:
{json.dumps(body.questions)}
"""
    ai_res = call_llm(system_prompt, user_prompt)
    return success(ai_res.get("questions") if isinstance(ai_res, dict) and "questions" in ai_res else ai_res)


# ── Submit Assessment ─────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    assessment_id: int
    answers: dict  # {question_id: answer}
    time_taken_seconds: Optional[int] = None
    proctoring_events: Optional[list] = None
    is_malpractice: bool = False


class AssessmentQueryRequest(BaseModel):
    subject: Optional[str] = None
    message: str


class AssessmentQueryUpdateRequest(BaseModel):
    status: Optional[str] = None
    response: Optional[str] = None

async def perform_grading_task(result_id: int, answers_dict: dict, assessment_id: int, user_id: int):
    """Background task to handle AI grading and feedback generation."""
    from app.database import AsyncSessionLocal
    import json
    import logging
    import traceback
    from decimal import Decimal
    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as db:
        try:
            # Re-fetch records
            result_res = await db.execute(select(AssessmentResult).where(AssessmentResult.id == result_id))
            result_record = result_res.scalar_one_or_none()
            if not result_record: return

            assessment_res = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
            assessment = assessment_res.scalar_one_or_none()
            if not assessment: return

            questions_res = await db.execute(
                select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id)
            )
            questions = questions_res.scalars().all()
            
            scores_per_q = {}
            question_data_for_feedback = []
            total_marks = 0
            earned_marks = 0

            # --- Internal Grading Helpers ---
            async def grade_coding_question_internal(q, candidate_answer, marks):
                test_cases = q.test_cases or []
                if isinstance(test_cases, str):
                    try: test_cases = json.loads(test_cases)
                    except: test_cases = []
                if not test_cases or not candidate_answer: return 0.0
                try:
                    lang = (q.programming_language or "python").lower()
                    code = ""
                    if isinstance(candidate_answer, str):
                        try:
                            ans_dict = json.loads(candidate_answer)
                            lang = ans_dict.get("language", lang).lower()
                            code = ans_dict.get("code", "")
                        except Exception:
                            code = candidate_answer
                    elif isinstance(candidate_answer, dict):
                        lang = candidate_answer.get("language", lang).lower()
                        code = candidate_answer.get("code", "")
                    if not code.strip():
                        return 0.0
                    p_lang = _normalize_language(lang)
                    tests_to_run = test_cases[:10]
                    _data, structured = await _run_test_cases(p_lang, code, tests_to_run)
                    passed = sum(1 for item in structured if item["passed"])
                    return (passed / len(tests_to_run)) * marks if tests_to_run else 0.0
                except Exception as e:
                    logger.warning(f"Grading coding {q.id} failed: {e}")
                    return 0.0

            grading_tasks = []
            coding_indices = []
            
            for idx, q in enumerate(questions):
                q_id = str(q.id)
                candidate_answer = answers_dict.get(q_id, "")
                marks = float(q.marks)
                total_marks += marks
                qt = q.question_type.value if hasattr(q.question_type, 'value') else q.question_type

                if qt == "mcq":
                    q_score = marks if str(candidate_answer).strip().upper() == str(q.correct_answer or "").strip().upper() else 0
                    scores_per_q[q_id] = {"score": q_score, "max": marks}
                    earned_marks += q_score
                    question_data_for_feedback.append({"id": q.id, "text": q.question_text, "type": qt, "candidate_answer": candidate_answer, "correct_answer": q.correct_answer, "marks": marks, "earned": q_score, "skill_id": q.skill_id})
                elif qt == "mcq_multi":
                    try:
                        cand_list = candidate_answer if isinstance(candidate_answer, list) else json.loads(candidate_answer or "[]")
                        corr_list = q.correct_answer if isinstance(q.correct_answer, list) else json.loads(q.correct_answer or "[]")
                        cand_set = set(str(x).strip().upper() for x in cand_list)
                        corr_set = set(str(x).strip().upper() for x in corr_list)
                        q_score = marks if cand_set == corr_set and len(cand_set) > 0 else 0
                    except: q_score = 0
                    scores_per_q[q_id] = {"score": q_score, "max": marks}
                    earned_marks += q_score
                    question_data_for_feedback.append({"id": q.id, "text": q.question_text, "type": qt, "candidate_answer": candidate_answer, "correct_answer": q.correct_answer, "marks": marks, "earned": q_score, "skill_id": q.skill_id})
                elif qt == "coding":
                    coding_indices.append(len(question_data_for_feedback))
                    grading_tasks.append(grade_coding_question_internal(q, candidate_answer, marks))
                    question_data_for_feedback.append({"id": q.id, "text": q.question_text, "type": qt, "candidate_answer": candidate_answer, "correct_answer": q.correct_answer, "marks": marks, "earned": 0, "skill_id": q.skill_id})
                elif qt == "written":
                    question_data_for_feedback.append({"id": q.id, "text": q.question_text, "type": qt, "candidate_answer": candidate_answer, "correct_answer": q.correct_answer, "marks": marks, "earned": 0, "skill_id": q.skill_id})
                elif qt == "file_upload":
                    scores_per_q[q_id] = {"score": None, "status": "pending_review"}
                    question_data_for_feedback.append({"id": q.id, "text": q.question_text, "type": qt, "candidate_answer": candidate_answer, "correct_answer": q.correct_answer, "marks": marks, "earned": None, "skill_id": q.skill_id})

            if grading_tasks:
                import asyncio
                coding_scores = await asyncio.gather(*grading_tasks)
                for i, score in enumerate(coding_scores):
                    q_idx = coding_indices[i]
                    scores_per_q[str(question_data_for_feedback[q_idx]["id"])] = {"score": score, "max": question_data_for_feedback[q_idx]["marks"]}
                    earned_marks += score
                    question_data_for_feedback[q_idx]["earned"] = score

            written_indices = [i for i, q in enumerate(question_data_for_feedback) if q["type"] == "written"]
            if written_indices:
                try:
                    from app.agents.agents import call_llm
                    grading_batch = [{"id": q["id"], "question": q["text"], "model_answer": q["correct_answer"] or "General knowledge", "student_answer": q["candidate_answer"], "max_marks": q["marks"]} for i, q in enumerate(question_data_for_feedback) if i in written_indices]
                    batch_res = call_llm("You are a written assessment grading AI.", f"Grade these {len(grading_batch)} answers. Return JSON: {{'grades': [{{'id', 'score', 'explanation'}}]}}\n\nBatch:\n{json.dumps(grading_batch)}")
                    grades_map = {str(g["id"]): g for g in batch_res.get("grades", [])}
                    for idx in written_indices:
                        q_data = question_data_for_feedback[idx]
                        grade = grades_map.get(str(q_data["id"]), {"score": q_data["marks"] * 0.5})
                        q_score = min(float(grade.get("score", 0)), q_data["marks"])
                        earned_marks += q_score
                        scores_per_q[str(q_data["id"])] = {"score": q_score, "max": q_data["marks"]}
                        question_data_for_feedback[idx]["earned"] = q_score
                except Exception as e:
                    logger.warning(f"Batch grading failed: {e}")
                    for idx in written_indices:
                        q_data = question_data_for_feedback[idx]
                        earned_marks += q_data["marks"] * 0.5
                        scores_per_q[str(q_data["id"])] = {"score": q_data["marks"] * 0.5, "max": q_data["marks"]}
                        question_data_for_feedback[idx]["earned"] = q_data["marks"] * 0.5

            pct_score = (earned_marks / total_marks * 100) if total_marks > 0 else 0
            passed = pct_score >= float(assessment.pass_score)
            
            # Generate AI Feedback
            try:
                from app.agents.agents import run_generate_feedback_agent
                feedback_data = run_generate_feedback_agent(
                    questions=[{"text": q["text"], "type": q["type"]} for q in question_data_for_feedback],
                    answers={str(q["id"]): q["candidate_answer"] for q in question_data_for_feedback},
                    scores={str(q["id"]): q["earned"] for q in question_data_for_feedback},
                    total_score=round(pct_score, 2), passed=passed,
                )
                is_released = assessment.show_result_immediately
                feedback_text = json.dumps({
                    "summary": feedback_data.get("summary", ""),
                    "strengths": feedback_data.get("strengths", []),
                    "improvement_areas": feedback_data.get("improvement_areas", []),
                    "study_recommendations": feedback_data.get("study_recommendations", []),
                    "_is_released": is_released
                })
                result_record.weak_skill_ids = feedback_data.get("weak_skill_ids", [])
            except:
                feedback_text = json.dumps({"summary": f"Score: {round(pct_score, 1)}%. {'Passed' if passed else 'Did not pass'}.", "strengths": [], "improvement_areas": [], "_is_released": True})

            result_record.scores_per_question = scores_per_q
            result_record.score = Decimal(str(round(pct_score, 2)))
            result_record.pass_status = passed
            result_record.feedback = feedback_text
            
            # Update assignment
            assgn_res = await db.execute(select(AssessmentAssignment).where(AssessmentAssignment.assessment_id == assessment_id, AssessmentAssignment.user_id == user_id))
            assgn = assgn_res.scalar_one_or_none()
            if assgn:
                assgn.status = AssignmentStatus.graded

            await db.commit()
            logger.info(f"Background grading complete for result {result_id}: {pct_score}%")
        except Exception as e:
            logger.error(f"Grading task failed: {e}\n{traceback.format_exc()}")

@router.post("/submit")
async def submit_assessment(
    body: SubmitRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import logging
    logger = logging.getLogger(__name__)

    try:
        # 1. Create result record
        logger.info(f"Submitting assessment {body.assessment_id} for user {current_user.id} (Malpractice: {body.is_malpractice})")
        feedback_val = json.dumps({"summary": "Grading in progress...", "_is_released": True})
        if body.is_malpractice:
            feedback_val = json.dumps({
                "summary": "Our system has detected multiple proctoring violations. This assessment has been terminated for Malpractice.",
                "_is_released": True,
                "is_malpractice": True
            })

        result_record = AssessmentResult(
            assessment_id=body.assessment_id,
            user_id=current_user.id,
            answers=body.answers,
            time_taken_seconds=body.time_taken_seconds,
            submitted_at=datetime.utcnow(),
            score=0.0 if body.is_malpractice else None, 
            pass_status=False,
            is_malpractice=body.is_malpractice,
            feedback=feedback_val
        )
        db.add(result_record)
        await db.flush()
        logger.info(f"Result record created with ID: {result_record.id}")

        # 2. Log proctoring events
        valid_flag_types = [t.value for t in ProctoringFlagType]
        for event in (body.proctoring_events or []):
            etype = event.get("type")
            if etype not in valid_flag_types:
                etype = ProctoringFlagType.tab_switch.value
            
            flag = ProctoringFlag(
                assessment_result_id=result_record.id,
                flag_type=etype,
                details=str(event.get("details", "")),
            )
            db.add(flag)
        
        logger.info(f"Logged {len(body.proctoring_events or [])} proctoring events")

        # 3. Update assignment status
        assgn_res = await db.execute(
            select(AssessmentAssignment).where(
                AssessmentAssignment.assessment_id == body.assessment_id,
                AssessmentAssignment.user_id == current_user.id,
            )
        )
        assgn = assgn_res.scalar_one_or_none()
        if assgn:
            assgn.status = AssignmentStatus.graded if body.is_malpractice else AssignmentStatus.submitted
            logger.info(f"Assignment status updated to: {assgn.status}")
        
        await db.commit()
        await db.refresh(result_record)
        logger.info("Submission transaction committed successfully")

        # 4. Queue background grading task (only if not malpractice)
        if not body.is_malpractice:
            background_tasks.add_task(
                perform_grading_task, 
                result_record.id, 
                body.answers, 
                body.assessment_id, 
                current_user.id
            )

        return success({"result_id": result_record.id}, "Assessment submitted. Grading is in progress.")

    except Exception as e:
        logger.error(f"Submission error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred during submission.")

# ── Results ───────────────────────────────────────────────────────────────────

@router.get("/my-results")
async def my_results(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, Assessment).join(Assessment)
        .where(AssessmentResult.user_id == current_user.id)
        .order_by(AssessmentResult.submitted_at.desc())
    )
    rows = result.all()
    out = []
    for res, asmt in rows:
        fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
        is_released = fb.get("_is_released", True) if isinstance(fb, dict) else True
        out.append({
            "result_id": res.id,
            "assessment_id": asmt.id,
            "title": asmt.title,
            "score": float(res.score) if res.score is not None and is_released else None,
            "pass_status": res.pass_status if is_released else None,
            "pass_score": float(asmt.pass_score),
            "feedback": fb if is_released else {"summary": "Result is pending manual review."},
            "time_taken_seconds": res.time_taken_seconds,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "is_released": is_released,
            "is_malpractice": res.is_malpractice,
        })
    return success(out)


@router.get("/result/{result_id}")
async def get_result(
    result_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, Assessment).join(Assessment)
        .where(AssessmentResult.id == result_id, Assessment.org_id == current_user.org_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    res, asmt = row
    if res.user_id != current_user.id and current_user.role.value not in ["hr", "org_admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    flags_res = await db.execute(
        select(ProctoringFlag).where(ProctoringFlag.assessment_result_id == result_id)
    )
    flags = [{"type": f.flag_type, "details": f.details, "flagged_at": f.flagged_at.isoformat()} for f in flags_res.scalars()]
    appeal_res = await db.execute(
        select(AssessmentQuery).options(selectinload(AssessmentQuery.user))
        .where(AssessmentQuery.assessment_result_id == result_id)
        .order_by(AssessmentQuery.created_at.desc())
    )
    appeal_query = appeal_res.scalars().first()

    is_hr = current_user.role.value in ["hr", "org_admin", "manager"]
    fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
    is_released = fb.get("_is_released", True) if isinstance(fb, dict) else True

    if not is_hr and not is_released:
        return success({
            "result_id": res.id,
            "assessment": {"id": asmt.id, "title": asmt.title, "pass_score": float(asmt.pass_score)},
            "score": None,
            "pass_status": None,
            "feedback": {"summary": "Result is pending manual review."},
            "scores_per_question": {},
            "time_taken_seconds": res.time_taken_seconds,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "proctoring_flags": [],
            "weak_skill_ids": [],
            "is_released": False,
            "user_id": res.user_id,
            "appeal_query": serialize_assessment_query(appeal_query) if appeal_query else None,
        })

    return success({
        "result_id": res.id,
        "assessment": {"id": asmt.id, "title": asmt.title, "pass_score": float(asmt.pass_score)},
        "score": float(res.score) if res.score is not None else None,
        "pass_status": res.pass_status,
        "feedback": fb,
        "scores_per_question": res.scores_per_question,
        "time_taken_seconds": res.time_taken_seconds,
        "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
        "proctoring_flags": flags,
        "weak_skill_ids": res.weak_skill_ids,
        "is_released": is_released,
        "is_malpractice": res.is_malpractice,
        "user_id": res.user_id,
        "appeal_query": serialize_assessment_query(appeal_query) if appeal_query else None,
    })


@router.post("/result/{result_id}/appeal")
async def submit_result_appeal(
    result_id: int,
    body: AssessmentQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result_res = await db.execute(
        select(AssessmentResult, Assessment)
        .join(Assessment, Assessment.id == AssessmentResult.assessment_id)
        .where(AssessmentResult.id == result_id)
    )
    row = result_res.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")

    res, asmt = row
    if res.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not res.is_malpractice:
        raise HTTPException(status_code=400, detail="Appeals are only available for malpractice-flagged assessments")

    existing_res = await db.execute(
        select(AssessmentQuery).options(selectinload(AssessmentQuery.user))
        .where(
            AssessmentQuery.assessment_result_id == result_id,
            AssessmentQuery.user_id == current_user.id,
        )
    )
    appeal = existing_res.scalar_one_or_none()
    if appeal:
        appeal.subject = body.subject or appeal.subject or "Malpractice Appeal"
        appeal.message = body.message
        appeal.status = "open"
        appeal.response = None
    else:
        appeal = AssessmentQuery(
            org_id=asmt.org_id,
            assessment_id=asmt.id,
            assessment_result_id=res.id,
            user_id=current_user.id,
            subject=body.subject or "Malpractice Appeal",
            message=body.message,
            status="open",
        )
        db.add(appeal)

    await db.commit()
    await db.refresh(appeal)
    return success(serialize_assessment_query(appeal), "Your appeal has been submitted")


@router.get("/assessments/{assessment_id}/queries")
async def get_assessment_queries(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentQuery, User, Candidate)
        .join(User, User.id == AssessmentQuery.user_id)
        .outerjoin(Candidate, Candidate.user_id == User.id)
        .where(
            AssessmentQuery.assessment_id == assessment_id,
            AssessmentQuery.org_id == current_user.org_id,
        )
        .order_by(AssessmentQuery.created_at.desc())
    )
    rows = result.all()
    return success([serialize_assessment_query(query, user, candidate) for query, user, candidate in rows])


@router.patch("/queries/{query_id}")
async def update_assessment_query(
    query_id: int,
    body: AssessmentQueryUpdateRequest,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    query_res = await db.execute(
        select(AssessmentQuery).where(
            AssessmentQuery.id == query_id,
            AssessmentQuery.org_id == current_user.org_id,
        )
    )
    query = query_res.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    if body.status is not None:
        query.status = body.status
    if body.response is not None:
        query.response = body.response

    await db.commit()
    await db.refresh(query)
    return success(serialize_assessment_query(query), "Query updated")


@router.get("/leaderboard/{assessment_id}")
async def get_leaderboard(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(Assessment).where(Assessment.id == assessment_id)
    if current_user.role.value != "super_admin":
        query = query.where(Assessment.org_id == current_user.org_id)
    asmt_check = await db.execute(query)
    if not asmt_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assessment not found")

    query = select(AssessmentResult, User).join(User, User.id == AssessmentResult.user_id).where(AssessmentResult.assessment_id == assessment_id, AssessmentResult.score != None)
    if current_user.role.value != "super_admin":
        query = query.where(User.org_id == current_user.org_id)
    result = await db.execute(query.order_by(AssessmentResult.score.desc()))
    rows = result.all()
    return success([{
        "rank": i + 1,
        "name": user.full_name or user.email,
        "score": float(res.score),
        "pass_status": res.pass_status,
        "is_me": user.id == current_user.id,
    } for i, (res, user) in enumerate(rows)])


@router.get("/analytics/{assessment_id}")
async def get_analytics(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    total_assigned = await db.execute(
        select(func.count()).select_from(AssessmentAssignment).where(AssessmentAssignment.assessment_id == assessment_id)
    )
    submitted = await db.execute(
        select(func.count()).select_from(AssessmentResult).where(AssessmentResult.assessment_id == assessment_id, AssessmentResult.score != None)
    )
    passed = await db.execute(
        select(func.count()).select_from(AssessmentResult).where(AssessmentResult.assessment_id == assessment_id, AssessmentResult.pass_status == True)
    )
    avg_score = await db.execute(
        select(func.avg(AssessmentResult.score)).where(AssessmentResult.assessment_id == assessment_id)
    )

    total = total_assigned.scalar() or 0
    sub = submitted.scalar() or 0
    pas = passed.scalar() or 0
    avg = float(avg_score.scalar() or 0)

    return success({
        "total_assigned": total,
        "submitted": sub,
        "pending": total - sub,
        "passed": pas,
        "pass_rate": round((pas / sub * 100) if sub > 0 else 0, 1),
        "average_score": round(avg, 2),
    })


@router.get("/users/{user_id}/results")
async def get_user_results(
    user_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, Assessment).join(Assessment)
        .where(AssessmentResult.user_id == user_id)
        .order_by(AssessmentResult.submitted_at.desc())
    )
    rows = result.all()
    out = []
    for res, asmt in rows:
        out.append({
            "result_id": res.id,
            "title": asmt.title,
            "score": float(res.score) if res.score is not None else None,
            "pass_status": res.pass_status,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "is_malpractice": res.is_malpractice
        })
    return success(out)


@router.post("/result/{result_id}/release")
async def release_result(
    result_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AssessmentResult).where(AssessmentResult.id == result_id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
        
    fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
    if isinstance(fb, dict):
        fb["_is_released"] = True
        res.feedback = json.dumps(fb)
    await db.commit()
    
    # Check if we should send an email notification
    try:
        from app.utils.email import send_result_email
        ur = await db.execute(select(User).where(User.id == res.user_id))
        user_record = ur.scalar_one_or_none()
        ar = await db.execute(select(Assessment).where(Assessment.id == res.assessment_id))
        asmt_record = ar.scalar_one_or_none()
        if user_record and asmt_record and res.score is not None:
            import asyncio
            asyncio.create_task(send_result_email(
                to_email=user_record.email,
                assessment_title=asmt_record.title,
                score=float(res.score),
                pass_status=bool(res.pass_status),
                pass_score=float(asmt_record.pass_score),
                result_id=res.id,
            ))
    except Exception as e:
        import logging
        logging.error(f"Failed to email on manual release: {e}")

    return success(message="Result released to candidate")


@router.get("/assessments/{assessment_id}/submissions")
async def get_assessment_submissions(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "org_admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, User).join(User, User.id == AssessmentResult.user_id)
        .where(AssessmentResult.assessment_id == assessment_id)
        .order_by(AssessmentResult.submitted_at.desc())
    )
    rows = result.all()
    out = []
    for res, user in rows:
        fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
        is_released = fb.get("_is_released", True) if isinstance(fb, dict) else True
        out.append({
            "result_id": res.id,
            "candidate_name": user.full_name or user.email,
            "candidate_id": user.id,
            "score": float(res.score) if res.score is not None else None,
            "pass_status": res.pass_status,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "is_released": is_released,
            "is_malpractice": res.is_malpractice,
        })
    return success(out)
