from __future__ import annotations

from app.memory import MemoryEngine
from app.schema import ForgetRequest, ForgetResponse


async def forget_memory(engine: MemoryEngine, request: ForgetRequest) -> ForgetResponse:
    return await engine.forget(
        target_dataset=request.target_dataset,
        resolution_id=request.resolution_id,
        reason=request.reason,
    )

