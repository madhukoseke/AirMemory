# DAG: external_revenue_api_dag

Owner: revenue-integrations-team  
Criticality: medium  
Schedule: 0 * * * *  

## Business Impact

Delays external revenue reconciliation inputs.

## Tasks

- fetch_api_payload
- validate_api_payload
- publish_api_payload

## Source Tables

- api.external_revenue

## Target Tables

- raw.external_revenue_payload

## Recent Incidents

- inc_2026_03_10_revenue_api_timeout (2026-03-10) - api_timeout

## Common Failure Patterns

- api_timeout

## Known Fixes

- Retry after provider maintenance window and add exponential backoff.
