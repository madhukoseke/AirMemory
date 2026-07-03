from __future__ import annotations

import re

from airmemory.models import AirflowFailureEvent, DagMetadata, NormalizedIncident
from airmemory.processing.categorizer import categorize_failure
from airmemory.processing.fingerprint import build_fingerprint


_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
_TABLE_RE = re.compile(r"\b(?:raw|stg|mart|api|sftp)\.[A-Za-z0-9_]+")


def normalize_error_text(error_message: str, failure_category: str, source_tables: list[str]) -> str:
    msg = " ".join(error_message.strip().split())
    lower = _DATE_RE.sub("", msg.lower())
    lower = " ".join(lower.split())
    primary_source = source_tables[0].lower() if source_tables else _extract_table(lower)

    if failure_category == "missing_partition":
        return f"partition not found in {primary_source}" if primary_source else "partition not found"
    if failure_category == "row_count_mismatch":
        return "row count mismatch between source and target"
    if failure_category == "schema_drift":
        return "column type changed in source file"
    if failure_category == "api_timeout":
        return "external api timeout"
    if failure_category == "duplicate_records":
        return "duplicate business key detected"
    if failure_category == "null_value_spike":
        return "null value spike in required field"
    if failure_category == "credential_expired":
        return "credential expired for external connection"
    if failure_category == "late_source_data":
        return "source table freshness check failed"
    return lower


def generate_incident_id(execution_date: str, dag_id: str, task_id: str, failure_category: str) -> str:
    date_part = execution_date[:10] if execution_date else "unknown_date"
    date_part = re.sub(r"[^0-9]+", "_", date_part).strip("_")
    raw = f"inc_{date_part}_{dag_id}_{task_id}_{failure_category}"
    return re.sub(r"[^A-Za-z0-9_]+", "_", raw).strip("_").lower()


def normalize_event(
    event: AirflowFailureEvent,
    dag_metadata: dict[str, DagMetadata],
) -> NormalizedIncident:
    metadata = dag_metadata.get(event.dag_id)
    source_tables = event.source_tables or (metadata.source_tables if metadata else [])
    target_tables = event.target_tables or (metadata.target_tables if metadata else [])
    owner = event.owner or (metadata.owner if metadata else None)
    failure_category = categorize_failure(event.error_message)
    normalized_error = normalize_error_text(event.error_message, failure_category, source_tables)
    incident_id = event.incident_id or generate_incident_id(
        event.execution_date,
        event.dag_id,
        event.task_id,
        failure_category,
    )

    return NormalizedIncident(
        incident_id=incident_id,
        event_id=event.event_id,
        dag_id=event.dag_id,
        task_id=event.task_id,
        run_id=event.run_id,
        execution_date=event.execution_date,
        owner=owner,
        failure_category=failure_category,
        failure_fingerprint=build_fingerprint(
            failure_category=failure_category,
            dag_id=event.dag_id,
            task_id=event.task_id,
            source_tables=source_tables,
            normalized_error=normalized_error,
        ),
        normalized_error=normalized_error,
        raw_error=event.error_message,
        source_tables=source_tables,
        target_tables=target_tables,
        severity="high" if metadata and metadata.criticality == "high" else "medium",
    )


def _extract_table(text: str) -> str:
    match = _TABLE_RE.search(text)
    return match.group(0).lower() if match else ""
