from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class CandidateBase(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: Optional[float] = 0.0
    current_designation: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    primary_skills: List[str] = []
    secondary_skills: List[str] = []
    status: str = "New"
    source: str = "Manual"
    ai_summary: Optional[str] = None

class ExperienceSchema(BaseModel):
    company: Optional[str] = None
    designation: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    description: Optional[str] = None

class EducationSchema(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CandidateCreate(CandidateBase):
    experience: List[ExperienceSchema] = []
    education: List[EducationSchema] = []

class CandidateResponse(CandidateBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CandidateStatusUpdate(BaseModel):
    status: str

class CandidateNoteCreate(BaseModel):
    content: str

class CandidateNoteResponse(BaseModel):
    id: int
    candidate_id: int
    author_name: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CandidateSearchFilters(BaseModel):
    status: Optional[str] = None
    skills: Optional[List[str]] = []
    min_experience: Optional[float] = None
    max_experience: Optional[float] = None
    source: Optional[str] = None
    search: Optional[str] = None
