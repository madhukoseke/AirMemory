from __future__ import annotations

import json
from pathlib import Path

from app.parsers.base import NormalizedArtifact, transcript


def parse(path: Path) -> list[NormalizedArtifact]:
    issues = json.loads(path.read_text(encoding="utf-8"))
    artifacts: list[NormalizedArtifact] = []
    for issue in issues:
        issue_id = f"github-airflow-{issue['number']}"
        text = transcript(
            f"Apache Airflow issue #{issue['number']}: {issue['title']}",
            [
                f"[github:{issue['author']}, {issue['created_at']}] {issue['body']}",
                f"[github:maintainer, {issue['updated_at']}] {issue['resolution']}",
            ],
        )
        artifacts.append(
            NormalizedArtifact(
                id=issue_id,
                title=issue["title"],
                source="github",
                text=text,
                node_set=[
                    "source:github",
                    f"github_issue:{issue['number']}",
                    f"status:{issue['status']}",
                    *[f"tag:{tag}" for tag in issue.get("tags", [])],
                ],
                citation_label=f"Apache Airflow issue #{issue['number']}",
                excerpt=issue["resolution"],
                url=issue["url"],
                metadata={"issue_number": issue["number"]},
            )
        )
    return artifacts

