from __future__ import annotations

import asyncio
import json
import logging

from airmemory.models import AirflowFailureEvent, ProcessedIncidentResult
from airmemory.processing.incident_pipeline import process_failure_event
from airmemory.redis_client import RedisClient

logger = logging.getLogger(__name__)


async def run_worker_once(block_ms: int = 1000) -> ProcessedIncidentResult | None:
    redis = RedisClient()
    events = redis.read_events(count=1, block_ms=block_ms)
    if not events:
        return None

    for _stream, messages in events:
        for message_id, fields in messages:
            payload = json.loads(fields["payload"])
            event = AirflowFailureEvent.model_validate(payload)
            try:
                result = await process_failure_event(event)
                redis.save_result(result.incident.incident_id, result.model_dump(mode="json"))
                redis.ack(message_id)
                return result
            except Exception:
                logger.exception("Failed to process AirMemory event %s", message_id)
                return None
    return None


async def run_worker_forever(poll_seconds: float = 1.0) -> None:
    while True:
        await run_worker_once(block_ms=int(poll_seconds * 1000))
        await asyncio.sleep(poll_seconds)


def format_worker_result(result: ProcessedIncidentResult | None) -> str:
    if result is None:
        return "AirMemory Worker\n\nNo pending failure events found."

    incident = result.incident
    similar_lines = []
    for index, match in enumerate(result.similar_incidents, start=1):
        display_score = min(match.similarity_score, result.advice.confidence)
        similar_lines.append(
            f"{index}. {match.incident_id} - {display_score:.2f}\n"
            f"   Reason: {match.reason}"
        )
    similar_text = "\n".join(similar_lines) or "No similar incidents found."
    wiki_text = "\n".join(f"- {path}" for path in result.wiki_paths) or "- No wiki files written"

    return f"""AirMemory Worker

Received failure:
- DAG: {incident.dag_id}
- Task: {incident.task_id}
- Error: {incident.raw_error}

Normalized:
- Category: {incident.failure_category}
- Fingerprint: {incident.failure_fingerprint}

Similar incidents:
{similar_text}

Cognee recall:
{result.cognee_recall_text or "No recall evidence returned."}

AirMemory recommendation:
Root cause: {result.advice.likely_root_cause}
Fix: {result.advice.recommended_fix}
Do not repeat: {result.advice.rejected_fix_warning or "No rejected fix warning available."}

Wiki updated:
{wiki_text}

Cognee updated:
- Remembered current incident
"""
