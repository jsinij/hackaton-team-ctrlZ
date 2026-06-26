from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    firebase_uid: str
    email: str
    name: str
    role: str = "evaluador"
    company_id: Optional[str] = None


class UserRead(BaseModel):
    id: str
    firebase_uid: str
    email: str
    name: str
    role: str
    company_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[str] = None
