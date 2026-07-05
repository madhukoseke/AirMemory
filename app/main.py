from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.forget import forget_memory
from app.improve import improve_memory
from app.memory import MemoryEngine
from app.recall import recall_memory
from app.runbook import generate_runbook
from app.runtime import (
    emit_demo_failure,
    fetch_runtime_incident,
    format_runtime_process_output,
    list_runtime_incidents,
    process_next_failure,
    runtime_summary,
)
from app.schema import (
    EvalResponse,
    ForgetRequest,
    ForgetResponse,
    GraphPath,
    ImproveRequest,
    ImproveResponse,
    RecallRequest,
    RecallResponse,
    RunbookRequest,
    RunbookResponse,
    RuntimeEmitResponse,
    RuntimeIncidentList,
    RuntimeProcessResponse,
    RuntimeSummary,
    SeedResponse,
)


settings = Settings.from_env()
memory_engine = MemoryEngine(settings)

app = FastAPI(title="AirMemory", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):(3000|3001|3002)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "backend": "cognee",
        "storage": settings.storage_mode,
        "cognee_enabled": memory_engine.adapter.enabled,
    }


@app.post("/seed", response_model=SeedResponse)
async def seed() -> SeedResponse:
    return await memory_engine.seed()


@app.post("/recall", response_model=RecallResponse)
async def recall(request: RecallRequest) -> RecallResponse:
    return await recall_memory(memory_engine, request)


@app.post("/improve", response_model=ImproveResponse)
async def improve(request: ImproveRequest) -> ImproveResponse:
    return await improve_memory(memory_engine, request)


@app.post("/forget", response_model=ForgetResponse)
async def forget(request: ForgetRequest) -> ForgetResponse:
    return await forget_memory(memory_engine, request)


@app.post("/runbook", response_model=RunbookResponse)
async def runbook(request: RunbookRequest) -> RunbookResponse:
    return await generate_runbook(memory_engine, request)


@app.get("/graph", response_model=GraphPath)
async def graph(
    dag_id: str = Query(default="customer_daily_migration_dag"),
    table: str = Query(default="bq.prod.customer_metrics"),
) -> GraphPath:
    _ = (dag_id, table)
    await memory_engine.ensure_seeded()
    return memory_engine.graph()


@app.post("/eval", response_model=EvalResponse)
async def evaluate() -> EvalResponse:
    return await memory_engine.evaluate()


@app.get("/runtime/summary", response_model=RuntimeSummary)
async def runtime_status() -> RuntimeSummary:
    return RuntimeSummary.model_validate(runtime_summary())


@app.get("/runtime/incidents", response_model=RuntimeIncidentList)
async def runtime_incidents() -> RuntimeIncidentList:
    return RuntimeIncidentList(incident_ids=list_runtime_incidents())


@app.get("/runtime/incidents/{incident_id}")
async def runtime_incident(incident_id: str) -> dict[str, object]:
    result = fetch_runtime_incident(incident_id)
    if result is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return result


@app.post("/runtime/emit", response_model=RuntimeEmitResponse)
async def runtime_emit() -> RuntimeEmitResponse:
    return RuntimeEmitResponse.model_validate(emit_demo_failure())


@app.post("/runtime/process", response_model=RuntimeProcessResponse)
async def runtime_process() -> RuntimeProcessResponse:
    result = await process_next_failure()
    return RuntimeProcessResponse(
        processed=result is not None,
        result=result,
        formatted=format_runtime_process_output(result),
    )
