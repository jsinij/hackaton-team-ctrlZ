from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company
from app.models.assessment import Assessment, AuditLog
from app.services.report_service import generate_pdf
from app.services.scoring_service import get_gap_details

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/assessment/{assessment_id}/pdf")
def download_assessment_pdf(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    if assessment.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden generar reportes de evaluaciones completadas",
        )

    gap_details = get_gap_details(assessment.gaps or [])

    completed_at_str = (
        assessment.completed_at.strftime("%Y-%m-%d %H:%M UTC")
        if assessment.completed_at
        else "N/A"
    )

    assessment_data = {
        "assessment_id": assessment.id,
        "company_name": company.name,
        "company_nit": company.nit,
        "company_sector": company.sector,
        "user_name": current_user.name,
        "score": assessment.score or 0.0,
        "answers": assessment.answers or {},
        "gaps": assessment.gaps or [],
        "gap_details": gap_details,
        "completed_at": completed_at_str,
        "recommendations": [],
    }

    try:
        pdf_bytes = generate_pdf(assessment_data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando el PDF: {str(exc)}",
        ) from exc

    audit = AuditLog(
        user_id=current_user.id,
        action="report_downloaded",
        entity_type="assessment",
        entity_id=assessment.id,
        detail={"format": "pdf"},
    )
    db.add(audit)
    db.commit()

    filename = f"reporte_ley1581_{company.nit}_{assessment_id[:8]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
