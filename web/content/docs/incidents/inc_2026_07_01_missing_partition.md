# INC-2026-0701 — Missing partition

Status: OPEN  
Incident ID: `inc_2026_07_01_customer_daily_revenue_dag_transform_revenue_missing_partition`  
DAG: `customer_daily_revenue_dag`  
Task: `transform_revenue`  
Failure category: `missing_partition`  
Owner: revenue-data-team  
Confidence: 0.91  

## Summary

`transform_revenue` failed because the required source partition was missing from `raw.customer_transactions`. Downstream `mart.customer_daily_revenue` did not refresh.

## What Happened

```text
BigQuery error: partition 2026-07-01 not found in raw.customer_transactions
```

## Root Cause

The upstream `raw.customer_transactions` partition was not available when the DAG started.

## Accepted Fix

Backfill the missing `raw.customer_transactions` partition and rerun the DAG from `transform_revenue`.

## Rejected Fixes

- Increasing retries alone without checking whether the upstream partition exists
- Skipping the partition validation step

## Next Steps

1. Check whether `raw.customer_transactions` has the required processing-date partition
2. Trigger or request an upstream backfill if missing
3. Rerun `customer_daily_revenue_dag` from `transform_revenue`
4. Add or verify an upstream partition sensor

## Related

- Pattern: missing_partition
- Runbook: wait for partition / backfill then scoped rerun
