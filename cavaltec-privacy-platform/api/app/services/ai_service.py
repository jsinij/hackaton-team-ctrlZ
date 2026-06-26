import json
import logging
import os
import time

import msal
from azure.ai.projects import AIProjectClient
from azure.ai.agents.models import ListSortOrder
from azure.core.credentials import AccessToken
from azure.identity import DeviceCodeCredential, TokenCachePersistenceOptions
from app.core.config import settings

logger = logging.getLogger(__name__)

# azure-identity's internal client ID (from MSAL cache inspection)
_AZ_IDENTITY_CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"
# Cache written by DeviceCodeCredential with TokenCachePersistenceOptions + HOME=/app/auth
_CACHE_FILE = "/app/auth/.IdentityService/msal.cache.nocae"

_client: AIProjectClient | None = None


def _device_code_callback(verification_uri: str, user_code: str, expires_on):
    banner = "=" * 60
    msg = (
        f"\n{banner}\n"
        f"  AUTENTICACION AZURE REQUERIDA\n"
        f"  1. Abre:              {verification_uri}\n"
        f"  2. Ingresa el codigo: {user_code}\n"
        f"{banner}\n"
    )
    logger.warning(msg)
    print(msg, flush=True)


def _tenant_from_cache() -> str | None:
    """Extract tenant ID from the MSAL cache home_account_id field."""
    try:
        with open(_CACHE_FILE) as f:
            data = json.load(f)
        for acc in data.get("Account", {}).values():
            parts = acc.get("home_account_id", "").split(".")
            if len(parts) == 2:
                return parts[1]
    except Exception:
        pass
    return None


def _try_silent_msal(scopes: list[str]) -> AccessToken | None:
    """Try a silent token refresh using the persisted MSAL cache."""
    if not os.path.exists(_CACHE_FILE):
        return None
    tenant_id = _tenant_from_cache()
    if not tenant_id:
        return None
    try:
        cache = msal.SerializableTokenCache()
        with open(_CACHE_FILE) as f:
            cache.deserialize(f.read())
        app = msal.PublicClientApplication(
            client_id=_AZ_IDENTITY_CLIENT_ID,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            token_cache=cache,
        )
        accounts = app.get_accounts()
        if not accounts:
            return None
        result = app.acquire_token_silent(scopes, account=accounts[0])
        if result and "access_token" in result:
            if cache.has_state_changed:
                with open(_CACHE_FILE, "w") as f:
                    f.write(cache.serialize())
            logger.info("Token obtenido silenciosamente del cache.")
            return AccessToken(
                result["access_token"],
                int(time.time()) + result.get("expires_in", 3600),
            )
    except Exception as exc:
        logger.warning("Silent MSAL refresh failed: %s", exc)
    return None


class _SmartCredential:
    """Tries silent MSAL refresh first; falls back to DeviceCodeCredential."""

    def __init__(self):
        self._device_code_cred = DeviceCodeCredential(
            prompt_callback=_device_code_callback,
            cache_persistence_options=TokenCachePersistenceOptions(
                allow_unencrypted_storage=True
            ),
        )

    def get_token(self, *scopes, **kwargs):
        scope = list(scopes)
        token = _try_silent_msal(scope)
        if token:
            return token
        logger.info("Cache vacío o expirado — iniciando device code flow.")
        return self._device_code_cred.get_token(*scopes, **kwargs)


def _get_client() -> AIProjectClient:
    global _client
    if _client is None:
        _client = AIProjectClient(
            credential=_SmartCredential(),
            endpoint=settings.azure_ai_project_endpoint,
        )
    return _client


def _run_agent(message: str, additional_instructions: str = "") -> str:
    client = _get_client()
    thread = client.agents.threads.create()

    client.agents.messages.create(
        thread_id=thread.id,
        role="user",
        content=message,
    )

    kwargs: dict = {"thread_id": thread.id, "agent_id": settings.azure_ai_agent_id}
    if additional_instructions:
        kwargs["additional_instructions"] = additional_instructions

    run = client.agents.runs.create_and_process(**kwargs)

    if run.status == "failed":
        raise RuntimeError(f"Agent run failed: {run.last_error}")

    messages = client.agents.messages.list(
        thread_id=thread.id, order=ListSortOrder.ASCENDING
    )
    for msg in messages:
        if msg.role == "assistant" and msg.text_messages:
            return msg.text_messages[-1].text.value

    return ""


def explain_question(question_text: str, reference: str) -> str:
    try:
        return _run_agent(
            f"Explica en lenguaje sencillo qué significa el siguiente requisito de la Ley 1581 "
            f"y por qué es importante para una empresa colombiana:\n\n"
            f"Requisito: {question_text}\n"
            f"Referencia normativa: {reference}"
        )
    except Exception:
        return (
            f"Este requisito evalúa el cumplimiento de: {reference}. "
            "Consulte la Ley 1581 de 2012 y el Decreto 1377 de 2013 para más detalles."
        )


def answer_guidance(question_text: str, reference: str) -> str:
    try:
        return _run_agent(
            f"Para la siguiente pregunta de autodiagnóstico de cumplimiento de la Ley 1581, "
            f"explica cómo debe responder una empresa y qué evidencias debe tener para responder 'Sí':\n\n"
            f"Pregunta: {question_text}\n"
            f"Referencia normativa: {reference}"
        )
    except Exception:
        return (
            "Para responder 'Sí' a este requisito, la empresa debe contar con documentación formal "
            f"que evidencie el cumplimiento de {reference}. Consulte con su área jurídica o de compliance."
        )


def generate_recommendations(gaps: list[dict]) -> list[str]:
    if not gaps:
        return ["¡Felicitaciones! No se identificaron brechas en su evaluación."]
    try:
        gap_list = "\n".join(
            f"- {g['id']}: {g['text']} (Ref: {g['reference']})" for g in gaps
        )
        result = _run_agent(
            f"Una empresa colombiana tiene las siguientes brechas de cumplimiento con la Ley 1581:\n\n"
            f"{gap_list}\n\n"
            "Genera una lista de recomendaciones concretas y accionables (una por brecha) "
            "para que la empresa subsane cada incumplimiento. "
            "Devuelve cada recomendación en una línea separada comenzando con el ID de la brecha."
        )
        lines = [line.strip() for line in result.splitlines() if line.strip()]
        return lines if lines else _fallback_recommendations(gaps)
    except Exception:
        return _fallback_recommendations(gaps)


def _fallback_recommendations(gaps: list[dict]) -> list[str]:
    return [
        f"{g['id']}: Implemente acciones para cumplir con '{g['text']}' según {g['reference']}."
        for g in gaps
    ]


def chat(
    score: float,
    gap_details: list[dict],
    company_name: str,
    company_sector: str,
    message: str,
    history: list[dict],
) -> str:
    level = "alto" if score >= 80 else "medio" if score >= 50 else "bajo"
    gaps_text = (
        "\n".join(f"  • {g['id']}: {g['text']} (Ref: {g['reference']})" for g in gap_details)
        if gap_details
        else "  No se identificaron brechas."
    )
    context = (
        f"Diagnóstico Ley 1581 del usuario:\n"
        f"  • Empresa: {company_name} (sector: {company_sector})\n"
        f"  • Puntaje: {score}/100 — nivel {level}\n"
        f"  • Brechas identificadas ({len(gap_details)}):\n{gaps_text}"
    )

    if history:
        conv = "\n\n".join(
            f"{'Asesor' if m['role'] == 'assistant' else 'Usuario'}: {m['content']}"
            for m in history
        )
        full_message = f"Conversación previa:\n{conv}\n\nNueva consulta: {message}"
    else:
        full_message = message

    try:
        return _run_agent(full_message, additional_instructions=context)
    except Exception as e:
        logger.error("Error en chat con agente: %s", e, exc_info=True)
        return (
            "Lo siento, no pude procesar tu consulta en este momento. "
            "Intenta de nuevo o consulta directamente la Ley 1581 de 2012."
        )


def chat_question(
    question_text: str,
    reference: str,
    category: str,
    mode: str,
    message: str,
    history: list[dict],
) -> str:
    """Interactive chat scoped to a single assessment question."""
    mode_hint = (
        "El usuario quiere entender qué significa esta pregunta y por qué es relevante."
        if mode == "explain"
        else "El usuario quiere saber cómo responder esta pregunta y qué evidencias necesita."
    )
    context = (
        f"El usuario está completando un diagnóstico de cumplimiento de la Ley 1581 de 2012.\n"
        f"Pregunta actual:\n"
        f"  • Categoría: {category}\n"
        f"  • Texto: {question_text}\n"
        f"  • Referencia normativa: {reference}\n\n"
        f"{mode_hint}\n"
        "Responde de forma concisa y práctica enfocándote en esta pregunta específica."
    )

    if history:
        conv = "\n\n".join(
            f"{'Asesor' if m['role'] == 'assistant' else 'Usuario'}: {m['content']}"
            for m in history
        )
        full_message = f"Conversación previa:\n{conv}\n\nNueva consulta: {message}"
    else:
        full_message = message

    try:
        return _run_agent(full_message, additional_instructions=context)
    except Exception as e:
        logger.error("Error en chat_question: %s", e, exc_info=True)
        return (
            "Lo siento, no pude procesar tu consulta. "
            "Intenta de nuevo o consulta directamente la Ley 1581 de 2012."
        )


def interpret_score(score: float, company_name: str) -> str:
    level = "alto" if score >= 80 else "medio" if score >= 50 else "bajo"
    try:
        return _run_agent(
            f"La empresa '{company_name}' obtuvo un puntaje de {score}/100 "
            f"en su autodiagnóstico de cumplimiento de la Ley 1581. "
            f"El nivel de cumplimiento es {level}. "
            "Proporciona una interpretación clara del resultado, sus implicaciones legales "
            "y los próximos pasos recomendados en un párrafo conciso."
        )
    except Exception:
        if score >= 80:
            return (
                f"{company_name} muestra un nivel de cumplimiento alto ({score}/100). "
                "Se recomienda mantener los controles actuales y realizar revisiones periódicas."
            )
        elif score >= 50:
            return (
                f"{company_name} muestra un nivel de cumplimiento medio ({score}/100). "
                "Existen brechas que deben subsanarse para evitar sanciones de la SIC."
            )
        return (
            f"{company_name} muestra un nivel de cumplimiento bajo ({score}/100). "
            "Se recomienda atención inmediata para evitar sanciones administrativas establecidas en la Ley 1581."
        )
