from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    employee_code: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    employee_code: Optional[str] = None

class LogResponse(BaseModel):
    id: int
    username: Optional[str]
    action: str
    details: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime

class RolePermissionsUpdate(BaseModel):
    role: str
    permissions: List[str]

class UserOverrideUpdate(BaseModel):
    overrides: Dict[str, Optional[bool]]

class RoleUpdate(BaseModel):
    role: str
