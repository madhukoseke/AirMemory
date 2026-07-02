from __future__ import annotations

from app.memory import MemoryEngine
from app.schema import ImproveRequest, ImproveResponse


async def improve_memory(engine: MemoryEngine, request: ImproveRequest) -> ImproveResponse:
    return await engine.improve(
        incident_id=request.incident_id,
        feedback=request.feedback,
        accepted_resolution=request.accepted_resolution,
        feedback_alpha=request.feedback_alpha,
    )

