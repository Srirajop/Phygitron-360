import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, JSON, Text, DECIMAL, func
from sqlalchemy.orm import relationship
from app.database import Base


class AssessmentType(str, enum.Enum):
    mcq = "mcq"
    coding = "coding"
    written = "written"
    mixed = "mixed"


class AssessmentStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    closed = "closed"


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    mcq_multi = "mcq_multi"
    written = "written"
    coding = "coding"
    file_upload = "file_upload"


class AssignmentStatus(str, enum.Enum):
    pending = "pending"
    started = "started"
    submitted = "submitted"
    graded = "graded"


class ProctoringFlagType(str, enum.Enum):
    tab_switch = "tab_switch"
    copy_paste = "copy_paste"
    timing_anomaly = "timing_anomaly"
    screenshot = "screenshot"
    camera_denied = "camera_denied"
    proctoring_violation = "proctoring_violation"
    audio_detected = "audio_detected"
    audio_snippet = "audio_snippet"
    camera_disabled = "camera_disabled"
    camera_obstructed = "camera_obstructed"
    person_not_visible = "person_not_visible"
    background_movement = "background_movement"
    significant_motion = "significant_motion"
    hardware_denied = "hardware_denied"


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Enum(AssessmentType), default=AssessmentType.mcq)
    time_limit_minutes = Column(Integer, nullable=True)
    pass_score = Column(DECIMAL(5, 2), default=70.0)
    shuffle_questions = Column(Boolean, default=False)
    show_result_immediately = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(AssessmentStatus), default=AssessmentStatus.draft)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    creator = relationship("User", foreign_keys=[created_by])
    questions = relationship("AssessmentQuestion", back_populates="assessment", cascade="all, delete-orphan")
    assignments = relationship("AssessmentAssignment", back_populates="assessment")
    results = relationship("AssessmentResult", back_populates="assessment")


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    options = Column(JSON, nullable=True)  # For MCQ
    correct_answer = Column(Text, nullable=True)
    model_answer = Column(Text, nullable=True)  # For written grading rubric
    starter_code = Column(Text, nullable=True)  # For coding
    test_cases = Column(JSON, nullable=True)  # [{input, expected_output}]
    programming_language = Column(String(50), nullable=True)
    accepted_file_types = Column(String(255), nullable=True)
    skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=True)
    marks = Column(DECIMAL(6, 2), default=1.0)
    order_index = Column(Integer, default=0)
    images = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    assessment = relationship("Assessment", back_populates="questions")
    skill = relationship("SkillTaxonomy", foreign_keys=[skill_id])


class AssessmentAssignment(Base):
    __tablename__ = "assessment_assignments"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    deadline = Column(DateTime, nullable=True)
    status = Column(Enum(AssignmentStatus), default=AssignmentStatus.pending)
    custom_questions = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    assessment = relationship("Assessment", back_populates="assignments")
    user = relationship("User", foreign_keys=[user_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    answers = Column(JSON, nullable=True)  # {question_id: answer}
    scores_per_question = Column(JSON, nullable=True)
    score = Column(DECIMAL(5, 2), nullable=True)
    pass_status = Column(Boolean, nullable=True)
    feedback = Column(Text, nullable=True)
    weak_skill_ids = Column(JSON, nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)
    is_malpractice = Column(Boolean, default=False, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    assessment = relationship("Assessment", back_populates="results")
    user = relationship("User", foreign_keys=[user_id])
    proctoring_flags = relationship("ProctoringFlag", back_populates="result")


class ProctoringFlag(Base):
    __tablename__ = "proctoring_flags"

    id = Column(Integer, primary_key=True, index=True)
    assessment_result_id = Column(Integer, ForeignKey("assessment_results.id"), nullable=False)
    flag_type = Column(String(50), nullable=False)
    details = Column(Text(length=16777215), nullable=True) # MEDIUMTEXT in MySQL
    flagged_at = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    result = relationship("AssessmentResult", back_populates="proctoring_flags")
