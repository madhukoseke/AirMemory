from __future__ import annotations

import asyncio

import _bootstrap  # noqa: F401

from airmemory.cognee_layer.seed import seed_historical_incidents
from airmemory.processing.data import load_dag_metadata, load_historical_incidents
from airmemory.wiki.writer import write_initial_wiki


async def main() -> None:
    incidents = load_historical_incidents()
    await seed_historical_incidents(incidents)
    write_initial_wiki(incidents, dag_metadata=load_dag_metadata())
    print(f"Seeded {len(incidents)} historical incidents into AirMemory")
    print("Updated wiki/index.md")


if __name__ == "__main__":
    asyncio.run(main())
