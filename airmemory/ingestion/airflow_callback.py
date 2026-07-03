from __future__ import annotations

from typing import Any

from airmemory.ingestion.event_schema import build_event_from_airflow_context
from airmemory.redis_client import RedisClient


def airmemory_failure_callback(context: dict[str, Any]) -> None:
    event = build_event_from_airflow_context(context)
    RedisClient().publish_failure_event(event.model_dump(mode="json"))
