from __future__ import annotations

from airmemory.ingestion.demo_emitters import build_demo_failure_event
from airmemory.llm.client import generate_incident_advice
from airmemory.processing.data import load_dag_metadata, load_historical_incidents
from airmemory.processing.normalizer import normalize_event
from airmemory.processing.similarity import find_similar_incidents
from airmemory.wiki.writer import write_incident_wiki


async def _build_advice(incident, matches):
    return await generate_incident_advice(incident, matches, "test recall evidence", load_dag_metadata()[incident.dag_id])


def test_wiki_writer_creates_incident_page(tmp_path) -> None:
    metadata = load_dag_metadata()
    incident = normalize_event(build_demo_failure_event(), metadata)
    matches = find_similar_incidents(incident, load_historical_incidents())

    import asyncio

    advice = asyncio.run(_build_advice(incident, matches))
    paths = write_incident_wiki(
        incident=incident,
        similar_incidents=matches,
        advice=advice,
        cognee_recall_text="test recall evidence",
        dag_metadata=metadata[incident.dag_id],
        wiki_dir=tmp_path,
    )

    incident_path = tmp_path / "incidents" / f"{incident.incident_id}.md"
    assert incident_path.exists()
    assert "Increasing retries alone did not solve this pattern" in incident_path.read_text(encoding="utf-8")
    assert any(path.endswith(f"incidents/{incident.incident_id}.md") for path in paths)
