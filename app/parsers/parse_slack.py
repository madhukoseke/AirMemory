from __future__ import annotations

import json
from pathlib import Path

from app.parsers.base import NormalizedArtifact, transcript


def parse(path: Path) -> list[NormalizedArtifact]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    lines = [
        f"[{msg['user']}, {msg['ts']}] {msg['text']}"
        for msg in payload["messages"]
    ]
    text = transcript(payload["title"], lines)
    return [
        NormalizedArtifact(
            id="slack-inc-1029-thread",
            title=payload["title"],
            source="slack",
            text=text,
            node_set=[
                "source:slack",
                "dag:customer_daily_migration_dag",
                "task:validate_row_counts",
                "table:hana.customer_master",
                "table:bq.prod.customer_master",
                "severity:sev1",
                "status:resolved",
                "engineer:alice@acme.com",
                "engineer:bob@acme.com",
                "engineer:lead@acme.com",
            ],
            citation_label="Slack thread INC-1029",
            excerpt="Use the plus/minus 3 day processing_date window and rerun only validation and reconciliation.",
            metadata={"incident_id": "INC-1029", "resolution_id": "res-window-3-day"},
        )
    ]

