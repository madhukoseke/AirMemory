# Runbook — row_count_mismatch

## When to use

Airflow task fails with category `row_count_mismatch`, or Looker / metrics look stale after an upstream count check fails.

## Symptoms

- Source count ≠ target count for the same processing window
- `ROW_COUNT_MISMATCH` in task logs
- Downstream dashboards show incomplete or stale numbers

## Diagnosis

1. Read the failing task log — capture source table, target table, and counts
2. Check source freshness and late-arriving `processing_date` values
3. Walk lineage upstream if the paged task is downstream (e.g. `publish_metrics`)
4. Recall prior incidents with AirMemory before inventing a new fix

## Fix

1. Widen validation to `system_date - 3` … `system_date + 3` when late source data is expected
2. Rerun **only** `validate_row_counts` and `dq_reconciliation_check`
3. Unblock `publish_metrics` after validation passes

## Do not

- Clear / reload the full DAG (deprecated after INC-1029)
- Lower the validation threshold to “make it green”
- Rerun `publish_metrics` while counts still disagree

## Validation

1. Failed task completes
2. Source and target counts align for the window
3. Downstream report freshness recovers

## Related incidents

- [INC-1029](../incidents/inc_1029.md)
- [INC-DEMO-1041](../incidents/inc_demo_1041.md)
