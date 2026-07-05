from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from airmemory.models import AirflowFailureEvent, HistoricalIncident, NormalizedIncident
from airmemory.processing.lineage import (
    find_lineage_incident_matches,
    merge_similarity_matches,
    trace_upstream_tables,
)
from airmemory.processing.similarity import find_similar_incidents
from airmemory.redis_client import RedisClient


LINEAGE = {
    "bq.prod.customer_metrics": {"upstream_tables": ["bq.prod.customer_master"]},
    "bq.prod.customer_master": {"upstream_tables": ["hana.customer_master"]},
    "hana.customer_master": {"upstream_tables": []},
    "raw.customer_transactions": {"downstream_dags": ["customer_daily_revenue_dag"]},
}


def test_trace_upstream_tables() -> None:
    path = trace_upstream_tables("bq.prod.customer_metrics", LINEAGE)
    assert path == [
        "bq.prod.customer_metrics",
        "bq.prod.customer_master",
        "hana.customer_master",
    ]


def test_find_lineage_incident_matches() -> None:
    current = NormalizedIncident(
        incident_id="inc_current",
        event_id="evt_1",
        dag_id="customer_daily_migration_dag",
        task_id="publish_metrics",
        run_id="run_1",
        execution_date="2026-06-30",
        failure_category="row_count_mismatch",
        failure_fingerprint="fp",
        normalized_error="row count mismatch between source and target",
        raw_error="Looker metrics stale",
        target_tables=["bq.prod.customer_metrics"],
    )
    historical = [
        HistoricalIncident(
            incident_id="inc_upstream",
            date="2026-06-12",
            dag_id="customer_daily_migration_dag",
            task_id="validate_row_counts",
            failure_category="row_count_mismatch",
            error_message="count mismatch",
            normalized_error="row count mismatch between source and target",
            failure_fingerprint="fp2",
            root_cause="late records",
            accepted_fix="use window",
            source_tables=["hana.customer_master"],
            target_tables=["bq.prod.customer_master"],
        )
    ]
    matches = find_lineage_incident_matches(current, historical, LINEAGE)
    assert matches
    assert matches[0].incident_id == "inc_upstream"


def test_merge_similarity_matches_prefers_higher_score() -> None:
    current = NormalizedIncident(
        incident_id="inc_current",
        event_id="evt_1",
        dag_id="customer_daily_revenue_dag",
        task_id="transform_revenue",
        run_id="run_1",
        execution_date="2026-07-01",
        failure_category="missing_partition",
        failure_fingerprint="fp",
        normalized_error="partition not found in raw.customer_transactions",
        raw_error="partition missing",
        source_tables=["raw.customer_transactions"],
    )
    historical = [
        HistoricalIncident(
            incident_id="inc_partition",
            date="2026-06-12",
            dag_id="customer_daily_revenue_dag",
            task_id="transform_revenue",
            failure_category="missing_partition",
            error_message="partition missing",
            normalized_error="partition not found in raw.customer_transactions",
            failure_fingerprint="fp2",
            root_cause="delayed partition",
            accepted_fix="backfill",
            source_tables=["raw.customer_transactions"],
        )
    ]
    deterministic = find_similar_incidents(current, historical, top_k=1)
    lineage = find_lineage_incident_matches(current, historical, LINEAGE, top_k=1)
    merged = merge_similarity_matches(deterministic, lineage, top_k=1)
    assert merged[0].incident_id == "inc_partition"


def test_redis_local_queue_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from airmemory.config import Settings

    state_dir = tmp_path / "state"
    test_settings = Settings(
        state_dir=state_dir,
        use_local_queue=True,
        wiki_dir=tmp_path / "wiki",
        seed_data_dir=Path(__file__).resolve().parents[1] / "seed_data",
    )
    monkeypatch.setattr("airmemory.redis_client.settings", test_settings)

    client = RedisClient(test_settings)
    client.reset_demo_state()
    event = {
        "event_id": "evt_test",
        "event_type": "task_failed",
        "dag_id": "customer_daily_revenue_dag",
        "task_id": "transform_revenue",
        "run_id": "run_test",
        "execution_date": "2026-07-01T00:00:00Z",
        "error_message": "partition missing",
    }
    message_id = client.publish_failure_event(event)
    messages = client.read_events(count=1, block_ms=0)
    assert messages
    assert messages[0][1][0][0] == message_id
    client.save_result("inc_test", {"status": "PROCESSED", "incident": {"incident_id": "inc_test"}})
    assert client.latest_incident_ids() == ["inc_test"]
    assert client.fetch_result("inc_test")["status"] == "PROCESSED"
    client.ack(message_id)
    assert client.read_events(count=1, block_ms=0) == []


def test_incident_pipeline_processes_demo_event(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from airmemory.config import Settings
    from airmemory.processing.incident_pipeline import process_failure_event

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

    event = AirflowFailureEvent(
        event_id="evt_pipeline",
        event_type="task_failed",
        dag_id="customer_daily_revenue_dag",
        task_id="transform_revenue",
        run_id="scheduled__2026-07-01",
        execution_date="2026-07-01T00:00:00Z",
        error_message="BigQuery error: partition 2026-07-01 not found in raw.customer_transactions",
        source_tables=["raw.customer_transactions"],
        target_tables=["mart.customer_daily_revenue"],
    )
    result = asyncio.run(process_failure_event(event))
    assert result.incident.failure_category == "missing_partition"
    assert result.similar_incidents
    assert result.advice.recommended_fix
    assert result.wiki_paths
