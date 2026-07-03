from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from airmemory.config import settings


def import_cognee() -> Any | None:
    try:
        import cognee

        return cognee
    except Exception:
        return None


def cognee_available() -> bool:
    return import_cognee() is not None


def local_memory_dir(dataset_name: str) -> Path:
    path = settings.state_dir / "cognee_memory" / dataset_name
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_local_memory(markdown: str, dataset_name: str) -> Path:
    digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest()[:16]
    path = local_memory_dir(dataset_name) / f"{digest}.md"
    path.write_text(markdown.rstrip() + "\n", encoding="utf-8")
    return path
