# Failure Pattern: duplicate_records

## Description

Known Airflow failure pattern `duplicate_records` captured by AirMemory.

## Symptoms

- duplicate business key detected

## Common Root Causes

- Upstream file was replayed twice due to retry behavior.

## Best Known Fixes

- Deduplicate by settlement_id, processing_date, and source_file_sequence.

## Rejected Fixes

- Dropping all duplicate records without sequence-based tie-breaker

## Related Incidents

- inc_2026_04_10_settlement_duplicate_records (2026-04-10)

## Prevention

Add idempotency check using source file manifest.
