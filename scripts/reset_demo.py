from __future__ import annotations

import asyncio

import _bootstrap  # noqa: F401

from airmemory.cognee_layer.reset import reset_memory
from airmemory.config import settings
from airmemory.redis_client import RedisClient


GENERATED_WIKI_DIRS = ["incidents", "dags", "failure-patterns", "runbooks"]


async def main() -> None:
    print("Resetting AirMemory demo...")
    settings.ensure_directories()
    RedisClient().reset_demo_state()

    for dirname in GENERATED_WIKI_DIRS:
        directory = settings.wiki_dir / dirname
        directory.mkdir(parents=True, exist_ok=True)
        for path in directory.glob("*.md"):
            path.unlink()

    (settings.wiki_dir / "index.md").write_text(
        "# AirMemory Wiki\n\nDemo reset complete. Run seed script to populate memory.\n",
        encoding="utf-8",
    )
    (settings.wiki_dir / "log.md").write_text("# AirMemory Log\n", encoding="utf-8")
    reset_status = await reset_memory()
    print(reset_status)
    print("Reset complete.")


if __name__ == "__main__":
    asyncio.run(main())
