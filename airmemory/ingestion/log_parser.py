from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from airmemory.models import AirflowFailureEvent

_DAG_RE = re.compile(
    r"(?:dag_id|Dag\s*Id|DAG)\s*[=:]\s*['\"]?([A-Za-z0-9_.-]+)",
    re.IGNORECASE,
)
_TASK_RE = re.compile(
    r"(?:task_id|Task\s*Id|Task)\s*[=:]\s*['\"]?([A-Za-z0-9_.-]+)",
    re.IGNORECASE,
)
_RUN_RE = re.compile(
    r"(?:run_id|Run\s*Id|execution_date)\s*[=:]\s*['\"]?([A-Za-z0-9_.:T+-]+)",
    re.IGNORECASE,
)
_TABLE_RE = re.compile(
    r"\b((?:raw|stg|mart|api|sftp|hana|bq(?:\.prod)?)\.[A-Za-z0-9_.]+)\b",
    re.IGNORECASE,
)
_SOURCE_TABLE_RE = re.compile(
    r"(?:source_table|source)\s*[=:]\s*['\"]?([A-Za-z0-9_.]+)",
    re.IGNORECASE,
)
_TARGET_TABLE_RE = re.compile(
    r"(?:target_table|target)\s*[=:]\s*['\"]?([A-Za-z0-9_.]+)",
    re.IGNORECASE,
)
_ISO_TS_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2})?)\b")
_ERROR_LINE_RE = re.compile(
    r"(?i)^\s*(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\S*\s+)?(?:ERROR|CRITICAL|Exception|Traceback|FAILED)\b.*"
)
_EXCEPTION_RE = re.compile(
    r"(?m)^(?:[A-Za-z_][\w.]*(?:Error|Exception|NotFound|Timeout|Failed)|google\.api_core\.exceptions\.\w+):[^\n]+"
)
_ERROR_KEYWORD_RE = re.compile(
    r"(?i)\b(?:error_type|ROW_COUNT_MISMATCH|partition\s+\S+\s+not found|timed?\s*out|schema|credential|duplicate|null value)\b"
)


def parse_airflow_log(
    log_text: str,
    *,
    dag_id: str | None = None,
    task_id: str | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    """Extract failure fields from pasted/uploaded Airflow log text."""
    text = log_text.strip()
    if not text:
        raise ValueError("log_text is empty")

    parsed_dag = dag_id or _first_match(_DAG_RE, text) or "unknown_dag"
    parsed_task = task_id or _first_match(_TASK_RE, text) or "unknown_task"
    parsed_run = run_id or _first_match(_RUN_RE, text)

    timestamps = _ISO_TS_RE.findall(text)
    execution_date = timestamps[0] if timestamps else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if not parsed_run:
        date_part = execution_date[:10]
        parsed_run = f"manual__{date_part}"

    error_message = _extract_error_message(text)
    stack_trace = _extract_stack_trace(text)

    source_tables: list[str] = []
    target_tables: list[str] = []
    source_hit = _first_match(_SOURCE_TABLE_RE, text)
    target_hit = _first_match(_TARGET_TABLE_RE, text)
    if source_hit:
        source_tables.append(source_hit)
    if target_hit:
        target_tables.append(target_hit)
    for table in _TABLE_RE.findall(text):
        normalized = table.lower()
        if normalized in {t.lower() for t in source_tables + target_tables}:
            continue
        if not source_tables:
            source_tables.append(normalized)
        elif not target_tables:
            target_tables.append(normalized)

    return {
        "dag_id": parsed_dag,
        "task_id": parsed_task,
        "run_id": parsed_run,
        "execution_date": execution_date,
        "error_message": error_message,
        "stack_trace": stack_trace,
        "source_tables": source_tables,
        "target_tables": target_tables,
        "log_chars": len(text),
        "log_preview": text[:400],
    }


def build_event_from_log(
    log_text: str,
    *,
    dag_id: str | None = None,
    task_id: str | None = None,
    run_id: str | None = None,
) -> tuple[AirflowFailureEvent, dict[str, Any]]:
    parsed = parse_airflow_log(
        log_text,
        dag_id=dag_id,
        task_id=task_id,
        run_id=run_id,
    )
    event = AirflowFailureEvent(
        event_id=f"evt_{uuid.uuid4().hex[:8]}",
        event_type="task_failed",
        dag_id=parsed["dag_id"],
        task_id=parsed["task_id"],
        run_id=parsed["run_id"],
        execution_date=parsed["execution_date"],
        try_number=1,
        error_message=parsed["error_message"],
        stack_trace=parsed["stack_trace"],
        source_tables=parsed["source_tables"],
        target_tables=parsed["target_tables"],
        source_system="manual_log",
        created_at=datetime.now(timezone.utc),
    )
    return event, parsed


def _first_match(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    return match.group(1).strip() if match else None


def _extract_error_message(text: str) -> str:
    exception = _EXCEPTION_RE.search(text)
    if exception:
        return " ".join(exception.group(0).split())

    error_lines = [line.strip() for line in text.splitlines() if _ERROR_LINE_RE.match(line)]
    if error_lines:
        # Prefer densest ERROR line (error_type / counts / known failure keywords).
        ranked = sorted(
            error_lines,
            key=lambda line: (
                bool(_ERROR_KEYWORD_RE.search(line)),
                "error_type=" in line.lower(),
                len(line),
            ),
            reverse=True,
        )
        return " ".join(ranked[0].split())

    keyword_lines = [line.strip() for line in text.splitlines() if _ERROR_KEYWORD_RE.search(line)]
    if keyword_lines:
        return " ".join(sorted(keyword_lines, key=len, reverse=True)[0].split())

    # Fallback: last non-empty line, truncated.
    for line in reversed(text.splitlines()):
        cleaned = " ".join(line.split())
        if cleaned:
            return cleaned[:500]
    return text[:500]


def _extract_stack_trace(text: str) -> str | None:
    if "Traceback (most recent call last)" not in text:
        exception = _EXCEPTION_RE.search(text)
        return exception.group(0).strip() if exception else None

    start = text.rfind("Traceback (most recent call last)")
    chunk = text[start : start + 2500]
    return chunk.strip() or None
