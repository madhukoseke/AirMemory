# AirMemory

Airflow has logs. AirMemory gives it memory.

AirMemory is a memory layer for Apache Airflow operations. It captures task failures, recalls similar historical incidents with Cognee-compatible memory, recommends known fixes, warns about rejected fixes, and updates a human-readable operational wiki.

## What It Does

- Captures Airflow failure events from callbacks or a demo emitter.
- Queues failures through Redis Streams, with a local JSONL queue fallback for offline runs.
- Normalizes failures into deterministic categories and fingerprints.
- Finds similar historical incidents without relying only on embeddings.
- Uses Cognee wrappers for remember/recall, with local markdown fallback when Cognee is unavailable.
- Generates incident advice through a deterministic fake LLM path unless a real LLM is configured.
- Writes incident, DAG, failure-pattern, runbook, index, and log pages into `wiki/`.
- Exposes a Streamlit incident dashboard and the existing FastAPI/Next instrument panel.

## Architecture

```text
Airflow failure or demo emitter
        |
        v
Redis Stream or local queue
        |
        v
AirMemory worker
  normalize -> fingerprint -> deterministic similarity
  -> Cognee recall -> advice generation -> wiki update
  -> Cognee remember -> dashboard state
```

Cognee is the long-term memory layer. Redis is the real-time event and dashboard-state layer. Markdown is the human-readable operating memory.

## Quickstart

```bash
cp .env.example .env
python scripts/seed_memory.py
python scripts/emit_demo_failure.py
python scripts/run_worker.py --once
streamlit run airmemory/dashboard/app.py
```

The default configuration uses a local queue and fake LLM output, so the demo works without Redis, Airflow, Cognee, or an API key.

For Redis-backed ingestion:

```bash
docker compose up -d redis
AIRMEMORY_USE_LOCAL_QUEUE=0 python scripts/emit_demo_failure.py
AIRMEMORY_USE_LOCAL_QUEUE=0 python scripts/run_worker.py --once
```

## Demo

```bash
./scripts/run_demo.sh
```

The demo resets local state, seeds eight historical incidents, emits a missing-partition failure for `customer_daily_revenue_dag`, processes one event, recalls the June 12 matching incident, writes wiki pages, and prints the recommendation.

## Existing Web App

The repository also includes a FastAPI backend and a Next.js interface:

```bash
make api
make web
```

Open `http://127.0.0.1:3000`.

The instrument panel now includes a **Runtime** view that connects to the live worker queue through `/runtime/*` API endpoints.

## Core Commands

```bash
make seed-memory
make emit
make worker
make demo
make dashboard
make test
```

## Project Layout

```text
airmemory/          event ingestion, worker, Cognee adapters, wiki, dashboard
app/                FastAPI service and deterministic memory engine
web/                Next.js instrument panel
seed_data/          historical incidents, DAG metadata, lineage, runbooks
scripts/            seed, emit, worker, reset, dashboard, demo commands
wiki/               generated operational memory pages
tests/              backend and AirMemory pipeline tests
```

## Configuration

Important environment variables:

```bash
AIRMEMORY_USE_LOCAL_QUEUE=1
AIRMEMORY_USE_FAKE_LLM=true
AIRMEMORY_DATASET=airmemory_demo
AIRMEMORY_WIKI_DIR=./wiki
REDIS_URL=redis://localhost:6379/0
COGNEE_DATASET=airmemory_demo
LLM_API_KEY=
```

Set `AIRMEMORY_USE_LOCAL_QUEUE=0` to use Redis. Set `AIRMEMORY_USE_FAKE_LLM=false` and provide `LLM_API_KEY` to use real LLM advice.

## Validation

```bash
python3 -m compileall airmemory app scripts tests
pytest
./scripts/run_demo.sh
cd web && npm run lint && npm run build
```

## Safety

AirMemory produces operational recommendations, not autonomous production actions. Keep destructive Airflow operations behind human review, validate source readiness before reruns, and record rejected fixes so the team does not repeat them.
