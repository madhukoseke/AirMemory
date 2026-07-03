from __future__ import annotations

from airmemory.ingestion.demo_emitters import build_demo_failure_event
from airmemory.processing.data import load_dag_metadata, load_historical_incidents
from airmemory.processing.normalizer import normalize_event
from airmemory.processing.similarity import find_similar_incidents


def test_demo_similarity_top_match() -> None:
    current = normalize_event(build_demo_failure_event(), load_dag_metadata())
    historical = load_historical_incidents()
    matches = find_similar_incidents(current, historical)

    assert matches[0].incident_id == "inc_2026_06_12_customer_revenue_missing_partition"
    assert matches[0].similarity_score >= 0.9
