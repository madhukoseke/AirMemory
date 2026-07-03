from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from airmemory.config import Settings, settings


class RedisClient:
    def __init__(self, config: Settings = settings) -> None:
        self.settings = config
        self.stream = config.redis_stream
        self.group = config.redis_group
        self.consumer = config.redis_consumer
        self.client: Any | None = None
        self.local_mode = config.use_local_queue
        config.ensure_directories()

        if not self.local_mode:
            try:
                import redis

                self.client = redis.from_url(config.redis_url, decode_responses=True)
                self.client.ping()
            except Exception:
                self.client = None
                self.local_mode = True

    @property
    def events_path(self) -> Path:
        return self.settings.state_dir / "events.jsonl"

    @property
    def acked_path(self) -> Path:
        return self.settings.state_dir / "acked.json"

    @property
    def results_dir(self) -> Path:
        return self.settings.state_dir / "results"

    @property
    def latest_path(self) -> Path:
        return self.settings.state_dir / "latest_incidents.json"

    def ensure_group(self) -> None:
        if self.local_mode:
            self.settings.ensure_directories()
            self.results_dir.mkdir(parents=True, exist_ok=True)
            return

        try:
            self.client.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    def publish_failure_event(self, event: dict[str, Any]) -> str:
        self.ensure_group()
        if self.local_mode:
            message_id = self._next_local_message_id()
            payload = {"message_id": message_id, "payload": event}
            with self.events_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, sort_keys=True, default=str) + "\n")
            return message_id

        return self.client.xadd(self.stream, {"payload": json.dumps(event, default=str)})

    def read_events(self, count: int = 1, block_ms: int = 5000) -> list[tuple[str, list[tuple[str, dict[str, str]]]]]:
        self.ensure_group()
        if self.local_mode:
            messages = self._read_local_messages(count=count)
            if not messages and block_ms:
                time.sleep(min(block_ms / 1000, 1.0))
                messages = self._read_local_messages(count=count)
            return [(self.stream, messages)] if messages else []

        return self.client.xreadgroup(
            groupname=self.group,
            consumername=self.consumer,
            streams={self.stream: ">"},
            count=count,
            block=block_ms,
        )

    def ack(self, message_id: str) -> None:
        if self.local_mode:
            acked = set(self._load_acked_ids())
            acked.add(message_id)
            self._write_json(self.acked_path, sorted(acked))
            return

        self.client.xack(self.stream, self.group, message_id)

    def save_result(self, incident_id: str, result: dict[str, Any]) -> None:
        self.ensure_group()
        if self.local_mode:
            self.results_dir.mkdir(parents=True, exist_ok=True)
            self._write_json(self.results_dir / f"{incident_id}.json", result)
            latest = [item for item in self.latest_incident_ids() if item != incident_id]
            latest.insert(0, incident_id)
            self._write_json(self.latest_path, latest[:20])
            return

        payload = json.dumps(result, default=str)
        self.client.set(f"airmemory:incident:{incident_id}:result", payload, ex=60 * 60 * 24)
        self.client.set(f"airmemory:incident:{incident_id}:status", result.get("status", "PROCESSED"), ex=60 * 60 * 24)
        self.client.lpush("airmemory:dashboard:latest_incidents", incident_id)
        self.client.ltrim("airmemory:dashboard:latest_incidents", 0, 20)

    def fetch_result(self, incident_id: str) -> dict[str, Any] | None:
        if self.local_mode:
            path = self.results_dir / f"{incident_id}.json"
            if not path.exists():
                return None
            return json.loads(path.read_text(encoding="utf-8"))

        payload = self.client.get(f"airmemory:incident:{incident_id}:result")
        return json.loads(payload) if payload else None

    def latest_incident_ids(self) -> list[str]:
        if self.local_mode:
            if not self.latest_path.exists():
                return []
            return list(json.loads(self.latest_path.read_text(encoding="utf-8")))

        return list(self.client.lrange("airmemory:dashboard:latest_incidents", 0, 20))

    def reset_demo_state(self) -> None:
        self.settings.ensure_directories()
        for path in [self.events_path, self.acked_path, self.latest_path]:
            if path.exists():
                path.unlink()
        if self.results_dir.exists():
            for item in self.results_dir.glob("*.json"):
                item.unlink()

        if self.client is not None:
            self.client.delete("airmemory:dashboard:latest_incidents", self.stream)

    def _read_local_messages(self, count: int) -> list[tuple[str, dict[str, str]]]:
        if not self.events_path.exists():
            return []

        acked = set(self._load_acked_ids())
        messages: list[tuple[str, dict[str, str]]] = []
        with self.events_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                entry = json.loads(line)
                message_id = entry["message_id"]
                if message_id in acked:
                    continue
                payload = json.dumps(entry["payload"], default=str)
                messages.append((message_id, {"payload": payload}))
                if len(messages) >= count:
                    break
        return messages

    def _next_local_message_id(self) -> str:
        current_count = 0
        if self.events_path.exists():
            with self.events_path.open("r", encoding="utf-8") as handle:
                current_count = sum(1 for _ in handle)
        return f"{int(time.time() * 1000)}-{current_count}"

    def _load_acked_ids(self) -> list[str]:
        if not self.acked_path.exists():
            return []
        return list(json.loads(self.acked_path.read_text(encoding="utf-8")))

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
