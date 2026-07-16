"""
Verify Module — Submissions API
=================================
Handles assessment submissions, background grading, results, analytics, leaderboard.
Prefix: /api/verify/submissions
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.modules.verify.services.submission_service import SubmissionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/submissions", tags=["Verify - Submissions"])

def get_submission_service(current_user: dict = Depends(get_current_user)) -> SubmissionService:
    return SubmissionService(tenant_id=current_user.get("tenant_id", "public"))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SubmitRequest(BaseModel):
    assessment_id: int
    answers: Dict[str, Any]                         # {question_id: answer}
    time_taken_seconds: Optional[int] = None
    proctoring_events: List[Dict[str, Any]] = []
    is_malpractice: bool = False

# ---------------------------------------------------------------------------
# 1. POST /submit — submit assessment
# ---------------------------------------------------------------------------

@router.post("/submit")
async def submit_assessment(
    body: SubmitRequest,
    current_user: dict = Depends(get_current_user),
    service: SubmissionService = Depends(get_submission_service),
):
    """Submit a completed assessment. Returns result_id immediately; grading runs in background."""
    data = body.dict()
    data["user_id"] = current_user["id"]
    try:
        result_id = service.submit_assessment(data)
        return {"success": True, "data": {"result_id": result_id}, "message": "Submission received"}
    except Exception as e:
        logger.error(f"submit_assessment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 2. GET /my-results — list all results for current user
# ---------------------------------------------------------------------------

@router.get("/my-results")
def list_my_results(
    current_user: dict = Depends(get_current_user),
    service: SubmissionService = Depends(get_submission_service),
):
    """List all assessment results for the logged-in user."""
    rows = service.get_my_results(current_user["id"])
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 2b. GET /user/{user_id}/results — list results for a specific user (HR)
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}/results")
def list_user_results(
    user_id: int,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: SubmissionService = Depends(get_submission_service),
):
    """List all assessment results for a specific user."""
    rows = service.get_my_results(user_id)
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 3. GET /results/{result_id} — full result details
# ---------------------------------------------------------------------------

@router.get("/results/{result_id}")
def get_result_details(
    result_id: int,
    current_user: dict = Depends(get_current_user),
    service: SubmissionService = Depends(get_submission_service),
):
    result = service.get_result_by_id(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
        
    user_id = current_user["id"]
    user_permissions = current_user.get("permissions", [])
    is_owner = result["user_id"] == user_id
    has_manage = "verify.assessments.manage" in user_permissions

    if not is_owner and not has_manage:
        raise HTTPException(status_code=403, detail="Access denied")

    if is_owner and not has_manage:
        import json
        feedback_str = result.get("feedback") or "{}"
        try:
            feedback_json = json.loads(feedback_str) if isinstance(feedback_str, str) else feedback_str
        except:
            feedback_json = {}
        is_released = feedback_json.get("_is_released", False)
        
        if not result.get("show_result_immediately") and not is_released:
            result["score"] = None
            result["pass_status"] = None
            result["feedback"] = None
            result["scores_per_question"] = None

    return {"success": True, "data": result}

# ---------------------------------------------------------------------------
# 4. GET /assessments/{asm_id}/results — HR: list all submissions
# ---------------------------------------------------------------------------

@router.get("/assessments/{asm_id}/results")
def list_assessment_results(
    asm_id: int,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: SubmissionService = Depends(get_submission_service),
):
    rows = service.get_results_by_assessment(asm_id)
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 5. POST /results/{result_id}/release — release result to candidate
# ---------------------------------------------------------------------------

@router.post("/results/{result_id}/release")
def release_result(
    result_id: int,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: SubmissionService = Depends(get_submission_service),
):
    """Release a result to the candidate (sets _is_released flag in feedback JSON)."""
    success = service.release_result(result_id)
    if not success:
        raise HTTPException(status_code=404, detail="Result not found or release failed")
    return {"success": True, "message": "Result released"}

# ---------------------------------------------------------------------------
# 6. GET /assessments/{asm_id}/leaderboard
# ---------------------------------------------------------------------------

@router.get("/assessments/{asm_id}/leaderboard")
def get_leaderboard(
    asm_id: int,
    current_user: dict = Depends(get_current_user),
    service: SubmissionService = Depends(get_submission_service),
):
    """Get top 50 scores for a specific assessment."""
    rows = service.get_leaderboard(asm_id)
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 7. GET /assessments/{asm_id}/analytics
# ---------------------------------------------------------------------------

@router.get("/assessments/{asm_id}/analytics")
def get_assessment_analytics(
    asm_id: int,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: SubmissionService = Depends(get_submission_service),
):
    """Basic analytics: average score, pass rate, total completions."""
    data = service.get_assessment_analytics(asm_id)
    return {"success": True, "data": data}