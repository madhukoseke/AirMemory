# DAG: settlement_recon_dag

Owner: payments-data-team  
Criticality: medium  
Schedule: 15 6 * * *  

## Business Impact

Delays settlement reconciliation exception reporting.

## Tasks

- extract_settlement_file
- dedupe_settlement_records
- publish_recon

## Source Tables

- raw.settlement_file

## Target Tables

- mart.settlement_recon

## Recent Incidents

- inc_2026_04_10_settlement_duplicate_records (2026-04-10) - duplicate_records

## Common Failure Patterns

- duplicate_records

## Known Fixes

- Deduplicate by settlement_id, processing_date, and source_file_sequence.
