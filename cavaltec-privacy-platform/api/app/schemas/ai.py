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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    assessment_id: str
    message: str
    history: list[ChatMessage] = []
    file_name: Optional[str] = None
    file_base64: Optional[str] = None


class ChatResponse(BaseModel):
    message: str


class QuestionChatRequest(BaseModel):
    question_id: str
    mode: str  # "explain" | "guidance" | "followup"
    message: str
    history: list[ChatMessage] = []


class QuestionChatResponse(BaseModel):
    message: str
