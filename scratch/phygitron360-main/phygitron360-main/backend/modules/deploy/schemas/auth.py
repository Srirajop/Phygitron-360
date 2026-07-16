from pydantic import BaseModel
from typing import Optional, List, Literal

class LoginRequest(BaseModel):
    username: str
    password: str
    workspace_id: Optional[str] = 'public'

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    employee_code: Optional[str] = None
    is_active: bool

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: Literal['super_admin', 'org_admin', 'manager', 'employee', 'candidate']
    employee_code: Optional[str] = None

class RegisterCompanyRequest(BaseModel):
    company_name: str
    admin_email: str
    admin_password: str

class DemoRequestModel(BaseModel):
    company_name: str
    contact_name: str
    work_email: str
    job_title: Optional[str] = None
    company_size: Optional[str] = None
    modules_requested: Optional[List[str]] = []
    current_tools: Optional[str] = None
    discovery_source: Optional[str] = None
    message: Optional[str] = None

