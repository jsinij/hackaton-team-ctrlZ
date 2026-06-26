from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company
from app.models.assessment import Assessment
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.schemas.assessment import AssessmentRead

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(
    body: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Company).filter(Company.nit == body.nit).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una empresa con NIT {body.nit}",
        )

    company = Company(
        name=body.name,
        nit=body.nit,
        sector=body.sector,
        size=body.size,
        created_by=current_user.id,
    )
    db.add(company)

    if not current_user.company_id:
        current_user.company_id = company.id
        current_user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(company)
    return company


@router.get("", response_model=list[CompanyRead])
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        companies = db.query(Company).all()
    else:
        companies = db.query(Company).filter(Company.created_by == current_user.id).all()
        if current_user.company_id:
            extra = db.query(Company).filter(Company.id == current_user.company_id).first()
            ids_found = {c.id for c in companies}
            if extra and extra.id not in ids_found:
                companies.append(extra)
    return companies


@router.get("/{company_id}", response_model=CompanyRead)
def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    if current_user.role != "admin" and company.created_by != current_user.id and current_user.company_id != company.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")

    return company


@router.put("/{company_id}", response_model=CompanyRead)
def update_company(
    company_id: str,
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    if current_user.role != "admin" and company.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para editar esta empresa")

    if body.name is not None:
        company.name = body.name
    if body.sector is not None:
        company.sector = body.sector
    if body.size is not None:
        company.size = body.size

    company.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}/assessments", response_model=list[AssessmentRead])
def list_company_assessments(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    if current_user.role != "admin" and company.created_by != current_user.id and current_user.company_id != company.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")

    assessments = (
        db.query(Assessment)
        .filter(Assessment.company_id == company_id)
        .order_by(Assessment.created_at.desc())
        .all()
    )
    return assessments
