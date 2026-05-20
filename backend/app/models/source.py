import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, JSON, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class CandidateStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    shortlisted = "shortlisted"
    offered = "offered"
    archived = "archived"
    parse_failed = "parse_failed"

class OfferStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    changes_requested = "changes_requested"
    sent = "sent"
    accepted = "accepted"
    declined = "declined"
    
class JobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class SkillLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"


class SkillSource(str, enum.Enum):
    resume = "resume"
    verified = "verified"
    self_reported = "self_reported"


class SkillRelation(str, enum.Enum):
    requires = "requires"
    leads_to = "leads_to"
    used_for = "used_for"
    similar_to = "similar_to"


class InviteStatus(str, enum.Enum):
    sent = "sent"
    opened = "opened"
    logged_in = "logged_in"
    completed = "completed"


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    resume_url = Column(String(512), nullable=True)
    location = Column(String(255), nullable=True)
    exp_years = Column(Integer, default=0)
    availability = Column(String(100), nullable=True)
    status = Column(Enum(CandidateStatus), default=CandidateStatus.invited)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="candidate")
    organisation = relationship("Organisation", back_populates="candidates")
    skills = relationship("CandidateSkill", back_populates="candidate", cascade="all, delete-orphan")
    invites = relationship("CandidateInvite", back_populates="candidate")
    ai_scores = relationship("AIScore", primaryjoin="and_(AIScore.entity_type=='candidate', AIScore.entity_id==Candidate.id)", foreign_keys="[AIScore.entity_id]", viewonly=True)


class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=False)
    level = Column(Enum(SkillLevel), default=SkillLevel.beginner)
    source = Column(Enum(SkillSource), default=SkillSource.resume)
    years_of_use = Column(Integer, nullable=True)
    evidence = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    candidate = relationship("Candidate", back_populates="skills")
    skill = relationship("SkillTaxonomy", back_populates="candidate_skills")


class SkillGraphEdge(Base):
    __tablename__ = "skill_graph_edges"

    id = Column(Integer, primary_key=True, index=True)
    from_skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=False)
    to_skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=False)
    relation = Column(Enum(SkillRelation), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    from_skill = relationship("SkillTaxonomy", foreign_keys=[from_skill_id])
    to_skill = relationship("SkillTaxonomy", foreign_keys=[to_skill_id])


class JobRole(Base):
    __tablename__ = "job_roles"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    required_skills = Column(JSON, nullable=True)  # [{skill_id, min_level}]
    min_experience = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organisation = relationship("Organisation", back_populates="job_roles")
    invites = relationship("CandidateInvite", back_populates="job_role")


class CandidateInvite(Base):
    __tablename__ = "candidate_invites"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_role_id = Column(Integer, ForeignKey("job_roles.id"), nullable=False)
    hr_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    temp_password_hash = Column(String(255), nullable=True)
    email_sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    logged_in_at = Column(DateTime, nullable=True)
    status = Column(Enum(InviteStatus), default=InviteStatus.sent)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    candidate = relationship("Candidate", back_populates="invites")
    job_role = relationship("JobRole", back_populates="invites")
    hr_user = relationship("User", foreign_keys=[hr_user_id])

class BulkUploadJob(Base):
    __tablename__ = "bulk_upload_jobs"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=True)
    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    processed_details = Column(JSON, nullable=True)  # List of {"filename": str, "status": str, "error": str}
    status = Column(Enum(JobStatus), default=JobStatus.pending)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organisation = relationship("Organisation")
    creator = relationship("User")


class OfferLetter(Base):
    __tablename__ = "offer_letters"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    role_title = Column(String(255), nullable=False)
    salary = Column(String(100), nullable=False)
    department = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    start_date = Column(DateTime, nullable=True)

    offer_content = Column(JSON, nullable=False)
    status = Column(Enum(OfferStatus), default=OfferStatus.pending)
    feedback = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    candidate = relationship("Candidate")
    organisation = relationship("Organisation")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
