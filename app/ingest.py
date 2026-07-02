from __future__ import annotations

from collections import Counter
from pathlib import Path

from app.parsers.base import NormalizedArtifact
from app.parsers import (
    parse_dag,
    parse_github_issues,
    parse_incidents,
    parse_logs,
    parse_runbooks,
    parse_slack,
    parse_sql,
)


def load_sample_artifacts(data_dir: Path) -> list[NormalizedArtifact]:
    artifacts: list[NormalizedArtifact] = []
    artifacts.extend(parse_dag.parse(data_dir / "dags" / "customer_daily_migration_dag.py"))
    artifacts.extend(parse_logs.parse(data_dir / "logs" / "validate_row_counts_20260630.log"))
    artifacts.extend(parse_incidents.parse(data_dir / "incidents" / "inc_1029.md"))
    artifacts.extend(parse_runbooks.parse(data_dir / "runbooks" / "row_count_mismatch.md"))
    artifacts.extend(parse_sql.parse(data_dir / "sql" / "validate_customer_counts.sql"))
    artifacts.extend(parse_slack.parse(data_dir / "slack" / "inc_1029_thread.json"))
    artifacts.extend(parse_github_issues.parse(data_dir / "github" / "airflow_issues.json"))
    return artifacts


def count_by_source(artifacts: list[NormalizedArtifact]) -> dict[str, int]:
    return dict(Counter(artifact.source for artifact in artifacts))
