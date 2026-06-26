from typing import Any
from app.utils.questions import calculate_score, QUESTIONS, QUESTIONS_BY_ID


def compute_score(answers: dict[str, str]) -> tuple[float, list[str]]:
    return calculate_score(answers)


def get_gap_details(gap_ids: list[str]) -> list[dict[str, Any]]:
    details = []
    for qid in gap_ids:
        question = QUESTIONS_BY_ID.get(qid)
        if question:
            details.append(question)
    return details


def get_all_questions() -> list[dict[str, Any]]:
    return QUESTIONS
