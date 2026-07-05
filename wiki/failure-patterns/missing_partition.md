# Failure Pattern: missing_partition

## Description

Known Airflow failure pattern `missing_partition` captured by AirMemory.

## Symptoms

- partition not found in raw.customer_transactions
- source table freshness check failed
- credential expired for external connection

## Common Root Causes

- The upstream raw.customer_transactions partition was delayed and was not available when the DAG started.
- Upstream CDC job finished 48 minutes later than expected.
- SFTP key rotation reminder was missed.

## Best Known Fixes

- Backfill the missing raw.customer_transactions partition and rerun the DAG from transform_revenue.
- Wait for CDC completion and rerun extract_transactions.
- Rotate key, update secret, and rerun from connect_to_bank_sftp.

## Rejected Fixes

- Increasing retries without checking whether the upstream partition exists
- Skipping the partition validation step
- Manually inserting placeholder rows
- Disabling SFTP validation

## Related Incidents

- inc_2026_06_12_customer_revenue_missing_partition (2026-06-12)
- inc_2026_04_21_customer_revenue_late_source (2026-04-21)
- inc_2026_02_18_payout_credentials_expired (2026-02-18)

## Prevention

Add an upstream partition availability sensor before transform_revenue.
