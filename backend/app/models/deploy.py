import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, ForeignKey, JSON, Text, DECIMAL, Date, func
from sqlalchemy.orm import relationship
from app.database import Base


class EmployeeStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    deployed = "deployed"
    notice_period = "notice_period"
    offboarded = "offboarded"
    exited = "exited"


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


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    half_day = "half_day"
    leave = "leave"
    holiday = "holiday"


class LeaveType(str, enum.Enum):
    sick = "sick"
    casual = "casual"
    privilege = "privilege"
    unpaid = "unpaid"
    compensatory = "compensatory"


class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    emp_id = Column(String(50), nullable=True, index=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    dob = Column(Date, nullable=True)
    contact_number = Column(String(20), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    join_date = Column(Date, nullable=True)
    employment_type = Column(String(50), nullable=True) # Full-time, Contract, etc.
    location = Column(String(100), nullable=True)
    current_address = Column(Text, nullable=True)
    permanent_address = Column(Text, nullable=True)
    education_details = Column(JSON, nullable=True) # List of degrees/certs
    pf_included = Column(Boolean, default=False)
    mediclaim_included = Column(Boolean, default=False)
    photo_path = Column(String(255), nullable=True)
    cv_path = Column(String(255), nullable=True)
    id_proofs = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.active)
    
    # Exit Info
    exit_date = Column(Date, nullable=True)
    exit_reason = Column(Text, nullable=True)
    clearance_status = Column(String(50), nullable=True) # Pending, Cleared
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="employee")
    organisation = relationship("Organisation", back_populates="employees")
    manager = relationship("Employee", remote_side=[id], back_populates="subordinates")
    subordinates = relationship("Employee", back_populates="manager")
    skills = relationship("EmployeeSkill", back_populates="employee", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="employee")
    
    # HRMS Relationships
    attendance = relationship("Attendance", back_populates="employee")
    leave_requests = relationship("LeaveRequest", back_populates="employee", foreign_keys="LeaveRequest.employee_id")
    leave_balances = relationship("LeaveBalance", back_populates="employee")
    assets = relationship("Asset", back_populates="employee")
    asset_checklist = relationship("AssetChecklist", back_populates="employee")
    performance_records = relationship("PerformanceRecord", back_populates="employee", foreign_keys="PerformanceRecord.employee_id")
    kra_assessments = relationship("KRAAssessment", back_populates="employee")
    training_assignments = relationship("TrainingAssignment", back_populates="employee")
    hr_activities = relationship("HRActivity", back_populates="employee")
    payroll_slips = relationship("PayrollSlip", back_populates="employee", cascade="all, delete-orphan")


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


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.present)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="attendance")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(Enum(LeaveType), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(500), nullable=True)
    status = Column(Enum(LeaveStatus), default=LeaveStatus.pending)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="leave_requests", foreign_keys=[employee_id])
    approver = relationship("User", foreign_keys=[approved_by])


# HRMS Integration Models
class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    asset_name = Column(String(255), nullable=False)
    asset_type = Column(String(100), nullable=False) # laptop, mobile, etc.
    serial_number = Column(String(255), nullable=True)
    issue_date = Column(Date, nullable=True)
    return_date = Column(Date, nullable=True)
    condition = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="assets")


class PerformanceRecord(Base):
    __tablename__ = "performance_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year = Column(Integer, nullable=False)
    quarter = Column(Integer, nullable=True)
    rating = Column(DECIMAL(4, 2), nullable=True)
    review_summary = Column(Text, nullable=True)
    goals_met = Column(JSON, nullable=True)
    assessed_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="performance_records")
    assessor = relationship("Employee", foreign_keys=[assessed_by])


class HRActivity(Base):
    __tablename__ = "hr_activities"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    activity_type = Column(String(100), nullable=False) # milestone, warning, memo
    description = Column(Text, nullable=False)
    activity_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", back_populates="hr_activities")
    creator = relationship("User", foreign_keys=[created_by])


# ── New DEPLOY Module Extensions ──────────────────────────────────────────────

class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year = Column(Integer, nullable=False)
    sick_allocated = Column(Integer, default=10)
    sick_used = Column(Integer, default=0)
    casual_allocated = Column(Integer, default=12)
    casual_used = Column(Integer, default=0)
    privilege_allocated = Column(Integer, default=15)
    privilege_used = Column(Integer, default=0)
    
    employee = relationship("Employee", back_populates="leave_balances")


class KRALibrary(Base):
    __tablename__ = "kra_library"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    organisation = relationship("Organisation")


class KRAAssessmentStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted" # waiting for manager
    finalized = "finalized"


class KRAAssessment(Base):
    __tablename__ = "kra_assessments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(String(50)) # Monthly, Quarterly, etc.
    status = Column(Enum(KRAAssessmentStatus), default=KRAAssessmentStatus.draft)
    total_score = Column(DECIMAL(5, 2), default=0)
    percentage = Column(DECIMAL(5, 2), default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    employee = relationship("Employee", back_populates="kra_assessments")
    items = relationship("KRAAssessmentItem", back_populates="assessment", cascade="all, delete-orphan")


class KRAAssessmentItem(Base):
    __tablename__ = "kra_assessment_items"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("kra_assessments.id"), nullable=False)
    kra_id = Column(Integer, ForeignKey("kra_library.id"), nullable=False)
    self_score = Column(Integer, default=0) # 0-10
    manager_score = Column(Integer, default=0) # 0-10
    self_comment = Column(Text, nullable=True)
    manager_comment = Column(Text, nullable=True)

    assessment = relationship("KRAAssessment", back_populates="items")
    kra = relationship("KRALibrary")


class TrainingProgram(Base):
    __tablename__ = "training_programs"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    duration_days = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    organisation = relationship("Organisation")


class TrainingStatus(str, enum.Enum):
    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"


class TrainingAssignment(Base):
    __tablename__ = "training_assignments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("training_programs.id"), nullable=False)
    status = Column(Enum(TrainingStatus), default=TrainingStatus.assigned)
    assigned_date = Column(Date, default=date.today)
    completion_date = Column(Date, nullable=True)

    employee = relationship("Employee", back_populates="training_assignments")
    program = relationship("TrainingProgram")


class OnboardingStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    revoked = "revoked"


class OnboardingInvite(Base):
    __tablename__ = "onboarding_invites"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(100), nullable=True) # UserRole
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    token = Column(String(255), unique=True, nullable=False)
    status = Column(Enum(OnboardingStatus), default=OnboardingStatus.pending)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    organisation = relationship("Organisation")


class AssetChecklist(Base):
    __tablename__ = "asset_checklist"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    category = Column(String(100)) # Laptop, ID Card, etc.
    item_name = Column(String(255))
    issued = Column(Boolean, default=False)
    returned = Column(Boolean, default=False)
    condition = Column(String(100), nullable=True)

    employee = relationship("Employee", back_populates="asset_checklist")


class PayrollStatus(str, enum.Enum):
    draft = "draft"
    released = "released"
    paid = "paid"


class PayrollSlip(Base):
    __tablename__ = "payroll_slips"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month_year = Column(String(20), nullable=False) # e.g., "April 2026"
    basic_salary = Column(DECIMAL(10, 2), default=0)
    hra = Column(DECIMAL(10, 2), default=0)
    other_allowances = Column(DECIMAL(10, 2), default=0)
    deductions_tax = Column(DECIMAL(10, 2), default=0)
    deductions_pf = Column(DECIMAL(10, 2), default=0)
    net_payable = Column(DECIMAL(10, 2), default=0)
    status = Column(Enum(PayrollStatus), default=PayrollStatus.draft)
    payslip_url = Column(String(255), nullable=True) # S3 or local path to PDF
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    employee = relationship("Employee", back_populates="payroll_slips")
