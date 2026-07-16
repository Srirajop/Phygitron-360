"""
Phygitron 360 — Verify Module: Assessment Queries API
======================================================
Candidates raise disputes/appeals; HR manages resolution.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.modules.verify.services.query_service import QueryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/queries", tags=["Verify - Queries"])

def get_query_service(current_user: dict = Depends(get_current_user)) -> QueryService:
    return QueryService(tenant_id=current_user.get("tenant_id", "public"))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QueryCreate(BaseModel):
    assessment_result_id: int
    subject: Optional[str] = None
    message: str

class QueryUpdate(BaseModel):
    status: Optional[str] = None     # open, resolved, closed
    response: Optional[str] = None

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_queries(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission("verify.assessments.manage")),
    service: QueryService = Depends(get_query_service),
):
    """HR view: list all candidate queries for the tenant."""
    try:
        rows = service.get_queries(status)
        return {"success": True, "data": rows}
    except Exception as exc:
        logger.error(f"list_queries failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("")
async def create_query(
    body: QueryCreate,
    current_user: dict = Depends(get_current_user),
    service: QueryService = Depends(get_query_service),
):
    """Candidate raises a query/appeal for one of their results."""
    data = body.dict()
    data["user_id"] = current_user["id"]
    try:
        new_id = service.create_query(data)
        return {"success": True, "message": "Query submitted", "data": {"id": new_id}}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/{query_id}")
async def respond_to_query(
    query_id: int,
    body: QueryUpdate,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission("verify.assessments.manage")),
    service: QueryService = Depends(get_query_service),
):
    """HR responds to or closes a candidate query."""
    try:
        success = service.respond_to_query(query_id, body.status, body.response)
        if not success:
            raise HTTPException(status_code=404, detail="Query not found")
        return {"success": True, "message": "Query updated"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/my")
async def my_queries(
    current_user: dict = Depends(get_current_user),
    service: QueryService = Depends(get_query_service),
):
    """Candidate: list their own submitted queries."""
    try:
        rows = service.get_my_queries(current_user["id"])
        return {"success": True, "data": rows}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
