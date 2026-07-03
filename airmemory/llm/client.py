from __future__ import annotations

import json
import os
from typing import Any

from airmemory.config import settings
from airmemory.models import DagMetadata, IncidentAdvice, NormalizedIncident, SimilarIncidentMatch


async def generate_incident_advice(
    current_incident: NormalizedIncident,
    similar_incidents: list[SimilarIncidentMatch],
    cognee_recall: str,
    dag_metadata: DagMetadata | dict[str, Any] | None,
) -> IncidentAdvice:
    if settings.use_fake_llm or not os.getenv("LLM_API_KEY"):
        return _fake_advice(current_incident, similar_incidents)

    try:
        return await _real_llm_advice(current_incident, similar_incidents, cognee_recall, dag_metadata)
    except Exception:
        return _fake_advice(current_incident, similar_incidents)


def _fake_advice(
    current_incident: NormalizedIncident,
    similar_incidents: list[SimilarIncidentMatch],
) -> IncidentAdvice:
    if current_incident.failure_category == "missing_partition":
        return IncidentAdvice(
            summary=(
                "The transform_revenue task failed because the required source partition was missing "
                "from raw.customer_transactions."
            ),
            likely_root_cause="The upstream raw.customer_transactions partition was not available when the DAG started.",
            confidence=0.91,
            recommended_fix="Check the source partition, backfill it if missing, then rerun from transform_revenue.",
            rejected_fix_warning="Increasing retries alone did not solve this pattern in a previous incident.",
            recommended_next_steps=[
                "Check whether raw.customer_transactions has the required processing date partition.",
                "Trigger or request an upstream backfill if the partition is missing.",
                "Rerun customer_daily_revenue_dag from transform_revenue after the partition is available.",
                "Add or verify an upstream partition sensor to prevent recurrence.",
            ],
            prevention="Add an upstream partition availability sensor before transform_revenue.",
        )

    if similar_incidents:
        top = similar_incidents[0].historical_incident
        return IncidentAdvice(
            summary=f"{current_incident.task_id} failed with a {current_incident.failure_category} pattern.",
            likely_root_cause=top.root_cause,
            confidence=max(0.5, min(similar_incidents[0].similarity_score, 0.9)),
            recommended_fix=top.accepted_fix,
            rejected_fix_warning=_join_rejected(top.rejected_fixes),
            recommended_next_steps=[
                "Review the top matched historical incident.",
                "Apply the accepted fix only after validating the current failure context.",
                "Validate downstream freshness and row counts after rerun.",
            ],
            prevention=top.prevention,
        )

    return IncidentAdvice(
        summary=f"{current_incident.task_id} failed with category {current_incident.failure_category}.",
        likely_root_cause="No strong historical match was found.",
        confidence=0.35,
        recommended_fix="Triage the Airflow logs, validate upstream data readiness, and rerun only the failed task.",
        recommended_next_steps=[
            "Inspect the Airflow task log and source data freshness.",
            "Check upstream task completion and target table partial writes.",
            "Document the confirmed root cause after resolution.",
        ],
        prevention="Add a runbook entry after the incident is resolved.",
    )


async def _real_llm_advice(
    current_incident: NormalizedIncident,
    similar_incidents: list[SimilarIncidentMatch],
    cognee_recall: str,
    dag_metadata: DagMetadata | dict[str, Any] | None,
) -> IncidentAdvice:
    prompt_path = settings.seed_data_dir.parent / "airmemory" / "llm" / "prompts" / "incident_summary.md"
    prompt = prompt_path.read_text(encoding="utf-8")
    prompt = prompt.replace("{{ current_incident }}", current_incident.model_dump_json(indent=2))
    prompt = prompt.replace(
        "{{ similar_incidents }}",
        json.dumps([match.model_dump(mode="json") for match in similar_incidents], indent=2),
    )
    prompt = prompt.replace("{{ cognee_recall }}", cognee_recall)
    if isinstance(dag_metadata, DagMetadata):
        metadata_json = dag_metadata.model_dump_json(indent=2)
    else:
        metadata_json = json.dumps(dag_metadata or {}, indent=2, default=str)
    prompt = prompt.replace("{{ dag_metadata }}", metadata_json)

    try:
        from openai import AsyncOpenAI
    except Exception as exc:
        raise RuntimeError("openai package is not installed") from exc

    client = AsyncOpenAI(api_key=os.getenv("LLM_API_KEY"))
    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    payload = response.choices[0].message.content or "{}"
    return IncidentAdvice.model_validate_json(payload)


def _join_rejected(rejected_fixes: list[str]) -> str | None:
    if not rejected_fixes:
        return None
    return "; ".join(rejected_fixes)
