import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, JSON, Text, DECIMAL, Date, func
from sqlalchemy.orm import relationship
from app.database import Base


class EmployeeStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    deployed = "deployed"
    offboarded = "offboarded"


class SkillValidatedBy(str, enum.Enum):
    resume = "resume"
    assessment = "assessment"
    course = "course"
    self_reported = "self_reported"


class SkillLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    expert = "expert"


class DeploymentStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    emp_id = Column(String(50), nullable=True, index=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    department = Column(String(100), nullable=True)
    join_date = Column(Date, nullable=True)
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.active)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="employee")
    organisation = relationship("Organisation", back_populates="employees")
    manager = relationship("Employee", remote_side=[id], back_populates="subordinates")
    subordinates = relationship("Employee", back_populates="manager")
    skills = relationship("EmployeeSkill", back_populates="employee", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="employee")


class EmployeeSkill(Base):
    __tablename__ = "employee_skills"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=False)
    level = Column(Enum(SkillLevel), default=SkillLevel.beginner)
    verified_by = Column(Enum(SkillValidatedBy), default=SkillValidatedBy.resume)
    last_verified_at = Column(DateTime, nullable=True)
    decayed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="skills")
    skill = relationship("SkillTaxonomy", back_populates="employee_skills")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    project_name = Column(String(255), nullable=False)
    client_name = Column(String(255), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    skills_utilised = Column(JSON, nullable=True)
    status = Column(Enum(DeploymentStatus), default=DeploymentStatus.active)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="deployments")


class ProjectRequirement(Base):
    __tablename__ = "project_requirements"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    title = Column(String(255), nullable=False)
    client = Column(String(255), nullable=True)
    required_skills = Column(JSON, nullable=True)  # [{skill_id, min_level, headcount}]
    headcount = Column(Integer, default=1)
    start_date = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organisation = relationship("Organisation", foreign_keys=[org_id])
    creator = relationship("User", foreign_keys=[created_by])
