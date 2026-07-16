"""
Verify Module — Assessment Builder API
========================================
Handles creation, editing, and management of assessment templates.
Prefix: /api/verify/builder
"""

import json
import logging
import os
import uuid
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Body
from pydantic import BaseModel

from backend.core.database import DATA_DIR
from backend.core.dependencies import get_current_user, require_permission
from backend.common.services.ai.agents import AIAgents
from backend.modules.verify.services.assessment_service import AssessmentService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/builder", tags=["Verify - Builder"])

# ---------------------------------------------------------------------------
# Optional S3 support
# ---------------------------------------------------------------------------
try:
    from backend.common.utils.s3_utils import upload_to_s3
    _HAS_S3 = True
except ImportError:
    _HAS_S3 = False

# ---------------------------------------------------------------------------
# LeetCode import helpers
# ---------------------------------------------------------------------------
LEETCODE_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/",
}

async def _fetch_leetcode(title_slug: str) -> dict:
    import httpx
    import re
    query = """query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
            title content topicTags { name }
            codeSnippets { langSlug code }
            exampleTestcases sampleTestCase
        }
    }"""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.post(
            "https://leetcode.com/graphql",
            json={"operationName": "questionData", "variables": {"titleSlug": title_slug}, "query": query},
            headers=LEETCODE_HEADERS,
        )
        if resp.status_code != 200:
            return {}
        return resp.json().get("data", {}).get("question", {}) or {}

def get_assessment_service(current_user: dict = Depends(get_current_user)) -> AssessmentService:
    return AssessmentService(tenant_id=current_user.get("tenant_id", "public"))
# Pydantic models
# ---------------------------------------------------------------------------

class QuestionIn(BaseModel):
    question_text: str
    question_type: str  # mcq | mcq_multi | coding | written | file_upload
    options: List[Any] = []
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: List[Dict[str, Any]] = []
    programming_language: Optional[str] = None
    accepted_file_types: Optional[str] = None
    skill_id: Optional[int] = None
    marks: float = 1.0
    order_index: int = 0
    images: List[str] = []


class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "mcq"  # mcq | coding | written | mixed
    time_limit_minutes: Optional[int] = None
    pass_score: float = 70.0
    shuffle_questions: bool = False
    show_result_immediately: bool = True
    questions: List[QuestionIn] = []


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    pass_score: Optional[float] = None
    shuffle_questions: Optional[bool] = None
    show_result_immediately: Optional[bool] = None


class StatusUpdate(BaseModel):
    status: str  # draft | active | inactive | closed


class ImportURLBody(BaseModel):
    url: str


class AIGenerateCodeBody(BaseModel):
    question_text: str
    difficulty: str = "medium"  # easy | medium | hard


class RandomizeBody(BaseModel):
    questions: List[Dict[str, Any]]

# ---------------------------------------------------------------------------
# 1. POST /assessments — create assessment + questions
# ---------------------------------------------------------------------------

@router.post("/assessments")
async def create_assessment(
    body: AssessmentCreate,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: AssessmentService = Depends(get_assessment_service)
):
    """Create a new assessment template with questions."""
    for q in body.questions:
        if q.question_type == "coding":
            valid_tc = [tc for tc in q.test_cases if tc.get("expected_output") is not None]
            if len(valid_tc) < 3:
                raise HTTPException(
                    status_code=422,
                    detail=f"Coding question '{q.question_text[:60]}' requires at least 3 test cases with expected_output.",
                )

    data = body.dict()
    data["created_by"] = current_user["id"]
    data["org_id"] = current_user.get("tenant_id")
    
    try:
        asm_id = service.create_assessment(data)
        return {"success": True, "data": {"id": asm_id}, "message": "Assessment created successfully"}
    except Exception as e:
        logger.error(f"create_assessment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 2. GET /assessments — list assessments (with question count)
# ---------------------------------------------------------------------------

@router.get("/assessments")
def list_assessments(
    service: AssessmentService = Depends(get_assessment_service),
):
    """List all active assessments for this tenant with question counts."""
    rows = service.get_all_assessments()
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 3. GET /assessments/{asm_id} — full assessment with questions
# ---------------------------------------------------------------------------

@router.get("/assessments/{asm_id}")
def get_assessment(
    asm_id: int,
    service: AssessmentService = Depends(get_assessment_service),
):
    asm = service.get_assessment(asm_id)
    if not asm:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"success": True, "data": asm}

# ---------------------------------------------------------------------------
# 4. PUT /assessments/{asm_id} — update metadata only
# ---------------------------------------------------------------------------

@router.put("/assessments/{asm_id}")
def update_assessment(
    asm_id: int,
    body: AssessmentUpdate,
    service: AssessmentService = Depends(get_assessment_service),
):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    try:
        success = service.update_assessment(asm_id, updates)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": "Assessment updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 5. DELETE /assessments/{asm_id} — soft delete
# ---------------------------------------------------------------------------

@router.delete("/assessments/{asm_id}")
def delete_assessment(
    asm_id: int,
    service: AssessmentService = Depends(get_assessment_service),
):
    try:
        success = service.delete_assessment(asm_id)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": "Assessment deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 6. PATCH /assessments/{asm_id}/status — update status
# ---------------------------------------------------------------------------

@router.patch("/assessments/{asm_id}/status")
def update_status(
    asm_id: int,
    body: StatusUpdate,
    service: AssessmentService = Depends(get_assessment_service),
):
    allowed = {"draft", "active", "inactive", "closed"}
    if body.status not in allowed:
        raise HTTPException(status_code=422, detail=f"Status must be one of {allowed}")

    try:
        success = service.update_status(asm_id, body.status)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": f"Status set to {body.status}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 7. POST /assessments/{asm_id}/publish — set status=active
# ---------------------------------------------------------------------------

@router.post("/assessments/{asm_id}/publish")
def publish_assessment(
    asm_id: int,
    service: AssessmentService = Depends(get_assessment_service),
):
    try:
        success = service.publish_assessment(asm_id)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": "Assessment published"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 8. POST /import-questions — upload PDF/DOCX/TXT, AI-parse questions
# ---------------------------------------------------------------------------

@router.post("/import-questions")
async def import_questions(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
):
    """Upload a file (PDF/DOCX/TXT) and AI-parse into structured questions."""
    content_type = file.content_type or ""
    filename = file.filename or ""
    raw_bytes = await file.read()

    text = ""
    try:
        if filename.lower().endswith(".pdf") or "pdf" in content_type:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=raw_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
        else:
            # DOCX or plain text — try utf-8, fall back to latin-1
            try:
                text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = raw_bytes.decode("latin-1")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {e}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in the uploaded file.")

    # AI parse
    ai = AIAgents()
    system_prompt = """You are a question-extraction AI. Parse the text and return a list of structured questions.
Respond ONLY with valid JSON: {"questions": [{"question_text": "", "question_type": "mcq|written|coding", "options": [], "correct_answer": "", "marks": 1}]}"""
    prompt = f"Extract all questions from the following text:\n\n{text[:12000]}"
    result = await ai.ai.generate_json(prompt, system_prompt)
    questions = result.get("questions", [])

    return {"success": True, "data": questions, "message": f"{len(questions)} question(s) parsed"}

# ---------------------------------------------------------------------------
# 9. POST /import-url — import from URL (LeetCode or generic)
# ---------------------------------------------------------------------------

@router.post("/import-url")
async def import_from_url(
    body: ImportURLBody,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
):
    """Import question(s) from a URL. Supports LeetCode and general web pages."""
    import re
    import httpx

    url = body.url.strip()
    questions: List[Dict[str, Any]] = []

    # --- LeetCode ---
    lc_match = re.search(r"leetcode\.com/problems/([^/]+)", url)
    if lc_match:
        title_slug = lc_match.group(1)
        qdata = await _fetch_leetcode(title_slug)
        if not qdata:
            raise HTTPException(status_code=502, detail="Could not fetch problem from LeetCode")

        # Strip HTML from content
        content_html = qdata.get("content", "") or ""
        try:
            from bs4 import BeautifulSoup
            content_text = BeautifulSoup(content_html, "html.parser").get_text(separator="\n")
        except Exception:
            content_text = re.sub(r"<[^>]+>", "", content_html)

        # Grab Python starter code
        starter_code = ""
        for snippet in qdata.get("codeSnippets", []):
            if snippet.get("langSlug") == "python3":
                starter_code = snippet.get("code", "")
                break
        if not starter_code:
            snippets = qdata.get("codeSnippets", [])
            if snippets:
                starter_code = snippets[0].get("code", "")

        # Build test cases from exampleTestcases
        raw_tc = (qdata.get("exampleTestcases") or "").strip()
        test_cases = []
        for line in raw_tc.split("\n"):
            if line.strip():
                test_cases.append({"input": line.strip(), "expected_output": ""})
        # Ensure at least 3 (pad with empty)
        while len(test_cases) < 3:
            test_cases.append({"input": "", "expected_output": ""})

        questions.append({
            "question_text": f"{qdata.get('title', title_slug)}\n\n{content_text[:3000]}",
            "question_type": "coding",
            "options": [],
            "correct_answer": None,
            "starter_code": starter_code,
            "test_cases": test_cases,
            "programming_language": "python",
            "marks": 10,
        })
    else:
        # Generic URL: scrape + AI-parse
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not fetch URL: {e}")

        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            page_text = soup.get_text(separator="\n")
        except Exception:
            page_text = re.sub(r"<[^>]+>", "", html)

        ai = AIAgents()
        system_prompt = """You are a question-extraction AI. Parse text scraped from a web page and extract assessment questions.
Respond ONLY with valid JSON: {"questions": [{"question_text": "", "question_type": "mcq|written|coding", "options": [], "correct_answer": "", "marks": 1}]}"""
        prompt = f"Extract questions from this webpage content:\n\n{page_text[:10000]}"
        result = await ai.ai.generate_json(prompt, system_prompt)
        questions = result.get("questions", [])

    return {"success": True, "data": questions, "message": f"{len(questions)} question(s) imported"}

# ---------------------------------------------------------------------------
# 10. POST /questions/upload-image — upload question image
# ---------------------------------------------------------------------------

@router.post("/questions/upload-image")
async def upload_question_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
):
    """Upload an image for a question. Tries S3 first, falls back to local."""
    raw = await file.read()
    ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"

    if _HAS_S3:
        try:
            image_url = upload_to_s3(raw, f"uploads/questions/{filename}", content_type=file.content_type)
            return {"success": True, "data": {"image_url": image_url}}
        except Exception as e:
            logger.warning(f"S3 upload failed, falling back to local: {e}")

    # Local fallback
    save_dir = os.path.join(DATA_DIR, "uploads", "questions")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)
    with open(save_path, "wb") as f:
        f.write(raw)

    image_url = f"/uploads/questions/{filename}"
    return {"success": True, "data": {"image_url": image_url}}

# ---------------------------------------------------------------------------
# 11. POST /ai-generate-code — AI-generate coding question metadata
# ---------------------------------------------------------------------------

@router.post("/ai-generate-code")
async def ai_generate_code(
    body: AIGenerateCodeBody,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
):
    """Use AI to generate starter code, test cases, and language for a coding question."""
    ai = AIAgents()
    system_prompt = """You are an expert technical interviewer. Generate coding question metadata.
Respond ONLY with valid JSON matching this exact structure:
{
  "starter_code": "def solution():\\n    pass",
  "test_cases": [
    {"input": "...", "expected_output": "..."},
    {"input": "...", "expected_output": "..."},
    {"input": "...", "expected_output": "..."}
  ],
  "programming_language": "python"
}"""
    prompt = f"Generate {body.difficulty} coding question metadata for: {body.question_text}"
    result = await ai.ai.generate_json(prompt, system_prompt)

    # Ensure at least 3 test cases
    tcs = result.get("test_cases", [])
    while len(tcs) < 3:
        tcs.append({"input": "", "expected_output": ""})
    result["test_cases"] = tcs

    return {"success": True, "data": result}

# ---------------------------------------------------------------------------
# 12. POST /randomize-assessment — AI-randomize questions to prevent cheating
# ---------------------------------------------------------------------------

@router.post("/randomize-assessment")
async def randomize_assessment(
    body: RandomizeBody,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
):
    """Use AI to reword questions and shuffle MCQ options to prevent cheating."""
    if not body.questions:
        return {"success": True, "data": [], "message": "No questions to randomize"}

    ai = AIAgents()
    system_prompt = """You are an assessment anti-cheating AI. Rewrite each question with different wording (same concept and difficulty).
For MCQ questions, also shuffle the options (keep correct_answer pointing to the correct content, not index).
Respond ONLY with valid JSON: {"questions": [ ...same structure but reworded... ]}"""
    prompt = f"Randomize these assessment questions:\n\n{json.dumps(body.questions, default=str)}"
    result = await ai.ai.generate_json(prompt, system_prompt)

    randomized = result.get("questions", body.questions)
    return {"success": True, "data": randomized, "message": f"{len(randomized)} question(s) randomized"}
