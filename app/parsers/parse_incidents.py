from __future__ import annotations

from pathlib import Path

from app.parsers.base import NormalizedArtifact, read_text


def parse(path: Path) -> list[NormalizedArtifact]:
    raw = read_text(path)
    facets = [
        "source:postmortem",
        "dag:customer_daily_migration_dag",
        "task:validate_row_counts",
        "table:hana.customer_master",
        "table:bq.prod.customer_master",
        "severity:sev1",
        "status:resolved",
        "engineer:alice@acme.com",
        "engineer:bob@acme.com",
        "engineer:lead@acme.com",
    ]
    return [
        NormalizedArtifact(
            id="inc-1029-postmortem",
            title="INC-1029: Row count mismatch in customer_daily_migration_dag",
            source="incident",
            text=raw,
            node_set=facets,
            citation_label="INC-1029 postmortem",
            excerpt="Root cause: validation used exact processing_date = system_date, excluding late-arriving records.",
            metadata={"incident_id": "INC-1029", "resolution_id": "res-window-3-day"},
        )
    ]

