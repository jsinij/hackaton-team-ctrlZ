from typing import Any

QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "P1",
        "category": "politica",
        "weight": 10,
        "text": "¿Tiene la empresa una política de tratamiento de datos personales documentada y aprobada?",
        "reference": "Art. 13 Ley 1581",
    },
    {
        "id": "P2",
        "category": "politica",
        "weight": 10,
        "text": "¿La política de tratamiento de datos está publicada y es accesible para los titulares?",
        "reference": "Art. 15 Ley 1581",
    },
    {
        "id": "P3",
        "category": "politica",
        "weight": 10,
        "text": "¿Se ha registrado la base de datos ante la SIC (Superintendencia de Industria y Comercio)?",
        "reference": "Decreto 1377/2013",
    },
    {
        "id": "P4",
        "category": "diseno",
        "weight": 12,
        "text": "¿Los sistemas de información incorporan controles de privacidad desde su diseño?",
        "reference": "Principio de seguridad Ley 1581",
    },
    {
        "id": "P5",
        "category": "diseno",
        "weight": 12,
        "text": "¿Se realiza análisis de impacto de privacidad (DPIA) antes de implementar nuevos procesos que traten datos?",
        "reference": "Principio de limitación del uso",
    },
    {
        "id": "P6",
        "category": "diseno",
        "weight": 11,
        "text": "¿Existen mecanismos técnicos para garantizar la seguridad de los datos personales (cifrado, control de acceso)?",
        "reference": "Art. 17 literal d Ley 1581",
    },
    {
        "id": "P7",
        "category": "gobernanza",
        "weight": 12,
        "text": "¿Existe un responsable designado del tratamiento de datos personales dentro de la organización?",
        "reference": "Art. 17 Ley 1581",
    },
    {
        "id": "P8",
        "category": "gobernanza",
        "weight": 12,
        "text": "¿El personal que trata datos personales ha recibido capacitación sobre la Ley 1581?",
        "reference": "Principio de responsabilidad demostrada",
    },
    {
        "id": "P9",
        "category": "gobernanza",
        "weight": 11,
        "text": "¿Existe un procedimiento para atender solicitudes de los titulares (acceso, corrección, supresión)?",
        "reference": "Art. 8 Ley 1581",
    },
]

QUESTIONS_BY_ID: dict[str, dict[str, Any]] = {q["id"]: q for q in QUESTIONS}


def calculate_score(answers: dict[str, str]) -> tuple[float, list[str]]:
    total_weight = sum(q["weight"] for q in QUESTIONS)
    earned = 0.0
    gaps: list[str] = []

    for q in QUESTIONS:
        ans = answers.get(q["id"])
        if ans == "si":
            earned += q["weight"]
        elif ans in ("no", "parcial"):
            gaps.append(q["id"])
            if ans == "parcial":
                earned += q["weight"] * 0.5

    return round((earned / total_weight) * 100, 2), gaps
