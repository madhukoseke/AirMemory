from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from airmemory.ingestion.log_parser import build_event_from_log, parse_airflow_log
from app.main import app, memory_engine


client = TestClient(app)

SAMPLE_LOG = """2026-06-30T03:14:08Z ERROR dag_id=customer_daily_migration_dag task_id=validate_row_counts
2026-06-30T03:14:08Z ERROR error_type=ROW_COUNT_MISMATCH source_table=hana.customer_master target_table=bq.prod.customer_master
2026-06-30T03:14:08Z ERROR source_count=1588 target_count=1297 diff=291 processing_date=2026-06-30
2026-06-30T03:15:11Z INFO downstream task publish_metrics remains blocked because dq_reconciliation_check did not run
"""


def setup_function() -> None:
    memory_engine.state.reset()


def test_parse_airflow_log_extracts_core_fields() -> None:
    parsed = parse_airflow_log(SAMPLE_LOG)
    assert parsed["dag_id"] == "customer_daily_migration_dag"
    assert parsed["task_id"] == "validate_row_counts"
    assert "ROW_COUNT_MISMATCH" in parsed["error_message"]
    assert "hana.customer_master" in parsed["source_tables"]
    assert "bq.prod.customer_master" in parsed["target_tables"]


def test_build_event_from_log_allows_overrides() -> None:
    event, parsed = build_event_from_log(
        "plain failure without metadata",
        dag_id="override_dag",
        task_id="override_task",
        run_id="manual__override",
    )
    assert event.dag_id == "override_dag"
    assert event.task_id == "override_task"
    assert event.run_id == "manual__override"
    assert event.source_system == "manual_log"
    assert parsed["dag_id"] == "override_dag"


def test_runtime_analyze_endpoint(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
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

    response = client.post("/runtime/analyze", json={"log_text": SAMPLE_LOG})
    assert response.status_code == 200
    body = response.json()
    assert body["processed"] is True
    assert body["parsed"]["dag_id"] == "customer_daily_migration_dag"
    assert body["result"]["incident"]["failure_category"] == "row_count_mismatch"
    incident_id = body["result"]["incident"]["incident_id"]

    listed = client.get("/runtime/incidents")
    assert incident_id in listed.json()["incident_ids"]


def test_runtime_analyze_rejects_empty_log() -> None:
    response = client.post("/runtime/analyze", json={"log_text": "   "})
    assert response.status_code == 400
