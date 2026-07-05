from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app, memory_engine


client = TestClient(app)


def setup_function() -> None:
    memory_engine.state.reset()


def test_runtime_summary_endpoint() -> None:
    response = client.get("/runtime/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["queue_mode"] in {"local", "redis"}
    assert "incident_count" in payload


def test_runtime_emit_process_and_fetch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from airmemory.config import Settings

    state_dir = tmp_path / "state"
    wiki_dir = tmp_path / "wiki"
    test_settings = Settings(
        state_dir=state_dir,
        wiki_dir=wiki_dir,
        use_local_queue=True,
        use_fake_llm=True,
        seed_data_dir=Path(__file__).resolve().parents[1] / "seed_data",
    )
    monkeypatch.setattr("airmemory.redis_client.settings", test_settings)
    monkeypatch.setattr("airmemory.config.settings", test_settings)
    monkeypatch.setattr("airmemory.wiki.paths.settings", test_settings)

    emit = client.post("/runtime/emit")
    assert emit.status_code == 200
    assert emit.json()["dag_id"] == "customer_daily_revenue_dag"

    processed = client.post("/runtime/process")
    assert processed.status_code == 200
    body = processed.json()
    assert body["processed"] is True
    incident_id = body["result"]["incident"]["incident_id"]

    listed = client.get("/runtime/incidents")
    assert listed.status_code == 200
    assert incident_id in listed.json()["incident_ids"]

    detail = client.get(f"/runtime/incidents/{incident_id}")
    assert detail.status_code == 200
    assert detail.json()["advice"]["recommended_fix"]
