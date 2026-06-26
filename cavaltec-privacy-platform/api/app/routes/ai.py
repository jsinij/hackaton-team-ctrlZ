from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company
from app.models.assessment import Assessment
from app.services import ai_service
from app.services.scoring_service import get_gap_details
from app.utils.questions import QUESTIONS_BY_ID
from app.schemas.ai import (
    ExplainQuestionRequest,
    ExplainQuestionResponse,
    AnswerGuidanceRequest,
    AnswerGuidanceResponse,
    RecommendationsRequest,
    RecommendationsResponse,
    InterpretScoreRequest,
    InterpretScoreResponse,
    ChatRequest,
    ChatResponse,
)

router = APIRouter(prefix="/ai", tags=["ai"])
limiter = Limiter(key_func=get_remote_address)


def _get_user_key(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    return user_id or get_remote_address(request)


def _get_assessment_with_access(
    assessment_id: str, current_user: User, db: Session
) -> Assessment:
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluación no encontrada")

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    if (
        current_user.role != "admin"
        and company.created_by != current_user.id
        and current_user.company_id != company.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")

    return assessment


@router.post("/explain-question", response_model=ExplainQuestionResponse)
@limiter.limit("5/minute")
def explain_question(
    request: Request,
    body: ExplainQuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = QUESTIONS_BY_ID.get(body.question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pregunta '{body.question_id}' no encontrada")

    explanation = ai_service.explain_question(question["text"], question["reference"])

    return ExplainQuestionResponse(
        question_id=body.question_id,
        question_text=question["text"],
        explanation=explanation,
        reference=question["reference"],
    )


@router.post("/answer-guidance", response_model=AnswerGuidanceResponse)
@limiter.limit("5/minute")
def answer_guidance(
    request: Request,
    body: AnswerGuidanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = QUESTIONS_BY_ID.get(body.question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pregunta '{body.question_id}' no encontrada")

    guidance = ai_service.answer_guidance(question["text"], question["reference"])

    return AnswerGuidanceResponse(
        question_id=body.question_id,
        question_text=question["text"],
        guidance=guidance,
        reference=question["reference"],
    )


@router.post("/recommendations", response_model=RecommendationsResponse)
@limiter.limit("5/minute")
def get_recommendations(
    request: Request,
    body: RecommendationsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_assessment_with_access(body.assessment_id, current_user, db)

    if assessment.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La evaluación debe estar completada para generar recomendaciones",
        )

    gap_details = get_gap_details(assessment.gaps or [])
    recommendations = ai_service.generate_recommendations(gap_details)

    return RecommendationsResponse(
        assessment_id=assessment.id,
        score=assessment.score or 0.0,
        recommendations=recommendations,
    )


@router.post("/interpret-score", response_model=InterpretScoreResponse)
@limiter.limit("5/minute")
def interpret_score(
    request: Request,
    body: InterpretScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_assessment_with_access(body.assessment_id, current_user, db)

    if assessment.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La evaluación debe estar completada para interpretar el score",
        )

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    company_name = company.name if company else "Empresa"

    interpretation = ai_service.interpret_score(assessment.score or 0.0, company_name)

    return InterpretScoreResponse(
        assessment_id=assessment.id,
        score=assessment.score or 0.0,
        company_name=company_name,
        interpretation=interpretation,
    )


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat_with_agent(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _get_assessment_with_access(body.assessment_id, current_user, db)

    if assessment.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La evaluación debe estar completada para usar el chat",
        )

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    gap_details = get_gap_details(assessment.gaps or [])
    history = [{"role": m.role, "content": m.content} for m in body.history]

    response = ai_service.chat(
        score=assessment.score or 0.0,
        gap_details=gap_details,
        company_name=company.name if company else "la empresa",
        company_sector=company.sector if company else "desconocido",
        message=body.message,
        history=history,
    )

    return ChatResponse(message=response)
