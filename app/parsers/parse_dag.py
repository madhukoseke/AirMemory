from __future__ import annotations

from pathlib import Path

from app.parsers.base import NormalizedArtifact, read_text, transcript


def parse(path: Path) -> list[NormalizedArtifact]:
    raw = read_text(path)
    title = "customer_daily_migration_dag structure and lineage"
    text = transcript(
        title,
        [
            "[airmemory@acme.com, 2026-06-29T09:00] DAG customer_daily_migration_dag is owned by data-platform@acme.com.",
            "[airmemory@acme.com, 2026-06-29T09:01] Tasks: extract_hana_customer, validate_row_counts, transform_customer_profile, load_bigquery_customer, dq_reconciliation_check, publish_metrics.",
            "[airmemory@acme.com, 2026-06-29T09:02] Lineage: customer_daily_migration_dag consumes hana.customer_master and produces bq.prod.customer_master and bq.prod.customer_metrics.",
            "[airmemory@acme.com, 2026-06-29T09:03] bq.prod.customer_metrics is downstream of bq.prod.customer_master, which is downstream of hana.customer_master.",
            "",
            "```python",
            raw,
            "```",
        ],
    )
    return [
        NormalizedArtifact(
            id="dag-customer-daily-migration",
            title=title,
            source="dag",
            text=text,
            node_set=[
                "source:dag",
                "dag:customer_daily_migration_dag",
                "task:validate_row_counts",
                "task:publish_metrics",
                "table:hana.customer_master",
                "table:bq.prod.customer_master",
                "table:bq.prod.customer_metrics",
                "engineer:data-platform@acme.com",
            ],
            citation_label="DAG customer_daily_migration_dag",
            excerpt="The DAG consumes hana.customer_master and produces bq.prod.customer_master and bq.prod.customer_metrics.",
            metadata={"dag_id": "customer_daily_migration_dag"},
        )
    ]
