from pydantic import BaseModel
from typing import List, Optional

class AssessmentEntry(BaseModel):
    category: str
    subcategory: str
    self_score: Optional[int] = None
    manager_score: Optional[int] = None
    score: Optional[int] = None
    manager_comment: Optional[str] = ""
    employee_comment: Optional[str] = ""

class SaveAssessmentRequest(BaseModel):
    employee_code: str
    year: int
    period_type: str = "Quarterly"
    period_value: str
    entries: List[AssessmentEntry]
    status: str = "Draft"

class RequestAssessmentRequest(BaseModel):
    employee_code: str
    year: int
    period_type: str
    period_value: str
