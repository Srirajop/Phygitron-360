import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    candidate = "candidate"
    employee = "employee"
    hr = "hr"
    instructor = "instructor"
    manager = "manager"
    org_admin = "org_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    first_login = Column(Boolean, default=True)
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organisation = relationship("Organisation", back_populates="users", foreign_keys=[org_id])
    candidate = relationship("Candidate", back_populates="user", uselist=False)
    employee = relationship("Employee", back_populates="user", uselist=False)
