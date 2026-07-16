from pydantic import BaseModel
from typing import Optional, List

# --- Training Models ---
class TrainingProgram(BaseModel):
    id: int
    program_name: str
    description: Optional[str] = None
    default_duration: Optional[str] = None
    created_at: str

class CreateProgramRequest(BaseModel):
    program_name: str
    description: Optional[str] = None
    default_duration: Optional[str] = None

class AssignTrainingRequest(BaseModel):
    employee_codes: List[str]
    program_id: int
    date: str
    duration: Optional[str] = None

class UpdateAssignmentStatusRequest(BaseModel):
    status: str

class TrainingAssignment(BaseModel):
    id: int
    employee_code: str
    employee_name: Optional[str]
    program_program_id: int
    program_name: str
    training_date: str
    training_status: str
    training_duration: Optional[str]
