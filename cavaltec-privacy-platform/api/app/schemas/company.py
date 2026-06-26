from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class CompanySize(str, Enum):
    micro = "micro"
    pequena = "pequeña"
    mediana = "mediana"
    grande = "grande"


class CompanyCreate(BaseModel):
    name: str
    nit: str
    sector: str
    size: CompanySize


class CompanyRead(BaseModel):
    id: str
    name: str
    nit: str
    sector: str
    size: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    sector: Optional[str] = None
    size: Optional[CompanySize] = None
