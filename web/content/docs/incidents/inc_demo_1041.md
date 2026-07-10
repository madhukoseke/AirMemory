# INC-DEMO-1041 — Live demo failure

Status: OPEN  
Incident ID: `INC-DEMO-1041`  
DAG: `customer_daily_migration_dag`  
Task: `validate_row_counts`  
Failure category: `row_count_mismatch`  
Owner: on-call  
Confidence: 0.78  

## Summary

Demo-emitted failure matching the INC-1029 pattern. AirMemory recalls the historical fix and ranks the windowed validation resolution first after improve feedback.

## What Happened

Emitted via the Runtime / Dashboard **Emit failure** action in demo mode. Same fingerprint as INC-1029: HANA vs BigQuery row-count mismatch on `customer_master`.

## Root Cause

Same as INC-1029 — exact `processing_date = system_date` missed late HANA records.

## Recommended Fix

Widen processing_date to `system_date ± 3`, then rerun `validate_row_counts` and `dq_reconciliation_check` only.

## Closest Match

- `INC-1029` — similarity 0.93 — same failure category and upstream table via lineage

## Next Steps

1. Confirm counts for the processing window
2. Apply ±3 day window
3. Rerun validation tasks only
4. Confirm Looker `customer_metrics` freshness

## Related

- Historical write-up: [INC-1029](./inc_1029.md)
- Runbook: [row_count_mismatch](../runbooks/row_count_mismatch.md)
