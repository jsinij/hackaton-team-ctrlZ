import asyncio
import logging
import threading
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base
from app.routes import auth, companies, assessments, ai, reports

import app.models  # noqa: F401 — ensure models are registered before create_all

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


def _warmup_ai_client():
    """Pre-authenticate the Azure AI agent in a background thread at startup."""
    try:
        from app.services.ai_service import _get_client
        client = _get_client()
        # A lightweight call to trigger token acquisition and validate the agent exists
        client.agents.get_agent(settings.azure_ai_agent_id)
        logger.info("Azure AI agent autenticado y listo.")
        print("✓ Azure AI agent autenticado y listo.", flush=True)
    except Exception as exc:
        logger.warning("No se pudo pre-autenticar el agente Azure AI: %s", exc)


@asynccontextmanager
async def lifespan(application: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Start AI auth warmup in background so it doesn't block server startup
    threading.Thread(target=_warmup_ai_client, daemon=True).start()
    yield


app = FastAPI(
    title="Cavaltec Privacy API",
    description="Plataforma de autodiagnóstico de cumplimiento Ley 1581 — Protección de Datos Colombia",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(assessments.router)
app.include_router(ai.router)
app.include_router(reports.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "cavaltec-privacy-api"}
