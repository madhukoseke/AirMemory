from __future__ import annotations

from airmemory.cognee_layer.client import import_cognee


async def improve_memory(dataset_name: str) -> str | None:
    cognee = import_cognee()
    if cognee is None or not hasattr(cognee, "improve"):
        return None
    return str(await cognee.improve(datasets=[dataset_name]))
