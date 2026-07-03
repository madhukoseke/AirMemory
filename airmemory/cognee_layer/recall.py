from __future__ import annotations

from airmemory.cognee_layer.client import import_cognee


async def recall_similar_incidents(query: str, dataset_name: str) -> str:
    cognee = import_cognee()
    if cognee is None:
        return (
            "Local Cognee fallback: deterministic AirMemory matching supplied the historical incident evidence. "
            "Install and configure Cognee to enable graph/vector recall."
        )

    try:
        if hasattr(cognee, "recall"):
            result = await cognee.recall(query, datasets=[dataset_name])
            return str(result)

        if hasattr(cognee, "search"):
            result = await cognee.search(query_text=query, datasets=[dataset_name])
            return str(result)
    except Exception:
        return (
            "Local Cognee fallback: Cognee recall was unavailable during this run, "
            "so deterministic AirMemory matching supplied the historical incident evidence."
        )

    return "Cognee package is installed, but no supported recall/search API was found."


def build_recall_query(incident) -> str:
    sources = ", ".join(incident.source_tables) or "unknown"
    targets = ", ".join(incident.target_tables) or "unknown"
    return f"""Have we seen Airflow failures similar to this?

DAG: {incident.dag_id}
Task: {incident.task_id}
Failure category: {incident.failure_category}
Error: {incident.raw_error}
Source tables: {sources}
Target tables: {targets}

Return prior incidents, confirmed root causes, accepted fixes, rejected fixes, and related runbooks.
"""
