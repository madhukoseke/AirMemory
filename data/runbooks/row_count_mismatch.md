# Runbook: customer row count mismatch

[runbook@acme.com, 2026-06-20T04:10] If validate_row_counts fails on customer_daily_migration_dag, compare hana.customer_master against bq.prod.customer_master.
[runbook@acme.com, 2026-06-20T04:11] Accepted fix: run the validation SQL with processing_date from system_date - 3 through system_date + 3.
[runbook@acme.com, 2026-06-20T04:12] Exclude already matched records before comparing source and target counts.
[runbook@acme.com, 2026-06-20T04:13] Rerun validate_row_counts and dq_reconciliation_check only.
[runbook@acme.com, 2026-06-20T04:14] Hold publish_metrics until validation passes and the reconciliation check is green.

## Deprecated section

[runbook@acme.com, 2026-06-18T02:00] Deprecated: clear the full DAG and rerun every task. This is unsafe because downstream BigQuery tables are incremental.

