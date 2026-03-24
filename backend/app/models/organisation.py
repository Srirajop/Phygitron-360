from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    logo_url = Column(String(512), nullable=True)
    primary_color = Column(String(20), default="#7C3AED")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    users = relationship("User", back_populates="organisation", foreign_keys="User.org_id")
    candidates = relationship("Candidate", back_populates="organisation")
    job_roles = relationship("JobRole", back_populates="organisation")
    employees = relationship("Employee", back_populates="organisation")
