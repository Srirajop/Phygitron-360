from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class SkillTaxonomy(Base):
    __tablename__ = "skill_taxonomy"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    normalized_name = Column(String(255), nullable=False, unique=True, index=True)
    category = Column(String(100), nullable=True)
    aliases = Column(JSON, nullable=True)  # list of alternate names
    parent_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    parent = relationship("SkillTaxonomy", remote_side=[id], back_populates="children")
    children = relationship("SkillTaxonomy", back_populates="parent")
    candidate_skills = relationship("CandidateSkill", back_populates="skill")
    employee_skills = relationship("EmployeeSkill", back_populates="skill")
