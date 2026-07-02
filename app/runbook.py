from __future__ import annotations

from app.memory import MemoryEngine
from app.schema import RunbookRequest, RunbookResponse


async def generate_runbook(engine: MemoryEngine, request: RunbookRequest) -> RunbookResponse:
    return await engine.runbook(
        dag_id=request.dag_id,
        task_id=request.task_id,
        failure_summary=request.failure_summary,
    )

