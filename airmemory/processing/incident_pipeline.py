from __future__ import annotations

from airmemory.cognee_layer.recall import build_recall_query, recall_similar_incidents
from airmemory.cognee_layer.remember import remember_incident_markdown
from airmemory.config import settings
from airmemory.llm.client import generate_incident_advice
from airmemory.models import AirflowFailureEvent, ProcessedIncidentResult
from airmemory.processing.data import load_dag_metadata, load_historical_incidents
from airmemory.processing.normalizer import normalize_event
from airmemory.processing.lineage import find_lineage_incident_matches, merge_similarity_matches
from airmemory.processing.similarity import find_similar_incidents
from airmemory.wiki.templates import build_incident_memory_markdown
from airmemory.wiki.writer import write_incident_wiki


async def process_failure_event(event: AirflowFailureEvent) -> ProcessedIncidentResult:
    dag_metadata = load_dag_metadata()
    incident = normalize_event(event, dag_metadata)
    historical_incidents = load_historical_incidents()
    deterministic = find_similar_incidents(incident, historical_incidents, top_k=3)
    lineage_matches = find_lineage_incident_matches(incident, historical_incidents, top_k=3)
    similar = merge_similarity_matches(deterministic, lineage_matches, top_k=3)

    recall_query = build_recall_query(incident)
    cognee_recall_text = await recall_similar_incidents(
        query=recall_query,
        dataset_name=settings.cognee_dataset,
    )

    advice = await generate_incident_advice(
        current_incident=incident,
        similar_incidents=similar,
        cognee_recall=cognee_recall_text,
        dag_metadata=dag_metadata.get(incident.dag_id),
    )

    incident.likely_root_cause = advice.likely_root_cause
    incident.recommended_fix = advice.recommended_fix
    incident.rejected_fix_warning = advice.rejected_fix_warning

    wiki_paths = write_incident_wiki(
        incident=incident,
        similar_incidents=similar,
        advice=advice,
        cognee_recall_text=cognee_recall_text,
        dag_metadata=dag_metadata.get(incident.dag_id),
    )

    incident_markdown = build_incident_memory_markdown(
        incident=incident,
        similar_incidents=similar,
        advice=advice,
        cognee_recall_text=cognee_recall_text,
    )
    await remember_incident_markdown(
        markdown=incident_markdown,
        dataset_name=settings.cognee_dataset,
    )

    return ProcessedIncidentResult(
        incident=incident,
        similar_incidents=similar,
        advice=advice,
        cognee_recall_text=cognee_recall_text,
        wiki_paths=wiki_paths,
    )
