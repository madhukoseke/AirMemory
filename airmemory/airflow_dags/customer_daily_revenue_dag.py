from __future__ import annotations

from datetime import datetime

from airmemory.ingestion.airflow_callback import airmemory_failure_callback


def fail_missing_partition() -> None:
    raise Exception("BigQuery error: partition 2026-07-01 not found in raw.customer_transactions")


try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator

    with DAG(
        dag_id="customer_daily_revenue_dag",
        start_date=datetime(2026, 7, 1),
        schedule="@daily",
        catchup=False,
        on_failure_callback=airmemory_failure_callback,
        tags=["airmemory-demo"],
    ) as dag:
        transform_revenue = PythonOperator(
            task_id="transform_revenue",
            python_callable=fail_missing_partition,
            on_failure_callback=airmemory_failure_callback,
        )
except Exception:
    dag = None
