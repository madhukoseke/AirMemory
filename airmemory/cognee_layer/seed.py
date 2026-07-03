from __future__ import annotations

from airmemory.cognee_layer.remember import remember_incident_markdown
from airmemory.config import settings
from airmemory.models import HistoricalIncident
from airmemory.wiki.templates import historical_incident_to_markdown


async def seed_historical_incidents(incidents: list[HistoricalIncident], dataset_name: str = settings.cognee_dataset) -> int:
    for incident in incidents:
        await remember_incident_markdown(historical_incident_to_markdown(incident), dataset_name=dataset_name)
    return len(incidents)
