from __future__ import annotations

from pathlib import Path

from app.parsers.base import NormalizedArtifact, read_text


def parse(path: Path) -> list[NormalizedArtifact]:
    raw = read_text(path)
    common_facets = [
        "source:runbook",
        "dag:customer_daily_migration_dag",
        "task:validate_row_counts",
        "table:hana.customer_master",
        "table:bq.prod.customer_master",
    ]
    return [
        NormalizedArtifact(
            id="runbook-row-count-window",
            title="Runbook: customer row count mismatch",
            source="runbook",
            text=raw,
            node_set=[*common_facets, "status:resolved"],
            citation_label="Row count mismatch runbook",
            excerpt="Use a processing_date window from system_date - 3 through system_date + 3 before rerunning validation.",
            metadata={"resolution_id": "res-window-3-day"},
        ),
        NormalizedArtifact(
            id="runbook-deprecated-full-dag-clear",
            title="Deprecated workaround: full DAG clear",
            source="runbook",
            text="# Deprecated workaround: full DAG clear\n[lead@acme.com, 2026-06-20T03:34] Deprecated: clearing the full DAG is unsafe because downstream BigQuery tables are incremental and full reruns duplicate published metrics.",
            node_set=[*common_facets, "status:deprecated"],
            citation_label="Deprecated runbook section",
            excerpt="Deprecated: clearing the full DAG is unsafe because downstream BigQuery tables are incremental.",
            metadata={"resolution_id": "res-full-dag-clear", "dataset": "airmemory_deprecated_full_dag_clear"},
        ),
    ]
