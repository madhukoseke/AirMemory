from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from airmemory.config import Settings, settings
from airmemory.models import DagMetadata, HistoricalIncident


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_historical_incidents(config: Settings = settings) -> list[HistoricalIncident]:
    path = config.seed_data_dir / "incidents.json"
    return [HistoricalIncident.model_validate(item) for item in _read_json(path)]


def load_dag_metadata(config: Settings = settings) -> dict[str, DagMetadata]:
    path = config.seed_data_dir / "dag_metadata.json"
    return {dag_id: DagMetadata.model_validate(data) for dag_id, data in _read_json(path).items()}


def load_runbooks(config: Settings = settings) -> dict[str, dict[str, Any]]:
    path = config.seed_data_dir / "runbooks.json"
    if not path.exists():
        return {}
    return _read_json(path)


def load_lineage(config: Settings = settings) -> dict[str, dict[str, Any]]:
    path = config.seed_data_dir / "lineage.json"
    if not path.exists():
        return {}
    return _read_json(path)
