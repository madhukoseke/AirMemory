from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from airmemory.models import AirflowFailureEvent


def build_event_from_airflow_context(context: dict[str, Any]) -> AirflowFailureEvent:
    task_instance = context.get("task_instance") or context.get("ti")
    dag = context.get("dag")
    dag_run = context.get("dag_run")
    task = context.get("task")
    exception = context.get("exception")

    dag_id = _get_attr(task_instance, "dag_id") or _get_attr(dag, "dag_id") or "unknown_dag"
    task_id = _get_attr(task_instance, "task_id") or _get_attr(task, "task_id") or "unknown_task"
    run_id = _get_attr(dag_run, "run_id") or str(context.get("run_id") or "manual__unknown")
    execution_date = _iso(context.get("logical_date") or context.get("execution_date") or _get_attr(dag_run, "logical_date"))
    try_number = int(_get_attr(task_instance, "try_number") or 1)
    owner = _get_attr(task, "owner") or _get_attr(dag, "owner")
    operator = task.__class__.__name__ if task is not None else None
    log_url = _get_attr(task_instance, "log_url")

    return AirflowFailureEvent(
        event_id=f"evt_{uuid.uuid4().hex[:8]}",
        event_type="task_failed",
        dag_id=dag_id,
        task_id=task_id,
        run_id=run_id,
        execution_date=execution_date,
        try_number=try_number,
        operator=operator,
        owner=owner,
        error_message=str(exception or "Airflow task failed"),
        log_url=log_url,
        source_system="airflow",
    )


def _get_attr(obj: Any, name: str) -> Any:
    return getattr(obj, name, None) if obj is not None else None


def _iso(value: Any) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
