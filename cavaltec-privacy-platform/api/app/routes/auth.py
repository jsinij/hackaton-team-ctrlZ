from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.firebase_service import verify_token
from app.models.user import User
from app.models.assessment import AuditLog
from app.schemas.user import UserRead
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class FirebaseLoginRequest(BaseModel):
    id_token: str


@router.post("/firebase-login", response_model=UserRead)
def firebase_login(body: FirebaseLoginRequest, db: Session = Depends(get_db)):
    try:
        decoded = verify_token(body.id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Firebase inválido",
        ) from exc

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")
    name = decoded.get("name", email.split("@")[0] if email else "Usuario")

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    if user:
        user.email = email
        user.name = name or user.name
        user.updated_at = datetime.now(timezone.utc)
    else:
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            role="evaluador",
        )
        db.add(user)

    db.flush()

    audit = AuditLog(
        user_id=user.id,
        action="login",
        entity_type="user",
        entity_id=user.id,
        detail={"email": email},
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    return user


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
