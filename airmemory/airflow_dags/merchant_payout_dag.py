from __future__ import annotations

from datetime import datetime

from airmemory.ingestion.airflow_callback import airmemory_failure_callback


def load_payout_file() -> None:
    raise Exception("Column payout_status expected STRING but received INT64")


try:
    from airflow import DAG
    from airflow.operators.python import PythonOperator

    with DAG(
        dag_id="merchant_payout_dag",
        start_date=datetime(2026, 7, 1),
        schedule="@daily",
        catchup=False,
        on_failure_callback=airmemory_failure_callback,
        tags=["airmemory-demo"],
    ) as dag:
        load_payout_file_task = PythonOperator(
            task_id="load_payout_file",
            python_callable=load_payout_file,
            on_failure_callback=airmemory_failure_callback,
        )
except Exception:
    dag = None
