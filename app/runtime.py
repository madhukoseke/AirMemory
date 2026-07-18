from __future__ import annotations

from typing import Any

from airmemory.config import settings
from airmemory.ingestion.demo_emitters import build_demo_failure_event
from airmemory.ingestion.log_parser import build_event_from_log
from airmemory.processing.incident_pipeline import process_failure_event
from airmemory.processing.worker import format_worker_result, run_worker_once
from airmemory.redis_client import RedisClient


def list_runtime_incidents() -> list[str]:
    return RedisClient().latest_incident_ids()


def fetch_runtime_incident(incident_id: str) -> dict[str, Any] | None:
    return RedisClient().fetch_result(incident_id)


def emit_demo_failure() -> dict[str, str]:
    event = build_demo_failure_event()
    message_id = RedisClient().publish_failure_event(event.model_dump(mode="json"))
    return {
        "message_id": message_id,
        "dag_id": event.dag_id,
        "task_id": event.task_id,
        "incident_id": event.incident_id or "",
    }


async def process_next_failure() -> dict[str, Any] | None:
    result = await run_worker_once(block_ms=500)
    if result is None:
        return None
    return result.model_dump(mode="json")


async def analyze_log_text(
    log_text: str,
    *,
    dag_id: str | None = None,
    task_id: str | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    """Parse a pasted/uploaded Airflow log and run the incident pipeline immediately."""
    event, parsed = build_event_from_log(
        log_text,
        dag_id=dag_id,
        task_id=task_id,
        run_id=run_id,
    )
    result = await process_failure_event(event)
    payload = result.model_dump(mode="json")
    RedisClient().save_result(result.incident.incident_id, payload)
    return {
        "processed": True,
        "parsed": parsed,
        "result": payload,
        "formatted": format_worker_result(result),
    }


def runtime_summary() -> dict[str, Any]:
    incident_ids = list_runtime_incidents()
    latest = fetch_runtime_incident(incident_ids[0]) if incident_ids else None
    return {
        "queue_mode": "local" if RedisClient().local_mode else "redis",
        "wiki_dir": str(settings.wiki_dir),
        "state_dir": str(settings.state_dir),
        "incident_count": len(incident_ids),
        "latest_incident_id": incident_ids[0] if incident_ids else None,
        "latest_summary": latest.get("advice", {}).get("summary") if latest else None,
    }


def format_runtime_process_output(result: dict[str, Any] | None) -> str:
    if result is None:
        return format_worker_result(None)
    from airmemory.models import ProcessedIncidentResult

    return format_worker_result(ProcessedIncidentResult.model_validate(result))
