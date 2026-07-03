# DAG: payment_settlement_dag

Owner: payments-data-team  
Criticality: high  
Schedule: 0 6 * * *  

## Business Impact

Delays payment settlement reconciliation and merchant payout readiness.

## Tasks

- extract_settlement
- transform_settlement
- validate_settlement_count
- publish_settlement

## Source Tables

- raw.payment_settlement

## Target Tables

- mart.payment_settlement_fact

## Recent Incidents

- inc_2026_05_29_payment_settlement_row_count_mismatch (2026-05-29) - row_count_mismatch

## Common Failure Patterns

- row_count_mismatch

## Known Fixes

- Wait for source completion marker and rerun validation after upstream load completes.
