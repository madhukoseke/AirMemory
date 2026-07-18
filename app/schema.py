from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SourceKind = Literal["dag", "log", "incident", "runbook", "sql", "slack", "github"]


class Citation(BaseModel):
    id: str
    label: str
    source: SourceKind
    artifact_id: str
    excerpt: str
    facets: list[str] = Field(default_factory=list)
    url: str | None = None


class ResolutionRank(BaseModel):
    id: str
    title: str
    status: Literal["accepted", "rejected", "deprecated"]
    score: float
    rank: int
    citation_id: str


class GraphNode(BaseModel):
    id: str
    label: str
    kind: Literal["pipeline", "task", "table", "incident", "resolution"]
    status: str | None = None
    active: bool = False


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    active: bool = False


class GraphPath(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    explanation: str


class SeedResponse(BaseModel):
    remembered: int
    counts_by_source: dict[str, int]
    dataset: str
    cognee_enabled: bool


class RecallRequest(BaseModel):
    question: str
    dag_id: str | None = None
    task_id: str | None = None
    datasets: list[str] | None = None
    session_id: str | None = None
    vector_only: bool = False


class RecallResponse(BaseModel):
    answer: str
    citations: list[Citation]
    resolutions: list[ResolutionRank]
    graph_path: GraphPath | None = None
    vector_only_contrast: str | None = None


class ImproveRequest(BaseModel):
    incident_id: str
    feedback: str
    accepted_resolution: str
    feedback_alpha: float = 0.7


class ImproveResponse(BaseModel):
    incident_id: str
    rank_before: int
    rank_after: int
    score_before: float
    score_after: float
    session_id: str
    message: str


class ForgetRequest(BaseModel):
    target_dataset: str | None = None
    resolution_id: str | None = None
    reason: str


class ForgetResponse(BaseModel):
    removed: bool
    target: str
    leakage_check: int
    message: str


class RunbookRequest(BaseModel):
    dag_id: str
    task_id: str
    failure_summary: str


class RunbookResponse(BaseModel):
    markdown: str
    citations: list[Citation]


class EvalMetric(BaseModel):
    recall_at_1: float
    recall_at_3: float
    preferred_fix_first_rate: float


class EvalResponse(BaseModel):
    before: EvalMetric
    after: EvalMetric
    forget_leakage: int
    rows: list[dict[str, object]]
    results_path: str


class RuntimeSummary(BaseModel):
    queue_mode: str
    wiki_dir: str
    state_dir: str
    incident_count: int
    latest_incident_id: str | None = None
    latest_summary: str | None = None


class RuntimeEmitResponse(BaseModel):
    message_id: str
    dag_id: str
    task_id: str
    incident_id: str


class RuntimeIncidentList(BaseModel):
    incident_ids: list[str]


class RuntimeProcessResponse(BaseModel):
    processed: bool
    result: dict[str, object] | None = None
    formatted: str


class RuntimeAnalyzeRequest(BaseModel):
    log_text: str
    dag_id: str | None = None
    task_id: str | None = None
    run_id: str | None = None


class RuntimeAnalyzeResponse(BaseModel):
    processed: bool
    parsed: dict[str, object]
    result: dict[str, object] | None = None
    formatted: str

