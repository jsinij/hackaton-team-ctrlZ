from typing import Any

# P1 is a gate: if answered "no", children P2-P5 are automatically scored 0.
# P11 is complementary: shown to user but not counted in the score.
# Weights sum to 100 for scoreable questions (P2-P10).

QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "P1",
        "category": "politica",
        "weight": 0,
        "is_gate": True,
        "gate_children": ["P2", "P3", "P4", "P5"],
        "text": "¿Cuenta con una política de tratamiento de datos personales?",
        "reference": "Art. 13 Ley 1581 de 2012",
    },
    {
        "id": "P2",
        "category": "politica",
        "weight": 10,
        "text": "¿La política está documentada y publicada en medio de fácil acceso?",
        "reference": "Art. 15 Ley 1581 de 2012",
    },
    {
        "id": "P3",
        "category": "politica",
        "weight": 10,
        "text": "¿La política define las finalidades del tratamiento de datos?",
        "reference": "Art. 13 literal a Ley 1581 de 2012",
    },
    {
        "id": "P4",
        "category": "politica",
        "weight": 10,
        "text": "¿La política incluye los derechos de los titulares?",
        "reference": "Art. 8 Ley 1581 de 2012",
    },
    {
        "id": "P5",
        "category": "politica",
        "weight": 10,
        "text": "¿La política menciona cómo ejercer los derechos de los titulares?",
        "reference": "Art. 8 y 15 Ley 1581 de 2012",
    },
    {
        "id": "P6",
        "category": "diseno",
        "weight": 12,
        "text": "¿Incorpora evaluaciones de impacto (Privacy Impact Assessments)?",
        "reference": "Principio de responsabilidad demostrada Ley 1581",
    },
    {
        "id": "P7",
        "category": "diseno",
        "weight": 12,
        "text": "¿Aplica técnicas de minimización de datos?",
        "reference": "Principio de finalidad Art. 4 Ley 1581 de 2012",
    },
    {
        "id": "P8",
        "category": "diseno",
        "weight": 12,
        "text": "¿Configura sus sistemas para recopilar el mínimo de datos por defecto?",
        "reference": "Principio de necesidad Art. 4 Ley 1581 de 2012",
    },
    {
        "id": "P9",
        "category": "gobernanza",
        "weight": 16,
        "text": "¿Cuenta con un sistema de administración de riesgos?",
        "reference": "Art. 17 literal k Ley 1581 de 2012",
    },
    {
        "id": "P10",
        "category": "gobernanza",
        "weight": 8,
        "text": "¿Cuenta con un oficial de protección de datos personales?",
        "reference": "Art. 17 literal h Ley 1581 de 2012",
    },
    {
        "id": "P11",
        "category": "gobernanza",
        "weight": 0,
        "complementary": True,
        "text": "¿El oficial de protección de datos está designado formalmente?",
        "reference": "Art. 17 literal h Ley 1581 de 2012",
    },
]

QUESTIONS_BY_ID: dict[str, dict[str, Any]] = {q["id"]: q for q in QUESTIONS}

# Questions that actually count toward the score
_SCOREABLE = [q for q in QUESTIONS if q["weight"] > 0]
_TOTAL_WEIGHT = sum(q["weight"] for q in _SCOREABLE)  # = 100


def calculate_score(answers: dict[str, str]) -> tuple[float, list[str]]:
    working = dict(answers)

    # Gate logic: P1 = "no" → auto-fail P2-P5
    p1 = working.get("P1")
    if p1 == "no":
        for child_id in ("P2", "P3", "P4", "P5"):
            working[child_id] = "no"

    earned = 0.0
    gaps: list[str] = []

    for q in _SCOREABLE:
        ans = working.get(q["id"])
        if ans == "si":
            earned += q["weight"]
        elif ans in ("no", "parcial", None):
            gaps.append(q["id"])
            if ans == "parcial":
                earned += q["weight"] * 0.5

    score = round((earned / _TOTAL_WEIGHT) * 100, 2)
    return score, gaps
