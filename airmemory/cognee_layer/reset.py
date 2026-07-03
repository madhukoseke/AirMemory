from __future__ import annotations

import asyncio

from airmemory.cognee_layer.client import import_cognee, local_memory_dir
from airmemory.config import settings


async def reset_memory(dataset_name: str = settings.cognee_dataset) -> str:
    cognee = import_cognee()
    local_dir = local_memory_dir(dataset_name)
    for path in local_dir.glob("*.md"):
        path.unlink()

    if cognee is None:
        return "Reset local Cognee fallback memory"

    if hasattr(cognee, "forget"):
        try:
            result = await cognee.forget(dataset=dataset_name)
            return str(result)
        except TypeError:
            pass

    prune = getattr(cognee, "prune", None)
    if prune is not None:
        if hasattr(prune, "prune_data"):
            await prune.prune_data()
        if hasattr(prune, "prune_system"):
            await prune.prune_system(metadata=True)
        return "Pruned Cognee data"

    return "No supported Cognee reset API found"


def main() -> None:
    print(asyncio.run(reset_memory()))


if __name__ == "__main__":
    main()
