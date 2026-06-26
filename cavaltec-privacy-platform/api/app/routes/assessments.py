from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_auditor_or_admin
from app.models.user import User
from app.models.company import Company
from app.models.assessment import Assessment, AuditLog
from app.schemas.assessment import AssessmentCreate, AssessmentRead, AnswerSubmit, AssessmentResult
from app.services.scoring_service import compute_score, get_gap_details

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _assert_company_access(company: Company | None, current_user: User):
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")
    if (
        current_user.role != "admin"
        and company.created_by != current_user.id
        and current_user.company_id != company.id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado a esta empresa")


@router.post("", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
def create_assessment(
    body: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_admin),
):
    company = db.query(Company).filter(Company.id == body.company_id).first()
    _assert_company_access(company, current_user)

    assessment = Assessment(
        company_id=body.company_id,
        user_id=current_user.id,
        status="in_progress",
        answers={},
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/{assessment_id}", response_model=AssessmentRead)
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluación no encontrada")

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    _assert_company_access(company, current_user)

    return assessment


@router.put("/{assessment_id}/answers", response_model=AssessmentRead)
def submit_answers(
    assessment_id: str,
    body: AnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_admin),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluación no encontrada")

    if assessment.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La evaluación ya está completada")

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    _assert_company_access(company, current_user)

    valid_answers = {"si", "no", "parcial"}
    for key, val in body.answers.items():
        if val not in valid_answers:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Respuesta inválida '{val}' para '{key}'. Use: si, no, parcial",
            )

    merged = dict(assessment.answers or {})
    merged.update(body.answers)
    assessment.answers = merged

    db.commit()
    db.refresh(assessment)
    return assessment


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_admin),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluación no encontrada")

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    _assert_company_access(company, current_user)

    db.delete(assessment)
    db.commit()


@router.post("/{assessment_id}/complete", response_model=AssessmentResult)
def complete_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_admin),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evaluación no encontrada")

    if assessment.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La evaluación ya está completada")

    company = db.query(Company).filter(Company.id == assessment.company_id).first()
    _assert_company_access(company, current_user)

    if not assessment.answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay respuestas guardadas. Complete el cuestionario antes de finalizar.",
        )

    score, gaps = compute_score(assessment.answers)
    gap_details = get_gap_details(gaps)

    assessment.score = score
    assessment.gaps = gaps
    assessment.status = "completed"
    assessment.completed_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id,
        action="assessment_completed",
        entity_type="assessment",
        entity_id=assessment.id,
        detail={"score": score, "gaps_count": len(gaps)},
    )
    db.add(audit)
    db.commit()
    db.refresh(assessment)

    return AssessmentResult(
        id=assessment.id,
        company_id=assessment.company_id,
        status=assessment.status,
        score=score,
        gaps=gaps,
        gap_details=gap_details,
        completed_at=assessment.completed_at,
    )

