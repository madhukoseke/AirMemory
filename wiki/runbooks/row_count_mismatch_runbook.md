# Runbook: row_count_mismatch

## When to Use

Use this runbook when an Airflow DAG fails with category `row_count_mismatch`.

## Symptoms

- row count mismatch between source and target

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Wait for source completion marker and rerun validation after upstream load completes.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Use a completion marker sensor and compare counts after source load finalization.

## Related Incidents

- inc_2026_05_29_payment_settlement_row_count_mismatch (2026-05-29)
