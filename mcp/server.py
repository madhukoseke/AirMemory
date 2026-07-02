from __future__ import annotations

"""Minimal MCP-shaped tool module for external assistant integrations."""

import asyncio

from app.config import Settings
from app.memory import MemoryEngine
from app.schema import RecallRequest


engine = MemoryEngine(Settings.from_env())


def airmemory_recall(question: str) -> dict[str, object]:
    async def run() -> dict[str, object]:
        response = await engine.recall(RecallRequest(question=question))
        return response.model_dump()

    return asyncio.run(run())


def airmemory_remember_resolution(incident_id: str, fix: str) -> dict[str, object]:
    async def run() -> dict[str, object]:
        response = await engine.improve(
            incident_id=incident_id,
            feedback=f"Confirmed fix: {fix}",
            accepted_resolution="res-window-3-day",
            feedback_alpha=0.7,
        )
        return response.model_dump()

    return asyncio.run(run())
