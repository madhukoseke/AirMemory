# AirMemory

AirMemory is a memory layer for Apache Airflow operations. It stores incident history, root causes, accepted fixes, deprecated workarounds, ownership, provenance, and table lineage so recurring data pipeline failures can be resolved with prior operational context instead of starting from raw logs every time.

The project combines a FastAPI backend, a Cognee-backed memory adapter, and a Next.js instrument panel for incident recall, lineage reasoning, runbook generation, feedback-driven ranking, and governance-safe forgetting.

## Capabilities

- Ingest Airflow artifacts into transcript-shaped memory records with structured `node_set` facets.
- Recall prior failures with citations from incidents, runbooks, SQL, Slack-style threads, logs, DAG code, and cached GitHub issues.
- Traverse lineage from downstream symptoms back to upstream tables and incidents.
- Generate cited runbooks for common recovery paths.
- Apply engineer feedback through `improve(feedback_alpha=0.7)` and surface before/after rank changes.
- Remove deprecated workarounds through dataset-scoped `forget()` and verify zero leakage.
- Run a deterministic evaluation harness for cold versus improved retrieval quality.

## Architecture

```text
Airflow artifacts
  DAG code, logs, incidents, runbooks, SQL, chat threads, issue snapshots
        |
        v
Parser layer
  transcript-shaped docs + node_set facets
        |
        v
MemoryEngine
  CogneeAdapter: remember / recall / improve / forget
  Local mirror: deterministic ranks, citations, lineage, evaluation
        |
        v
FastAPI
  /seed /recall /improve /forget /runbook /graph /eval /health
        |
        v
Next.js UI
  current failure, recall, citations, lineage graph, runbook, feedback, governance, metrics
```

Cognee integration is isolated in `app/memory.py`. The deterministic local mirror keeps the project usable for local development and tests without API keys. Set `AIRMEMORY_USE_REAL_COGNEE=1` and `LLM_API_KEY` to send ingestion and feedback operations through Cognee.

## Repository Layout

```text
app/                 FastAPI service, memory adapter, parsers, graph helpers
data/                sample operational corpus
eval/                holdout set and evaluation runner
web/                 Next.js App Router UI
mcp/                 lightweight helper functions for assistant integrations
tests/               backend lifecycle tests
docker-compose.yml   local Postgres storage option
```

## Requirements

- Python 3.11+
- Node.js 20.19+, 22.13+, or 24+
- npm
- Optional: Docker for local Postgres storage
- Optional: `LLM_API_KEY` for live Cognee-backed memory operations

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd web
npm install
cd ..
```

Copy environment defaults if you want to customize local settings:

```bash
cp .env.example .env
```

## Run Locally

Start the API:

```bash
make api
```

Start the web UI in another terminal:

```bash
make web
```

Open `http://127.0.0.1:3000`.

Seed the sample corpus:

```bash
make seed
```

Run evaluation:

```bash
make eval
```

## API

- `GET /health`
- `POST /seed`
- `POST /recall`
- `POST /improve`
- `POST /forget`
- `POST /runbook`
- `GET /graph`
- `POST /eval`

## Storage Modes

Embedded mode is the default and works without external infrastructure.

For a local Postgres-backed setup:

```bash
docker compose up
```

Then configure:

```bash
DB_PROVIDER=postgres
VECTOR_DB_PROVIDER=pgvector
GRAPH_DATABASE_PROVIDER=postgres
CACHE_BACKEND=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=cognee
DB_PASSWORD=cognee
DB_NAME=cognee_db
```

## Validation

```bash
pytest
cd web && npm run lint && npm run build
```

The deterministic evaluation writes `eval/results.json` and reports:

- cold recall@1
- improved recall@1 after feedback
- recall@3
- deprecated-workaround leakage

## Configuration

Key environment variables:

```bash
AIRMEMORY_USE_REAL_COGNEE=0
AIRMEMORY_DATASET=airmemory
AIRMEMORY_DEPRECATED_DATASET=airmemory_deprecated_full_dag_clear
AIRMEMORY_STORAGE_MODE=embedded
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
LLM_API_KEY=sk-your-openai-compatible-key
```

## Safety Notes

AirMemory treats runbook recommendations as operational guidance with provenance, not as autonomous production actions. Keep destructive Airflow operations behind human review, and prefer narrow rerun scopes over broad DAG clears unless the cited incident history supports it.
