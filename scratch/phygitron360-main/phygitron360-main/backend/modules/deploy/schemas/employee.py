from pydantic import BaseModel
from typing import Optional, List, Any

# Common Models
class EmployeeBasicInfo(BaseModel):
    employee_code: str
    name: str
    designation: Optional[str]
    team: Optional[str]
    reporting_manager: Optional[str]
    email_id: Optional[str]
    photo_path: Optional[str]
    employment_status: Optional[str]
    exit_date: Optional[str]
    role: Optional[str]

class EmployeeFullProfile(BaseModel):
    # Base fields
    id: Optional[int]
    employee_code: str
    name: str
    dob: Optional[str]
    contact_number: Optional[str]
    emergency_contact: Optional[str]
    email_id: Optional[str]
    doj: Optional[str] 
    team: Optional[str]
    designation: Optional[str]
    employment_type: Optional[str]
    reporting_manager: Optional[str]
    location: Optional[str]
    current_address: Optional[str]
    permanent_address: Optional[str]
    education_details: Optional[str]
    employment_status: Optional[str]
    photo_path: Optional[str]
    cv_path: Optional[str]
    id_proofs: Optional[str]
    pf_included: Optional[str]
    mediclaim_included: Optional[str]
    notes: Optional[str]
    bank_name: Optional[str]
    bank_account_no: Optional[str]
    pan_no: Optional[str]
    exit_date: Optional[str]
    exit_reason: Optional[str]
    clearance_status: Optional[str]
    
    # Relations (Dictionaries/Lists)
    skill_matrix: Optional[dict] = {}
    assets: Optional[List[dict]] = []
    performance: Optional[List[dict]] = []
    hr_activity: Optional[List[dict]] = []
    kra_assignments: Optional[List[dict]] = []

class UpdateEmployeeRequest(BaseModel):
    # Flexible dict request as handling all fields with nested objects can be complex directly from frontend
    # But explicitly defining fields is better. For now adhering to existing logic:
    name: Optional[str] = None
    designation: Optional[str] = None
    team: Optional[str] = None
    contact_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    dob: Optional[str] = None
    email_id: Optional[str] = None
    reporting_manager: Optional[str] = None
    location: Optional[str] = None
    primary_skillset: Optional[str] = None
    secondary_skillset: Optional[str] = None
    experience_years: Optional[Any] = None
    education_details: Optional[Any] = None
    pf_included: Optional[str] = None
    mediclaim_included: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    pan_no: Optional[str] = None
    employee_code: Optional[str] = None
    doj: Optional[str] = None
    skill_matrix: Optional[dict] = None

class OffboardRequest(BaseModel):
    exit_date: Optional[str]
    exit_reason: Optional[str]
    exit_type: Optional[str] = "Immediate"
    remarks: Optional[str] = ""
