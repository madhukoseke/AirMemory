# Failure Pattern: null_value_spike

## Description

Known Airflow failure pattern `null_value_spike` captured by AirMemory.

## Symptoms

- null value spike in required field

## Common Root Causes

- A source mapping change stopped populating email_address.

## Best Known Fixes

- Rollback source mapping and rerun profile load.

## Rejected Fixes

- Relaxing the null threshold without source owner approval

## Related Incidents

- inc_2026_03_28_customer_profile_null_explosion (2026-03-28)

## Prevention

Add field-level anomaly alert and source contract check.
