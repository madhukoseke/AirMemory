from __future__ import annotations

from app.memory import MemoryEngine
from app.schema import RecallRequest, RecallResponse


async def recall_memory(engine: MemoryEngine, request: RecallRequest) -> RecallResponse:
    return await engine.recall(request)

