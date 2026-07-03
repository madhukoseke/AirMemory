# Runbook: schema_drift

## When to Use

Use this runbook when an Airflow DAG fails with category `schema_drift`.

## Symptoms

- column type changed in source file

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Update schema mapping and add a contract validation check before loading.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add schema contract checks and alert the source owner before processing.

## Related Incidents

- inc_2026_05_03_merchant_payout_schema_drift (2026-05-03)
