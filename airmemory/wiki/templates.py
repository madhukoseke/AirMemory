from __future__ import annotations

from airmemory.models import HistoricalIncident, IncidentAdvice, NormalizedIncident, SimilarIncidentMatch


def historical_incident_to_markdown(incident: HistoricalIncident) -> str:
    rejected = "\n".join(f"- {item}" for item in incident.rejected_fixes) or "- None recorded"
    sources = "\n".join(f"- {item}" for item in incident.source_tables) or "- None recorded"
    targets = "\n".join(f"- {item}" for item in incident.target_tables) or "- None recorded"
    return f"""# AirMemory Incident Memory: {incident.incident_id}

Type: HistoricalIncident
Date: {incident.date}
DAG: {incident.dag_id}
Task: {incident.task_id}
Failure Category: {incident.failure_category}
Failure Fingerprint: {incident.failure_fingerprint}
Owner: {incident.owner or "unknown"}

## Error

{incident.error_message}

## Normalized Error

{incident.normalized_error}

## Root Cause

{incident.root_cause}

## Accepted Fix

{incident.accepted_fix}

## Rejected Fixes

{rejected}

## Prevention

{incident.prevention or "None recorded"}

## Source Tables

{sources}

## Target Tables

{targets}

## Related Runbook

{incident.related_runbook or "None recorded"}
"""


def build_incident_memory_markdown(
    incident: NormalizedIncident,
    similar_incidents: list[SimilarIncidentMatch],
    advice: IncidentAdvice,
    cognee_recall_text: str | None,
) -> str:
    similar = "\n".join(
        f"- {match.incident_id}: score {match.similarity_score:.2f}, {match.reason}"
        for match in similar_incidents
    ) or "- No similar incidents found"
    steps = "\n".join(f"- {step}" for step in advice.recommended_next_steps) or "- No steps generated"
    sources = "\n".join(f"- {item}" for item in incident.source_tables) or "- None recorded"
    targets = "\n".join(f"- {item}" for item in incident.target_tables) or "- None recorded"

    return f"""# AirMemory Current Incident: {incident.incident_id}

Type: CurrentIncident
Status: {incident.status}
DAG: {incident.dag_id}
Task: {incident.task_id}
Failure Category: {incident.failure_category}
Failure Fingerprint: {incident.failure_fingerprint}
Owner: {incident.owner or "unknown"}

## Failure

{incident.raw_error}

## AirMemory Summary

{advice.summary}

## Likely Root Cause

{advice.likely_root_cause}

## Recommended Fix

{advice.recommended_fix}

## Similar Incidents

{similar}

## Rejected Fix Warning

{advice.rejected_fix_warning or "None recorded"}

## Recommended Next Steps

{steps}

## Tables

Source:
{sources}

Target:
{targets}

## Cognee Recall Evidence

{cognee_recall_text or "No recall evidence returned."}
"""
