from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AirflowFailureEvent(BaseModel):
    event_id: str
    event_type: Literal["task_failed", "dag_failed"]
    incident_id: str | None = None

    dag_id: str
    task_id: str
    run_id: str
    execution_date: str
    try_number: int = 1
    operator: str | None = None
    owner: str | None = None

    error_message: str
    stack_trace: str | None = None
    log_url: str | None = None

    source_tables: list[str] = Field(default_factory=list)
    target_tables: list[str] = Field(default_factory=list)
    upstream_tasks: list[str] = Field(default_factory=list)
    downstream_tasks: list[str] = Field(default_factory=list)

    source_system: str = "airflow"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class NormalizedIncident(BaseModel):
    incident_id: str
    event_id: str

    dag_id: str
    task_id: str
    run_id: str
    execution_date: str
    owner: str | None = None

    failure_category: str
    failure_fingerprint: str
    normalized_error: str
    raw_error: str

    source_tables: list[str] = Field(default_factory=list)
    target_tables: list[str] = Field(default_factory=list)

    severity: str = "medium"
    status: str = "OPEN"

    likely_root_cause: str | None = None
    recommended_fix: str | None = None
    rejected_fix_warning: str | None = None


class HistoricalIncident(BaseModel):
    incident_id: str
    date: str
    dag_id: str
    task_id: str
    failure_category: str
    error_message: str
    normalized_error: str
    failure_fingerprint: str

    root_cause: str
    accepted_fix: str
    rejected_fixes: list[str] = Field(default_factory=list)
    prevention: str | None = None

    owner: str | None = None
    source_tables: list[str] = Field(default_factory=list)
    target_tables: list[str] = Field(default_factory=list)
    related_runbook: str | None = None


class SimilarIncidentMatch(BaseModel):
    incident_id: str
    similarity_score: float
    reason: str
    historical_incident: HistoricalIncident


class IncidentAdvice(BaseModel):
    summary: str
    likely_root_cause: str
    confidence: float
    recommended_fix: str
    rejected_fix_warning: str | None = None
    recommended_next_steps: list[str] = Field(default_factory=list)
    prevention: str | None = None


class ProcessedIncidentResult(BaseModel):
    incident: NormalizedIncident
    similar_incidents: list[SimilarIncidentMatch]
    advice: IncidentAdvice
    cognee_recall_text: str | None = None
    wiki_paths: list[str] = Field(default_factory=list)
    status: str = "PROCESSED"


class DagMetadata(BaseModel):
    owner: str
    schedule: str
    criticality: str
    business_impact: str
    tasks: list[str] = Field(default_factory=list)
    source_tables: list[str] = Field(default_factory=list)
    target_tables: list[str] = Field(default_factory=list)
    downstream_assets: list[str] = Field(default_factory=list)
