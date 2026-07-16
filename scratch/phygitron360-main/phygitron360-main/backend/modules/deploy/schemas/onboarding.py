from pydantic import BaseModel
from typing import Optional

class InviteRequest(BaseModel):
    name: str
    email: str
    role: str = "Employee"
    department: Optional[str] = None
    designation: Optional[str] = None

class InviteResponse(BaseModel):
    id: int
    token: str
    name: str
    email: str
    role: str
    department: Optional[str]
    designation: Optional[str]
    status: str
    created_at: str
    expires_at: Optional[str]

class VerifyTokenRequest(BaseModel):
    token: str

class ApprovalRequest(BaseModel):
    reporting_manager: Optional[str] = None
    employment_type: str = "Full Time"
    pf_included: str = "No"
    mediclaim_included: str = "No"
    notes: Optional[str] = None
