import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.lead import Lead, LeadStatus, LeadInquiryType
from app.models.user import User
from app.utils.auth import require_role
from app.utils.email import send_email, render_template

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/leads", tags=["Leads"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: Optional[str] = None
    inquiry_type: str = "general"
    message: Optional[str] = None

class LeadUpdate(BaseModel):
    status: str

# ── Public Endpoints ──────────────────────────────────────────────────────────

@router.post("")
async def submit_lead(body: LeadCreate, db: AsyncSession = Depends(get_db)):
    try:
        new_lead = Lead(
            company_name=body.company_name,
            contact_name=body.contact_name,
            email=body.email,
            phone=body.phone,
            inquiry_type=LeadInquiryType(body.inquiry_type),
            message=body.message
        )
        db.add(new_lead)
        await db.commit()
        await db.refresh(new_lead)

        # Notify Admin via Email
        try:
            admin_email = "srirajpillai2104@gmail.com"
            subject = f"🚀 New SaaS Inquiry from {body.company_name}"
            content = f"""
            <h2>New Business Lead Captured!</h2>
            <p><strong>Company:</strong> {body.company_name}</p>
            <p><strong>Contact:</strong> {body.contact_name}</p>
            <p><strong>Email:</strong> {body.email}</p>
            <p><strong>Type:</strong> {body.inquiry_type}</p>
            <p><strong>Message:</strong> {body.message or 'N/A'}</p>
            <br/>
            <p>Please log in to the Platform Dashboard to review and onboard this tenant.</p>
            """
            await send_email(admin_email, subject, content)
        except Exception as e:
            logger.warning(f"Failed to send lead notification email: {e}")

        return {"success": True, "message": "Inquiry submitted successfully. Our team will reach out soon."}
    except Exception as e:
        logger.error(f"Lead submission failed: {e}")
        raise HTTPException(status_code=500, detail="Submission failed")

# ── Admin Endpoints ──────────────────────────────────────────────────────────

@router.get("/platform", response_model=None)
async def list_leads(
    current_user: User = Depends(require_role(["super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Lead).order_by(Lead.created_at.desc()))
    leads = result.scalars().all()
    return {"success": True, "data": leads}

@router.patch("/platform/{lead_id}")
async def update_lead_status(
    lead_id: int,
    body: LeadUpdate,
    current_user: User = Depends(require_role(["super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead.status = LeadStatus(body.status)
    await db.commit()
    return {"success": True, "message": f"Lead status updated to {body.status}"}
