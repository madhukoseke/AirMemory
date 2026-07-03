from __future__ import annotations

from pathlib import Path

from airmemory.config import ROOT_DIR, settings


def get_wiki_dir(wiki_dir: Path | None = None) -> Path:
    root = wiki_dir or settings.wiki_dir
    root.mkdir(parents=True, exist_ok=True)
    return root


def relative_to_root(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT_DIR))
    except ValueError:
        return str(path)
