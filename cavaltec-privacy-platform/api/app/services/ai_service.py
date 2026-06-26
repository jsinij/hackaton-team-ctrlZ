from openai import AzureOpenAI
from app.core.config import settings

SYSTEM_PROMPT = (
    "Eres un experto en Ley 1581 de 2012 de Colombia (protección de datos personales). "
    "Responde siempre en español claro y sencillo, sin tecnicismos innecesarios. "
    "Nunca inventes artículos de ley ni referencias normativas. "
    "Basa tus respuestas únicamente en el contexto proporcionado y en la Ley 1581, "
    "el Decreto 1377 de 2013 y los principios de la SIC."
)


def _get_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=settings.azure_foundry_endpoint,
        api_key=settings.azure_foundry_api_key,
        api_version=settings.azure_foundry_api_version,
    )


def _chat(messages: list[dict]) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.azure_foundry_model,
        messages=messages,
        max_tokens=512,
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


def explain_question(question_text: str, reference: str) -> str:
    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Explica en lenguaje sencillo qué significa el siguiente requisito de la Ley 1581 "
                    f"y por qué es importante para una empresa colombiana:\n\n"
                    f"Requisito: {question_text}\n"
                    f"Referencia normativa: {reference}"
                ),
            },
        ]
        return _chat(messages)
    except Exception:
        return (
            f"Este requisito evalúa el cumplimiento de: {reference}. "
            "Consulte la Ley 1581 de 2012 y el Decreto 1377 de 2013 para más detalles."
        )


def answer_guidance(question_text: str, reference: str) -> str:
    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Para la siguiente pregunta de autodiagnóstico de cumplimiento de la Ley 1581, "
                    f"explica cómo debe responder una empresa y qué evidencias debe tener para responder 'Sí':\n\n"
                    f"Pregunta: {question_text}\n"
                    f"Referencia normativa: {reference}"
                ),
            },
        ]
        return _chat(messages)
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
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Una empresa colombiana tiene las siguientes brechas de cumplimiento con la Ley 1581:\n\n"
                    f"{gap_list}\n\n"
                    "Genera una lista de recomendaciones concretas y accionables (una por brecha) "
                    "para que la empresa subsane cada incumplimiento. "
                    "Devuelve cada recomendación en una línea separada comenzando con el ID de la brecha."
                ),
            },
        ]
        result = _chat(messages)
        lines = [line.strip() for line in result.splitlines() if line.strip()]
        return lines if lines else _fallback_recommendations(gaps)
    except Exception:
        return _fallback_recommendations(gaps)


def _fallback_recommendations(gaps: list[dict]) -> list[str]:
    recs = []
    for g in gaps:
        recs.append(
            f"{g['id']}: Implemente acciones para cumplir con '{g['text']}' "
            f"según {g['reference']}."
        )
    return recs


def interpret_score(score: float, company_name: str) -> str:
    try:
        if score >= 80:
            level = "alto"
        elif score >= 50:
            level = "medio"
        else:
            level = "bajo"

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"La empresa '{company_name}' obtuvo un puntaje de {score}/100 "
                    f"en su autodiagnóstico de cumplimiento de la Ley 1581. "
                    f"El nivel de cumplimiento es {level}. "
                    "Proporciona una interpretación clara del resultado, sus implicaciones legales "
                    "y los próximos pasos recomendados en un párrafo conciso."
                ),
            },
        ]
        return _chat(messages)
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
