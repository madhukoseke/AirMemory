from __future__ import annotations

import uuid
from datetime import datetime, timezone

from airmemory.config import settings
from airmemory.models import AirflowFailureEvent


def build_demo_failure_event() -> AirflowFailureEvent:
    demo_date = settings.demo_date
    return AirflowFailureEvent(
        event_id=f"evt_{uuid.uuid4().hex[:8]}",
        event_type="task_failed",
        dag_id="customer_daily_revenue_dag",
        task_id="transform_revenue",
        run_id=f"scheduled__{demo_date}",
        execution_date=f"{demo_date}T00:00:00Z",
        try_number=1,
        operator="BigQueryInsertJobOperator",
        owner="revenue-data-team",
        error_message=f"BigQuery error: partition {demo_date} not found in raw.customer_transactions",
        stack_trace=f"google.api_core.exceptions.NotFound: partition {demo_date} not found",
        log_url="http://localhost:8080/log/customer_daily_revenue_dag/transform_revenue",
        source_tables=["raw.customer_transactions"],
        target_tables=["mart.customer_daily_revenue"],
        upstream_tasks=["extract_transactions"],
        downstream_tasks=["validate_revenue", "publish_revenue"],
        source_system="demo",
        created_at=datetime.now(timezone.utc),
    )
