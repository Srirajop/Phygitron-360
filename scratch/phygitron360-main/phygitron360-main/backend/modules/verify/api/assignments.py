"""
Verify Module — Assignment API
================================
Handles assigning assessments to users and listing candidates.
Prefix: /api/verify/assignments
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.modules.verify.services.assignment_service import AssignmentService
from backend.modules.verify.api.live_monitoring import notify_live_monitor

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AssignRequest(BaseModel):
    user_ids: List[int]
    deadline: Optional[str] = None          # ISO date string
    generate_variants: bool = False
    question_ids: Optional[List[int]] = None # Optional subset of questions to assign
    shuffle_questions: bool = False         # Whether to shuffle per user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/assignments", tags=["Verify - Assignments"])

def get_assignment_service(current_user: dict = Depends(get_current_user)) -> AssignmentService:
    return AssignmentService(tenant_id=current_user.get("tenant_id", "public"))

# ---------------------------------------------------------------------------
# 1. GET /my-tests — list assessments assigned to current user
# ---------------------------------------------------------------------------

@router.get("/my-tests")
def list_my_tests(
    current_user: dict = Depends(get_current_user),
    service: AssignmentService = Depends(get_assignment_service),
):
    """List all assessments assigned to the logged-in user."""
    rows = service.get_user_assignments(current_user["id"])
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 2. POST /{asm_id}/assign — bulk assign users to an assessment
# ---------------------------------------------------------------------------

@router.post("/{asm_id}/assign")
async def assign_assessment(
    asm_id: int,
    body: AssignRequest,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: AssignmentService = Depends(get_assignment_service),
):
    """Bulk-assign users to an assessment. Optionally generates AI variants."""
    try:
        assigned_count = await service.assign_assessment(
            asm_id=asm_id,
            user_ids=body.user_ids,
            assigned_by=current_user["id"],
            deadline=body.deadline,
            generate_variants=body.generate_variants,
            question_ids=body.question_ids,
            shuffle_questions=body.shuffle_questions,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"assign_assessment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": True,
        "data": {"assigned": assigned_count, "total_requested": len(body.user_ids)},
        "message": f"Assessment assigned to {len(body.user_ids)} user(s)",
    }

# ---------------------------------------------------------------------------
# 3. GET /{asm_id}/candidates — list assigned candidates with status
# ---------------------------------------------------------------------------

@router.get("/{asm_id}/candidates")
def list_candidates(
    asm_id: int,
    current_user: dict = Depends(require_permission("verify.assessments.manage")),
    service: AssignmentService = Depends(get_assignment_service),
):
    """List all users assigned to an assessment along with their status."""
    rows = service.get_assignment_candidates(asm_id)
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 4. POST /{asm_id}/start-session — mark assessment as started
# ---------------------------------------------------------------------------

@router.post("/{asm_id}/start-session")
def start_assessment_session(
    asm_id: int,
    current_user: dict = Depends(get_current_user),
    service: AssignmentService = Depends(get_assignment_service),
):
    """Mark the assessment status as 'in_progress' and record start time."""
    success = service.start_session(asm_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start session. It may be already started or not assigned.")
    
    # Broadcast to HR
    asyncio.create_task(notify_live_monitor(asm_id, "session_started", current_user["id"]))
    
    return {"success": True, "message": "Session started"}

# ---------------------------------------------------------------------------
# 5. POST /{asm_id}/record-strike — increment strike count
# ---------------------------------------------------------------------------

@router.post("/{asm_id}/record-strike")
def record_proctoring_strike(
    asm_id: int,
    current_user: dict = Depends(get_current_user),
    service: AssignmentService = Depends(get_assignment_service),
):
    """Increment strike count. Will terminate if limit reached."""
    result = service.record_strike(asm_id, current_user["id"])
    
    # Broadcast to HR
    asyncio.create_task(notify_live_monitor(asm_id, "strike_recorded", current_user["id"], result))
    
    return {"success": True, "data": result, "message": "Strike recorded"}