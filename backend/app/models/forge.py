import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, JSON, Text, DECIMAL, func
from sqlalchemy.orm import relationship
from app.database import Base


class CourseDifficulty(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class CourseStatus(str, enum.Enum):
    draft = "draft"
    pending_review = "pending_review"
    published = "published"


class ContentType(str, enum.Enum):
    video = "video"
    pdf = "pdf"
    quiz = "quiz"
    lab = "lab"
    article = "article"


class EnrollmentTrigger(str, enum.Enum):
    manual = "manual"
    ai_gap = "ai_gap"
    hr_push = "hr_push"


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    skill_ids = Column(JSON, nullable=True)  # [skill_id, ...]
    difficulty = Column(Enum(CourseDifficulty), default=CourseDifficulty.beginner)
    estimated_hours = Column(DECIMAL(5, 1), nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    status = Column(Enum(CourseStatus), default=CourseStatus.draft)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(255), default="General")
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    instructor = relationship("User", foreign_keys=[instructor_id])
    sections = relationship("CourseSection", back_populates="course", cascade="all, delete-orphan", order_by="CourseSection.order_index")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")


class CourseSection(Base):
    __tablename__ = "course_sections"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0)
    content_type = Column(Enum(ContentType), nullable=False)
    content_url = Column(String(512), nullable=True)
    content_markdown = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    pass_score = Column(DECIMAL(5, 2), default=50.0)  # For quizzes
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    course = relationship("Course", back_populates="sections")
    quizzes = relationship("SectionQuiz", back_populates="section", cascade="all, delete-orphan")
    progress = relationship("LearningProgress", back_populates="section", cascade="all, delete-orphan")


class SectionQuiz(Base):
    __tablename__ = "section_quizzes"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("course_sections.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=True)
    correct_answer = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=True)
    marks = Column(DECIMAL(5, 2), default=1.0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    section = relationship("CourseSection", back_populates="quizzes")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    triggered_by = Column(Enum(EnrollmentTrigger), default=EnrollmentTrigger.manual)
    progress_percent = Column(DECIMAL(5, 2), default=0.0)
    deadline = Column(DateTime, nullable=True)
    last_accessed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    course = relationship("Course", back_populates="enrollments")
    progress = relationship("LearningProgress", back_populates="enrollment", cascade="all, delete-orphan")


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("course_sections.id"), nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    progress_percent = Column(DECIMAL(5, 2), default=0.0)
    video_progress_seconds = Column(Integer, default=0)
    quiz_score = Column(DECIMAL(5, 2), nullable=True)
    scorm_progress_percent = Column(DECIMAL(5, 2), nullable=True)
    scorm_score = Column(DECIMAL(5, 2), nullable=True)
    scorm_status = Column(String(64), nullable=True)
    scorm_location = Column(String(255), nullable=True)
    scorm_suspend_data = Column(Text, nullable=True)
    last_scorm_commit_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    enrollment = relationship("Enrollment", back_populates="progress")
    section = relationship("CourseSection", back_populates="progress")


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    issued_at = Column(DateTime, server_default=func.now(), nullable=False)
    verification_code = Column(String(64), unique=True, nullable=False, index=True)
    pdf_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    course = relationship("Course", back_populates="certificates")
