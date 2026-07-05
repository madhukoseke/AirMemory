# Incident: customer_daily_revenue_dag / transform_revenue

Status: OPEN  
Incident ID: inc_2026_07_01_customer_daily_revenue_dag_transform_revenue_missing_partition  
Failure Category: missing_partition  
Fingerprint: `missing_partition|customer_daily_revenue_dag|transform_revenue|raw.customer_transactions`  
Owner: revenue-data-team  
Confidence: 0.91  

## What Happened

The transform_revenue task failed because the required source partition was missing from raw.customer_transactions.

## Raw Error

```text
BigQuery error: partition 2026-07-01 not found in raw.customer_transactions
```

## Likely Root Cause

The upstream raw.customer_transactions partition was not available when the DAG started.

## Similar Incidents

- `inc_2026_06_12_customer_revenue_missing_partition` - 1.00: Same failure category, same DAG, same task, same source table raw.customer_transactions, overlapping normalized error keywords.
- `inc_2026_04_21_customer_revenue_late_source` - 0.60: Upstream lineage overlap at raw.customer_transactions.
- `inc_2026_02_18_payout_credentials_expired` - 0.45: Lineage-linked DAG merchant_payout_dag.

## Accepted Fix From Previous Incident

Backfill the missing raw.customer_transactions partition and rerun the DAG from transform_revenue.

## Rejected Fixes / What Not To Repeat

- Increasing retries alone did not solve this pattern in a previous incident.
- Increasing retries without checking whether the upstream partition exists
- Skipping the partition validation step

## Recommended Next Steps

1. Check whether raw.customer_transactions has the required processing date partition.
2. Trigger or request an upstream backfill if the partition is missing.
3. Rerun customer_daily_revenue_dag from transform_revenue after the partition is available.
4. Add or verify an upstream partition sensor to prevent recurrence.

## Prevention

Add an upstream partition availability sensor before transform_revenue.

## Source Tables

- raw.customer_transactions

## Target Tables

- mart.customer_daily_revenue

## Cognee Recall Evidence

```text
Local Cognee fallback: deterministic AirMemory matching supplied the historical incident evidence. Install and configure Cognee to enable graph/vector recall.
```
