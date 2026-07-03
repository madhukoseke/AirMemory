# Failure Pattern: missing_partition

## Description

Known Airflow failure pattern `missing_partition` captured by AirMemory.

## Symptoms

- partition not found in raw.customer_transactions
- source table freshness check failed

## Common Root Causes

- The upstream raw.customer_transactions partition was delayed and was not available when the DAG started.
- Upstream CDC job finished 48 minutes later than expected.

## Best Known Fixes

- Backfill the missing raw.customer_transactions partition and rerun the DAG from transform_revenue.
- Wait for CDC completion and rerun extract_transactions.

## Rejected Fixes

- Increasing retries without checking whether the upstream partition exists
- Skipping the partition validation step
- Manually inserting placeholder rows

## Related Incidents

- inc_2026_06_12_customer_revenue_missing_partition (2026-06-12)
- inc_2026_04_21_customer_revenue_late_source (2026-04-21)

## Prevention

Add an upstream partition availability sensor before transform_revenue.
