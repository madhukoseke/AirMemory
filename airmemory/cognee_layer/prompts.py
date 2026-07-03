from __future__ import annotations

from airmemory.config import ROOT_DIR


PROMPTS_DIR = ROOT_DIR / "airmemory" / "llm" / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")
