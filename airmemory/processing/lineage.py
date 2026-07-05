from __future__ import annotations

from airmemory.models import HistoricalIncident, NormalizedIncident, SimilarIncidentMatch
from airmemory.processing.data import load_lineage


def trace_upstream_tables(
    table: str,
    lineage: dict[str, dict[str, object]] | None = None,
    *,
    max_depth: int = 5,
) -> list[str]:
    registry = lineage if lineage is not None else load_lineage()
    normalized = table.strip().lower()
    if not normalized:
        return []

    visited: list[str] = []
    queue = [normalized]
    seen = {normalized}

    while queue and len(visited) < max_depth:
        current = queue.pop(0)
        visited.append(current)
        upstream = registry.get(current, {}).get("upstream_tables", [])
        if not isinstance(upstream, list):
            continue
        for item in upstream:
            name = str(item).strip().lower()
            if name and name not in seen:
                seen.add(name)
                queue.append(name)
    return visited


def find_lineage_incident_matches(
    current: NormalizedIncident,
    historical: list[HistoricalIncident],
    lineage: dict[str, dict[str, object]] | None = None,
    *,
    top_k: int = 3,
) -> list[SimilarIncidentMatch]:
    registry = lineage if lineage is not None else load_lineage()
    candidate_tables: set[str] = set()

    for table in [*current.source_tables, *current.target_tables]:
        candidate_tables.update(trace_upstream_tables(table, registry))

    if not candidate_tables:
        return []

    matches: list[SimilarIncidentMatch] = []
    for incident in historical:
        incident_tables = {item.strip().lower() for item in [*incident.source_tables, *incident.target_tables]}
        overlap = sorted(candidate_tables & incident_tables)
        if not overlap:
            downstream_dags = set()
            for table_name in candidate_tables:
                entry = registry.get(table_name, {})
                downstream = entry.get("downstream_dags", [])
                if isinstance(downstream, list):
                    downstream_dags.update(str(item) for item in downstream)
            if current.dag_id not in downstream_dags and incident.dag_id not in downstream_dags:
                continue
            reason = f"lineage-linked DAG {incident.dag_id}"
            score = 0.45
        else:
            reason = f"upstream lineage overlap at {overlap[0]}"
            score = 0.55 + min(0.2, 0.05 * len(overlap))

        matches.append(
            SimilarIncidentMatch(
                incident_id=incident.incident_id,
                similarity_score=round(min(score, 0.85), 2),
                reason=reason[:1].upper() + reason[1:] + ".",
                historical_incident=incident,
            )
        )

    matches.sort(key=lambda item: (-item.similarity_score, item.incident_id))
    return matches[:top_k]


def merge_similarity_matches(
    deterministic: list[SimilarIncidentMatch],
    lineage_matches: list[SimilarIncidentMatch],
    *,
    top_k: int = 3,
) -> list[SimilarIncidentMatch]:
    merged: dict[str, SimilarIncidentMatch] = {}
    for match in deterministic + lineage_matches:
        existing = merged.get(match.incident_id)
        if existing is None or match.similarity_score > existing.similarity_score:
            merged[match.incident_id] = match
    ordered = sorted(merged.values(), key=lambda item: (-item.similarity_score, item.incident_id))
    return ordered[:top_k]
