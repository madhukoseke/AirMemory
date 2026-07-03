# Failure Pattern: row_count_mismatch

## Description

Known Airflow failure pattern `row_count_mismatch` captured by AirMemory.

## Symptoms

- row count mismatch between source and target

## Common Root Causes

- Late-arriving source records landed after the initial transformation completed.

## Best Known Fixes

- Wait for source completion marker and rerun validation after upstream load completes.

## Rejected Fixes

- Lowering the validation threshold
- Ignoring the mismatch because the difference looked small

## Related Incidents

- inc_2026_05_29_payment_settlement_row_count_mismatch (2026-05-29)

## Prevention

Use a completion marker sensor and compare counts after source load finalization.
