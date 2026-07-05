from __future__ import annotations

"""MCP-shaped tool module for external assistant integrations."""

import asyncio
from typing import Any

from app.config import Settings
from app.memory import MemoryEngine
from app.runtime import (
    emit_demo_failure,
    fetch_runtime_incident,
    list_runtime_incidents,
    process_next_failure,
    runtime_summary,
)
from app.schema import RecallRequest


engine = MemoryEngine(Settings.from_env())

TOOLS: dict[str, str] = {
    "airmemory_recall": "Recall operational memory for an Airflow incident question.",
    "airmemory_improve": "Record engineer feedback and re-rank an accepted resolution.",
    "airmemory_forget": "Forget a deprecated workaround from retrieval.",
    "airmemory_runtime_summary": "Summarize the live worker queue and latest processed incident.",
    "airmemory_runtime_emit": "Emit a demo Airflow failure into the runtime queue.",
    "airmemory_runtime_process": "Process one pending runtime failure event.",
    "airmemory_runtime_get": "Fetch one processed runtime incident by id.",
}


def _run(coro: Any) -> dict[str, object]:
    return asyncio.run(coro)


def airmemory_recall(question: str) -> dict[str, object]:
    async def run() -> dict[str, object]:
        response = await engine.recall(RecallRequest(question=question))
        return response.model_dump()

    return _run(run())


def airmemory_improve(incident_id: str, feedback: str, accepted_resolution: str = "res-window-3-day") -> dict[str, object]:
    async def run() -> dict[str, object]:
        response = await engine.improve(
            incident_id=incident_id,
            feedback=feedback,
            accepted_resolution=accepted_resolution,
            feedback_alpha=0.7,
        )
        return response.model_dump()

    return _run(run())


def airmemory_forget(reason: str, resolution_id: str = "res-full-dag-clear") -> dict[str, object]:
    async def run() -> dict[str, object]:
        response = await engine.forget(
            target_dataset=Settings.from_env().deprecated_dataset_name,
            resolution_id=resolution_id,
            reason=reason,
        )
        return response.model_dump()

    return _run(run())


def airmemory_runtime_summary() -> dict[str, object]:
    return runtime_summary()


def airmemory_runtime_emit() -> dict[str, object]:
    return emit_demo_failure()


def airmemory_runtime_process() -> dict[str, object]:
    result = _run(process_next_failure())
    return {"processed": result is not None, "result": result}


def airmemory_runtime_get(incident_id: str) -> dict[str, object]:
    result = fetch_runtime_incident(incident_id)
    if result is None:
        return {"found": False, "incident_id": incident_id}
    return {"found": True, "incident_id": incident_id, "result": result}


def airmemory_runtime_list() -> dict[str, object]:
    return {"incident_ids": list_runtime_incidents()}
