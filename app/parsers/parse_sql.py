from __future__ import annotations

from pathlib import Path

from app.parsers.base import NormalizedArtifact, read_text, transcript


def parse(path: Path) -> list[NormalizedArtifact]:
    raw = read_text(path)
    text = transcript(
        "Validation SQL: processing_date window for customer counts",
        [
            "[sql-review@acme.com, 2026-06-20T03:45] Validation reads hana.customer_master and bq.prod.customer_master.",
            "[sql-review@acme.com, 2026-06-20T03:46] Accepted fix counts records in the system_date - 3 through system_date + 3 processing_date window and excludes already matched rows.",
            "",
            "```sql",
            raw,
            "```",
        ],
    )
    return [
        NormalizedArtifact(
            id="sql-validate-customer-counts-window",
            title="Validation SQL with processing_date window",
            source="sql",
            text=text,
            node_set=[
                "source:sql",
                "dag:customer_daily_migration_dag",
                "task:validate_row_counts",
                "table:hana.customer_master",
                "table:bq.prod.customer_master",
                "status:resolved",
            ],
            citation_label="validate_customer_counts.sql",
            excerpt="The accepted SQL counts processing_date between system_date - 3 and system_date + 3.",
            metadata={"resolution_id": "res-window-3-day"},
        )
    ]

