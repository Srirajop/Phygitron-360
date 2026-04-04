import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class JourneyStepType(str, enum.Enum):
    verify = "verify"  # Assessment
    forge = "forge"    # Course


class JourneyAssignmentStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"


class Journey(Base):
    __tablename__ = "journeys"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organisation = relationship("Organisation")
    creator = relationship("User", foreign_keys=[created_by])
    steps = relationship("JourneyStep", back_populates="journey", cascade="all, delete-orphan", order_by="JourneyStep.order_index")
    assignments = relationship("JourneyAssignment", back_populates="journey")


class JourneyStep(Base):
    __tablename__ = "journey_steps"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("journeys.id"), nullable=False)
    type = Column(Enum(JourneyStepType), nullable=False)
    reference_id = Column(Integer, nullable=False)  # assessment_id or course_id
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    journey = relationship("Journey", back_populates="steps")


class JourneyAssignment(Base):
    __tablename__ = "journey_assignments"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("journeys.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(JourneyAssignmentStatus), default=JourneyAssignmentStatus.pending)
    deadline = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    journey = relationship("Journey", back_populates="assignments")
    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])
