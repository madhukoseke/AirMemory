from __future__ import annotations

from typing import Any


def incident_rows(result: dict[str, Any]) -> list[dict[str, Any]]:
    similar = result.get("similar_incidents", [])
    rows = []
    for match in similar:
        historical = match.get("historical_incident", {})
        rows.append(
            {
                "Score": match.get("similarity_score"),
                "Date": historical.get("date"),
                "DAG": historical.get("dag_id"),
                "Task": historical.get("task_id"),
                "Root Cause": historical.get("root_cause"),
                "Accepted Fix": historical.get("accepted_fix"),
            }
        )
    return rows


def result_summary(result: dict[str, Any]) -> dict[str, Any]:
    incident = result.get("incident", {})
    advice = result.get("advice", {})
    return {
        "DAG": incident.get("dag_id"),
        "Task": incident.get("task_id"),
        "Failure Category": incident.get("failure_category"),
        "Status": incident.get("status"),
        "Owner": incident.get("owner"),
        "Confidence": advice.get("confidence"),
        "Raw Error": incident.get("raw_error"),
    }
