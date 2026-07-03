# Runbook: credential_expired

## When to Use

Use this runbook when an Airflow DAG fails with category `credential_expired`.

## Symptoms

- credential expired for external connection

## Diagnosis Steps

1. Inspect the Airflow task log and confirm the exact failing input.
2. Check source table freshness, partitions, and completion markers.
3. Confirm whether target data was partially written before rerunning.

## Fix Steps

1. Rotate key, update secret, and rerun from connect_to_bank_sftp.

## Validation Steps

1. Confirm the failed task completes after rerun.
2. Validate source and target row counts for the processing window.
3. Check downstream dashboard or report freshness.

## Prevention

Add credential expiration monitoring and 14-day rotation alert.

## Related Incidents

- inc_2026_02_18_payout_credentials_expired (2026-02-18)
