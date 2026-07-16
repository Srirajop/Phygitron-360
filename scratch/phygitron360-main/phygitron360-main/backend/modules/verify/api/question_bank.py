"""
Verify Module — Question Bank API
=================================
Handles CRUD for reusable questions and AI extraction.
Prefix: /api/verify/question-bank
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.modules.verify.services.question_bank_service import QuestionBankService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/question-bank", tags=["Verify - Question Bank"])

def get_qb_service(current_user: dict = Depends(get_current_user)) -> QuestionBankService:
    return QuestionBankService(tenant_id=current_user.get("tenant_id", "public"))

class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "mcq"
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: Optional[List[Dict[str, Any]]] = None
    programming_language: Optional[str] = None
    accepted_file_types: Optional[str] = None
    marks: float = 1.0
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None

@router.post("")
def create_question(
    body: QuestionCreate,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: QuestionBankService = Depends(get_qb_service)
):
    try:
        data = body.dict()
        data["created_by"] = current_user["id"]
        q_id = service.create_question(data)
        return {"success": True, "data": {"id": q_id}, "message": "Question added to bank"}
    except Exception as e:
        logger.error(f"Error creating question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
def list_questions(
    tags: Optional[str] = None,
    q_type: Optional[str] = None,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: QuestionBankService = Depends(get_qb_service)
):
    tag_list = tags.split(",") if tags else None
    rows = service.list_questions(tags=tag_list, q_type=q_type)
    return {"success": True, "data": rows}

@router.delete("/{q_id}")
def delete_question(
    q_id: int,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: QuestionBankService = Depends(get_qb_service)
):
    success = service.delete_question(q_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"success": True, "message": "Question deleted"}

@router.post("/import-file")
async def import_questions_from_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: QuestionBankService = Depends(get_qb_service)
):
    """Extract text from file and use AI to parse questions into the bank."""
    content = await file.read()
    text = ""
    # Simple extraction for demo. In production, use PyMuPDF or docx logic here.
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        for page in doc:
            text += page.get_text()
            
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")
        
    try:
        count = await service.import_from_text(text, current_user["id"])
        return {"success": True, "message": f"Imported {count} questions successfully"}
    except Exception as e:
        logger.error(f"Import failed: {e}")
        raise HTTPException(status_code=500, detail="AI Extraction failed")
