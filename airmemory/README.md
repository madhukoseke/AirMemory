# AirMemory package

Event-driven runtime for Airflow failures. See the [main README](../README.md) for setup, diagrams, and Cognee examples.

## What's in here

| Folder | Does what |
|--------|-----------|
| `ingestion/` | Airflow callbacks, demo emitters |
| `processing/` | Normalize, fingerprint, similarity, lineage, worker |
| `cognee_layer/` | `remember` / `recall` / `improve` wrappers |
| `llm/` | Fake and real advice generation |
| `wiki/` | Writes markdown to `wiki/` |
| `dashboard/` | Streamlit incident inbox |

## Cognee hooks the worker calls

```python
from airmemory.cognee_layer.recall import build_recall_query, recall_similar_incidents
from airmemory.cognee_layer.remember import remember_incident_markdown
from airmemory.cognee_layer.improve import improve_memory

query = build_recall_query(incident)
evidence = await recall_similar_incidents(query, dataset_name="airmemory_demo")
await remember_incident_markdown(incident_markdown, dataset_name="airmemory_demo")
await improve_memory("airmemory_demo", incident_id="INC-1029", feedback="Fix confirmed")
```
