# Failure Pattern: late_source_data

## Description

Known Airflow failure pattern `late_source_data` captured by AirMemory.

## Symptoms

- source table freshness check failed

## Common Root Causes

- Upstream CDC job finished 48 minutes later than expected.

## Best Known Fixes

- Wait for CDC completion and rerun extract_transactions.

## Rejected Fixes

- Manually inserting placeholder rows

## Related Incidents

- inc_2026_04_21_customer_revenue_late_source (2026-04-21)

## Prevention

Add source freshness sensor and route alert to upstream owner.
