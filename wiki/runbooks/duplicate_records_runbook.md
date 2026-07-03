# Runbook: duplicate_records

## When to Use

Use this runbook when an Airflow DAG fails with category `duplicate_records`.

## Symptoms

- duplicate business key detected

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Deduplicate by settlement_id, processing_date, and source_file_sequence.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add idempotency check using source file manifest.

## Related Incidents

- inc_2026_04_10_settlement_duplicate_records (2026-04-10)
