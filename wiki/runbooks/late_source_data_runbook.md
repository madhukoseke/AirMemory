# Runbook: late_source_data

## When to Use

Use this runbook when an Airflow DAG fails with category `late_source_data`.

## Symptoms

- source table freshness check failed

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Wait for CDC completion and rerun extract_transactions.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add source freshness sensor and route alert to upstream owner.

## Related Incidents

- inc_2026_04_21_customer_revenue_late_source (2026-04-21)
