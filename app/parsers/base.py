from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from app.schema import SourceKind


@dataclass(frozen=True)
class NormalizedArtifact:
    id: str
    title: str
    source: SourceKind
    text: str
    node_set: list[str]
    citation_label: str
    excerpt: str
    url: str | None = None
    metadata: dict[str, object] = field(default_factory=dict)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def transcript(title: str, lines: list[str]) -> str:
    body = "\n".join(lines)
    return f"# {title}\n{body}".strip()

