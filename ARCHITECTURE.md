# Architecture

```text
Airflow artifacts
  DAG code, logs, incidents, runbooks, SQL, Slack, GitHub issues
        |
        v
Parser layer
  transcript-shaped docs + node_set facets
        |
        v
MemoryEngine
  CogneeAdapter: remember / recall / improve / forget
  Local mirror: deterministic ranks, citations, lineage, eval
        |
        v
FastAPI
  /seed /recall /improve /forget /runbook /graph /eval /health
        |
        v
Next.js instrument panel
  failure, recall, citations, lineage graph, runbook, improve, forget, eval
```

## Schema

Entities:

- `Pipeline`: Airflow DAG.
- `Task`: Airflow task.
- `Table`: lineage anchor.
- `Incident`: failure case.
- `RootCause`: diagnosed cause.
- `Resolution`: accepted, rejected, or deprecated fix.
- `Engineer`: owner or author.

Relationships:

- `Pipeline HAS_TASK Task`
- `Pipeline CONSUMES Table`
- `Pipeline PRODUCES Table`
- `Table DOWNSTREAM_OF Table`
- `Incident AFFECTS Task | Table | Pipeline`
- `Incident HAS_ROOT_CAUSE RootCause`
- `Incident RESOLVED_BY Resolution`
- `Resolution AUTHORED_BY Engineer`
- `Resolution SUPERSEDES Resolution`
- `Engineer EXPERT_IN Pipeline`

## Lineage Beat

The downstream symptom is `publish_metrics` / `bq.prod.customer_metrics`, where there is no semantically similar prior incident. AirMemory traverses:

```text
bq.prod.customer_metrics
  <- DOWNSTREAM_OF bq.prod.customer_master
  <- DOWNSTREAM_OF hana.customer_master
  <- prior incident INC-1029
```

This is the graph reasoning contrast: vector-only recall has no direct downstream incident, while lineage traversal finds the upstream root cause.

## Storage Modes

- Development: Cognee embedded defaults, with the deterministic local mirror always available for no-key local runs and tests.
- Production-like local storage: Postgres via `docker-compose.yml`, configured with Cognee `DB_PROVIDER=postgres`, `VECTOR_DB_PROVIDER=pgvector`, `GRAPH_DATABASE_PROVIDER=postgres`, and `CACHE_BACKEND=postgres`.
