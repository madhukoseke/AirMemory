from __future__ import annotations

import re

from airmemory.models import HistoricalIncident, NormalizedIncident, SimilarIncidentMatch


def find_similar_incidents(
    current: NormalizedIncident,
    historical: list[HistoricalIncident],
    top_k: int = 3,
) -> list[SimilarIncidentMatch]:
    matches = [_score_match(current, incident) for incident in historical]
    matches.sort(key=lambda item: (-item.similarity_score, item.incident_id))
    positive_matches = [match for match in matches if match.similarity_score > 0]
    return (positive_matches or matches)[:top_k]


def _score_match(current: NormalizedIncident, historical: HistoricalIncident) -> SimilarIncidentMatch:
    points = 0
    reasons: list[str] = []

    if current.failure_category == historical.failure_category:
        points += 40
        reasons.append("same failure category")
    if current.dag_id == historical.dag_id:
        points += 25
        reasons.append("same DAG")
    if current.task_id == historical.task_id:
        points += 15
        reasons.append("same task")

    shared_sources = sorted(set(_lower_list(current.source_tables)) & set(_lower_list(historical.source_tables)))
    if shared_sources:
        points += 10
        reasons.append(f"same source table {shared_sources[0]}")

    overlap = _keyword_overlap(current.normalized_error, historical.normalized_error)
    if overlap:
        points += 10
        reasons.append("overlapping normalized error keywords")

    reason = "No strong deterministic match."
    if reasons:
        joined = ", ".join(reasons)
        reason = joined[:1].upper() + joined[1:] + "."

    return SimilarIncidentMatch(
        incident_id=historical.incident_id,
        similarity_score=round(min(points / 100, 1.0), 2),
        reason=reason,
        historical_incident=historical,
    )


def _lower_list(items: list[str]) -> list[str]:
    return [item.strip().lower() for item in items if item.strip()]


def _keyword_overlap(left: str, right: str) -> bool:
    left_tokens = _tokens(left)
    right_tokens = _tokens(right)
    important = left_tokens & right_tokens - {"in", "the", "and", "or", "a", "an", "to", "from"}
    return len(important) >= 2


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_.]+", text.lower()))
