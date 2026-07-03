from __future__ import annotations

import argparse
import asyncio

import _bootstrap  # noqa: F401

from airmemory.processing.worker import format_worker_result, run_worker_forever, run_worker_once


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AirMemory event worker.")
    parser.add_argument("--once", action="store_true", help="Process at most one pending failure event.")
    args = parser.parse_args()

    if args.once:
        result = await run_worker_once()
        print(format_worker_result(result))
        return

    await run_worker_forever()


if __name__ == "__main__":
    asyncio.run(main())
