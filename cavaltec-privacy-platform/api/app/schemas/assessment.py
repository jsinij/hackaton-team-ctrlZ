from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class AssessmentCreate(BaseModel):
    company_id: str


class AssessmentRead(BaseModel):
    id: str
    company_id: str
    user_id: str
    status: str
    score: Optional[float]
    answers: dict
    gaps: Optional[list]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AnswerSubmit(BaseModel):
    answers: dict[str, str]


class AssessmentResult(BaseModel):
    id: str
    company_id: str
    status: str
    score: float
    gaps: list[str]
    gap_details: list[dict[str, Any]]
    completed_at: datetime
