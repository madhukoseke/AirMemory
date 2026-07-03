# DAG: merchant_payout_dag

Owner: merchant-data-team  
Criticality: high  
Schedule: 30 6 * * *  

## Business Impact

Delays merchant payout reporting.

## Tasks

- connect_to_bank_sftp
- load_payout_file
- validate_payout
- publish_payout

## Source Tables

- raw.merchant_payout_file

## Target Tables

- mart.merchant_payout

## Recent Incidents

- inc_2026_05_03_merchant_payout_schema_drift (2026-05-03) - schema_drift
- inc_2026_02_18_payout_credentials_expired (2026-02-18) - credential_expired

## Common Failure Patterns

- credential_expired
- schema_drift

## Known Fixes

- Update schema mapping and add a contract validation check before loading.
- Rotate key, update secret, and rerun from connect_to_bank_sftp.
