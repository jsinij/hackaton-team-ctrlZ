from pydantic import BaseModel
from typing import Optional


class ExplainQuestionRequest(BaseModel):
    question_id: str


class ExplainQuestionResponse(BaseModel):
    question_id: str
    question_text: str
    explanation: str
    reference: str


class AnswerGuidanceRequest(BaseModel):
    question_id: str


class AnswerGuidanceResponse(BaseModel):
    question_id: str
    question_text: str
    guidance: str
    reference: str


class RecommendationsRequest(BaseModel):
    assessment_id: str


class RecommendationsResponse(BaseModel):
    assessment_id: str
    score: float
    recommendations: list[str]


class InterpretScoreRequest(BaseModel):
    assessment_id: str


class InterpretScoreResponse(BaseModel):
    assessment_id: str
    score: float
    company_name: str
    interpretation: str
