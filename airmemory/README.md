# AirMemory Package

This package contains the event-driven AirMemory runtime:

- `ingestion/`: Airflow callback and demo event builders
- `processing/`: normalizer, fingerprinting, similarity, pipeline, worker
- `cognee_layer/`: lazy Cognee wrappers with local markdown fallback
- `llm/`: fake and real advice generation
- `wiki/`: Markdown wiki writer
- `dashboard/`: Streamlit incident dashboard
- `airflow_dags/`: optional example DAGs
