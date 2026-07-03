from __future__ import annotations

import _bootstrap  # noqa: F401

from airmemory.ingestion.demo_emitters import build_demo_failure_event
from airmemory.redis_client import RedisClient


def main() -> None:
    event = build_demo_failure_event()
    message_id = RedisClient().publish_failure_event(event.model_dump(mode="json"))
    print("Published demo failure event")
    print(f"Message ID: {message_id}")


if __name__ == "__main__":
    main()
