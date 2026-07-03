# Failure Pattern: api_timeout

## Description

Known Airflow failure pattern `api_timeout` captured by AirMemory.

## Symptoms

- external api timeout

## Common Root Causes

- External API latency increased during provider maintenance.

## Best Known Fixes

- Retry after provider maintenance window and add exponential backoff.

## Rejected Fixes

- Reducing payload size without confirming provider status

## Related Incidents

- inc_2026_03_10_revenue_api_timeout (2026-03-10)

## Prevention

Add provider status check and exponential backoff.
