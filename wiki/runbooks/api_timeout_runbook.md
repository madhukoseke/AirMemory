# Runbook: api_timeout

## When to Use

Use this runbook when an Airflow DAG fails with category `api_timeout`.

## Symptoms

- external api timeout

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Retry after provider maintenance window and add exponential backoff.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add provider status check and exponential backoff.

## Related Incidents

- inc_2026_03_10_revenue_api_timeout (2026-03-10)
