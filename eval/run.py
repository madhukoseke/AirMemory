from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.config import Settings
from app.memory import MemoryEngine


async def main() -> None:
    engine = MemoryEngine(Settings.from_env())
    result = await engine.evaluate()
    print(json.dumps(result.model_dump(), indent=2))
    print(f"wrote {Path(result.results_path).resolve()}")


if __name__ == "__main__":
    asyncio.run(main())

