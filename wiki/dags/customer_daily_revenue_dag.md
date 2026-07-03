# DAG: customer_daily_revenue_dag

Owner: revenue-data-team  
Criticality: high  
Schedule: 0 5 * * *  

## Business Impact

Delays customer revenue dashboard and daily executive revenue reporting.

## Tasks

- extract_transactions
- transform_revenue
- validate_revenue
- publish_revenue

## Source Tables

- raw.customer_transactions
- raw.customer_profiles

## Target Tables

- mart.customer_daily_revenue

## Recent Incidents

- [inc_2026_07_01_customer_daily_revenue_dag_transform_revenue_missing_partition](../incidents/inc_2026_07_01_customer_daily_revenue_dag_transform_revenue_missing_partition.md)
- inc_2026_06_12_customer_revenue_missing_partition (2026-06-12) - missing_partition
- inc_2026_04_21_customer_revenue_late_source (2026-04-21) - late_source_data

## Common Failure Patterns

- late_source_data
- missing_partition

## Known Fixes

- Backfill the missing raw.customer_transactions partition and rerun the DAG from transform_revenue.
- Wait for CDC completion and rerun extract_transactions.
