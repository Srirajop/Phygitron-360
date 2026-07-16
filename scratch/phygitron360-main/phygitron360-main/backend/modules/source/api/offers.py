"""
Phygitron 360 — Source Module: Offer Letters API
=================================================
Manages the offer letter approval workflow:
  HR creates → Manager approves/requests changes → HR sends → candidate becomes employee
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from backend.core.dependencies import get_current_user
from backend.modules.source.services.offer_service import OfferService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/source/offers", tags=["Source - Offers"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OfferFeedback(BaseModel):
    feedback: Optional[str] = ''


class OfferUpdate(BaseModel):
    role_title: Optional[str] = None
    salary: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    offer_content: Optional[dict] = None


def get_offer_service(user=Depends(get_current_user)):
    return OfferService(tenant_id=user.get('tenant_id', 'public'))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_offers(
    status: Optional[str] = None,
    service: OfferService = Depends(get_offer_service),
):
    """List all offer letters for the tenant. Optionally filter by status."""
    offers = service.get_all_offers(status)
    return {"success": True, "data": offers}


@router.get("/{offer_id}")
async def get_offer(
    offer_id: int,
    service: OfferService = Depends(get_offer_service),
):
    offer = service.get_offer_by_id(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"success": True, "data": offer}


@router.put("/{offer_id}")
async def update_offer(
    offer_id: int,
    body: OfferUpdate,
    service: OfferService = Depends(get_offer_service),
):
    """HR edits an offer letter (only allowed if pending or changes_requested)."""
    updates = {}
    for field in ("role_title", "salary", "department", "location", "start_date", "offer_content"):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    try:
        service.update_offer(offer_id, updates)
        return {"success": True, "message": "Offer updated and re-submitted for approval"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{offer_id}/approve")
async def approve_offer(
    offer_id: int,
    current_user: dict = Depends(get_current_user),
    service: OfferService = Depends(get_offer_service)
):
    """Manager/admin approves the offer letter."""
    try:
        service.approve_offer(offer_id, current_user["id"])
        return {"success": True, "message": "Offer approved"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{offer_id}/request-changes")
async def request_changes(
    offer_id: int,
    body: OfferFeedback,
    service: OfferService = Depends(get_offer_service),
):
    """Manager requests changes with feedback text."""
    try:
        service.request_changes(offer_id, body.feedback)
        return {"success": True, "message": "Changes requested"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{offer_id}/reject")
async def reject_offer(
    offer_id: int,
    body: OfferFeedback,
    service: OfferService = Depends(get_offer_service),
):
    """Manager rejects the offer outright."""
    try:
        service.reject_offer(offer_id, body.feedback)
        return {"success": True, "message": "Offer rejected"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{offer_id}/send")
async def send_offer(
    offer_id: int,
    service: OfferService = Depends(get_offer_service),
):
    """
    HR sends the approved offer to the candidate.
    This creates an employee record and marks the candidate as Archived.
    """
    try:
        result = service.send_offer(offer_id)
        return {
            "success": True,
            "message": "Offer sent successfully. Onboarding will be initiated separately.",
            "data": result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.error(f"send_offer({offer_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{offer_id}/preview")
async def preview_offer(
    offer_id: int,
    service: OfferService = Depends(get_offer_service),
):
    """Generate a PDF preview of the offer letter."""
    offer = service.get_offer_by_id(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    try:
        from backend.common.utils.pdf_utils import generate_ewandz_offer_pdf
        pdf_bytes = generate_ewandz_offer_pdf(offer)
        return StreamingResponse(
            io.BytesIO(pdf_bytes), 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"inline; filename=offer_{offer_id}.pdf"}
        )
    except Exception as exc:
        logger.error(f"preview_offer({offer_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")

