from __future__ import annotations

from pathlib import Path

from app.parsers.base import NormalizedArtifact, read_text, transcript


def parse(path: Path) -> list[NormalizedArtifact]:
    raw = read_text(path)
    title = "ALERT-20260630: validate_row_counts row count mismatch"
    text = transcript(
        title,
        [
            "[airflow@acme.com, 2026-06-30T03:14] customer_daily_migration_dag failed at validate_row_counts.",
            "[airflow@acme.com, 2026-06-30T03:14] Source HANA count 1588, target BigQuery count 1297, diff 291, error ROW_COUNT_MISMATCH.",
            "[airflow@acme.com, 2026-06-30T03:15] Downstream publish_metrics is blocked until reconciliation passes.",
            "",
            "```text",
            raw,
            "```",
        ],
    )
    return [
        NormalizedArtifact(
            id="log-validate-row-counts-20260630",
            title=title,
            source="log",
            text=text,
            node_set=[
                "source:log",
                "dag:customer_daily_migration_dag",
                "task:validate_row_counts",
                "table:hana.customer_master",
                "table:bq.prod.customer_master",
                "severity:sev1",
                "status:active",
            ],
            citation_label="Airflow alert 2026-06-30 03:14",
            excerpt="Source HANA count 1588, target BigQuery count 1297, diff 291, error ROW_COUNT_MISMATCH.",
            metadata={"incident_id": "ALERT-20260630"},
        )
    ]

