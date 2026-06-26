from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.models.company import Company
from app.schemas.user import UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if user.email.lower() == settings.admin_email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se puede modificar el rol del administrador principal",
        )

    if body.company_id is not None:
        if body.company_id != "":
            company = db.query(Company).filter(Company.id == body.company_id).first()
            if not company:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Empresa no encontrada",
                )
            user.company_id = body.company_id
        else:
            user.company_id = None

    if body.role is not None:
        user.role = body.role

    if body.name is not None:
        user.name = body.name

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user