from __future__ import annotations

from airmemory.ingestion.demo_emitters import build_demo_failure_event
from airmemory.processing.data import load_dag_metadata
from airmemory.processing.normalizer import normalize_event


def test_demo_event_normalizes_to_expected_incident() -> None:
    incident = normalize_event(build_demo_failure_event(), load_dag_metadata())

    assert incident.incident_id == "inc_2026_07_01_customer_daily_revenue_dag_transform_revenue_missing_partition"
    assert incident.failure_category == "missing_partition"
    assert incident.normalized_error == "partition not found in raw.customer_transactions"
    assert incident.failure_fingerprint == (
        "missing_partition|customer_daily_revenue_dag|transform_revenue|raw.customer_transactions"
    )
