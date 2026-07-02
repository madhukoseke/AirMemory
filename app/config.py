from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    service_name: str = "AirMemory"
    dataset_name: str = "airmemory"
    deprecated_dataset_name: str = "airmemory_deprecated_full_dag_clear"
    storage_mode: str = "embedded"
    use_real_cognee: bool = False
    data_dir: Path = ROOT_DIR / "data"
    eval_dir: Path = ROOT_DIR / "eval"

    @classmethod
    def from_env(cls) -> "Settings":
        db_provider = os.getenv("DB_PROVIDER")
        storage_mode = "postgres" if db_provider == "postgres" else "embedded"
        return cls(
            dataset_name=os.getenv("AIRMEMORY_DATASET", "airmemory"),
            deprecated_dataset_name=os.getenv(
                "AIRMEMORY_DEPRECATED_DATASET",
                "airmemory_deprecated_full_dag_clear",
            ),
            storage_mode=os.getenv("AIRMEMORY_STORAGE_MODE", storage_mode),
            use_real_cognee=os.getenv("AIRMEMORY_USE_REAL_COGNEE", "0") == "1",
            data_dir=Path(os.getenv("AIRMEMORY_DATA_DIR", ROOT_DIR / "data")),
            eval_dir=Path(os.getenv("AIRMEMORY_EVAL_DIR", ROOT_DIR / "eval")),
        )
