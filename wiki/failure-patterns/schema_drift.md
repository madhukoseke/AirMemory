# Failure Pattern: schema_drift

## Description

Known Airflow failure pattern `schema_drift` captured by AirMemory.

## Symptoms

- column type changed in source file

## Common Root Causes

- Source system changed payout_status type without notifying downstream consumers.

## Best Known Fixes

- Update schema mapping and add a contract validation check before loading.

## Rejected Fixes

- Casting all columns to STRING without preserving business types

## Related Incidents

- inc_2026_05_03_merchant_payout_schema_drift (2026-05-03)

## Prevention

Add schema contract checks and alert the source owner before processing.
