from __future__ import annotations

import argparse
import asyncio
import json

from app.config import Settings
from app.memory import MemoryEngine


async def _run(command: str) -> None:
    engine = MemoryEngine(Settings.from_env())
    if command == "seed":
        result = await engine.seed()
    elif command == "eval":
        result = await engine.evaluate()
    else:
        raise ValueError(f"Unknown command: {command}")
    print(json.dumps(result.model_dump(), indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="AirMemory local commands")
    parser.add_argument("command", choices=["seed", "eval"])
    args = parser.parse_args()
    asyncio.run(_run(args.command))


if __name__ == "__main__":
    main()
