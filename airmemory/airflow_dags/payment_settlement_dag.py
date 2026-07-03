from __future__ import annotations

from datetime import datetime

from airmemory.ingestion.airflow_callback import airmemory_failure_callback


def validate_settlement_count() -> None:
    raise Exception("Row count mismatch: source count 120034, target count 119981")


try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator

    with DAG(
        dag_id="payment_settlement_dag",
        start_date=datetime(2026, 7, 1),
        schedule="@daily",
        catchup=False,
        on_failure_callback=airmemory_failure_callback,
        tags=["airmemory-demo"],
    ) as dag:
        validate_settlement_count_task = PythonOperator(
            task_id="validate_settlement_count",
            python_callable=validate_settlement_count,
            on_failure_callback=airmemory_failure_callback,
        )
except Exception:
    dag = None
