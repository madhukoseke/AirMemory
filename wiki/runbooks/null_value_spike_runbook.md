# Runbook: null_value_spike

## When to Use

Use this runbook when an Airflow DAG fails with category `null_value_spike`.

## Symptoms

- null value spike in required field

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Rollback source mapping and rerun profile load.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add field-level anomaly alert and source contract check.

## Related Incidents

- inc_2026_03_28_customer_profile_null_explosion (2026-03-28)
