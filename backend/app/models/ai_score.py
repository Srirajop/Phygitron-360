import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text, DECIMAL, func
from sqlalchemy.orm import relationship
from app.database import Base


class EntityType(str, enum.Enum):
    candidate = "candidate"
    employee = "employee"


class ScoreType(str, enum.Enum):
    role_fit = "role_fit"
    capability_index = "capability_index"
    gap_analysis = "gap_analysis"
    deployability = "deployability"
    confidence_signals = "confidence_signals"


class AIScore(Base):
    __tablename__ = "ai_scores"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(Enum(EntityType), nullable=False)
    entity_id = Column(Integer, nullable=False, index=True)
    job_role_id = Column(Integer, ForeignKey("job_roles.id"), nullable=True)
    score_type = Column(Enum(ScoreType), nullable=False)
    score = Column(DECIMAL(6, 2), nullable=True)
    reasoning = Column(Text, nullable=True)  # Full JSON stored as text
    computed_at = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    job_role = relationship("JobRole", foreign_keys=[job_role_id])
