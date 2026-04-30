from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Text, func
from app.database import Base

class LeadStatus(enum.Enum):
    pending = "pending"
    contacted = "contacted"
    converted = "converted"
    rejected = "rejected"

class LeadInquiryType(enum.Enum):
    demo = "demo"
    pricing = "pricing"
    saas_onboarding = "saas_onboarding"
    general = "general"

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    inquiry_type = Column(Enum(LeadInquiryType), default=LeadInquiryType.general)
    message = Column(Text, nullable=True)
    status = Column(Enum(LeadStatus), default=LeadStatus.pending)
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
