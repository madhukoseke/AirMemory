from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    env: str = "local"
    dataset: str = "airmemory_demo"
    cognee_dataset: str = "airmemory_demo"
    wiki_dir: Path = ROOT_DIR / "wiki"
    state_dir: Path = ROOT_DIR / ".airmemory_state"
    seed_data_dir: Path = ROOT_DIR / "seed_data"
    log_level: str = "INFO"

    redis_url: str = "redis://localhost:6379/0"
    redis_stream: str = "airmemory:events:airflow_failures"
    redis_group: str = "airmemory-workers"
    redis_consumer: str = "worker-1"
    use_local_queue: bool = True

    llm_provider: str = "openai"
    llm_model: str = "gpt-4.1-mini"
    use_fake_llm: bool = True
    enable_airflow: bool = False
    demo_date: str = "2026-07-01"

    @classmethod
    def from_env(cls) -> "Settings":
        root = ROOT_DIR
        return cls(
            env=os.getenv("AIRMEMORY_ENV", "local"),
            dataset=os.getenv("AIRMEMORY_DATASET", "airmemory_demo"),
            cognee_dataset=os.getenv("COGNEE_DATASET", os.getenv("AIRMEMORY_DATASET", "airmemory_demo")),
            wiki_dir=Path(os.getenv("AIRMEMORY_WIKI_DIR", root / "wiki")),
            state_dir=Path(os.getenv("AIRMEMORY_STATE_DIR", root / ".airmemory_state")),
            seed_data_dir=Path(os.getenv("AIRMEMORY_SEED_DATA_DIR", root / "seed_data")),
            log_level=os.getenv("AIRMEMORY_LOG_LEVEL", "INFO"),
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            redis_stream=os.getenv("AIRMEMORY_REDIS_STREAM", "airmemory:events:airflow_failures"),
            redis_group=os.getenv("AIRMEMORY_REDIS_GROUP", "airmemory-workers"),
            redis_consumer=os.getenv("AIRMEMORY_REDIS_CONSUMER", "worker-1"),
            use_local_queue=_bool_env("AIRMEMORY_USE_LOCAL_QUEUE", True),
            llm_provider=os.getenv("AIRMEMORY_LLM_PROVIDER", "openai"),
            llm_model=os.getenv("AIRMEMORY_LLM_MODEL", "gpt-4.1-mini"),
            use_fake_llm=_bool_env("AIRMEMORY_USE_FAKE_LLM", True),
            enable_airflow=_bool_env("AIRMEMORY_ENABLE_AIRFLOW", False),
            demo_date=os.getenv("AIRMEMORY_DEMO_DATE", "2026-07-01"),
        )

    def ensure_directories(self) -> None:
        self.wiki_dir.mkdir(parents=True, exist_ok=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        for name in [
            "dags",
            "tasks",
            "incidents",
            "failure-patterns",
            "root-causes",
            "fixes",
            "runbooks",
            "postmortems",
        ]:
            (self.wiki_dir / name).mkdir(parents=True, exist_ok=True)


settings = Settings.from_env()
