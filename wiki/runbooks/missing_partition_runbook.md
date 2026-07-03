# Runbook: missing_partition

## When to Use

Use this runbook when an Airflow DAG fails with category `missing_partition`.

## Symptoms

- partition not found in raw.customer_transactions
- source table freshness check failed

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Check whether raw.customer_transactions has the required processing date partition.
2. Trigger or request an upstream backfill if the partition is missing.
3. Rerun customer_daily_revenue_dag from transform_revenue after the partition is available.
4. Add or verify an upstream partition sensor to prevent recurrence.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add an upstream partition availability sensor before transform_revenue.

## Related Incidents

- inc_2026_06_12_customer_revenue_missing_partition (2026-06-12)
- inc_2026_04_21_customer_revenue_late_source (2026-04-21)
