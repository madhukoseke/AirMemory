# Runbook — missing_partition

## When to use

A transform or load fails because a required source partition is absent.

## Symptoms

- BigQuery / warehouse error: partition not found
- Task fails early in the DAG before writing targets

## Diagnosis

1. Confirm the expected processing date partition on the source table
2. Check upstream load completion markers
3. Recall prior missing_partition incidents for the same DAG/table

## Fix

1. Backfill or wait for the missing source partition
2. Rerun from the failed task only
3. Verify target table freshness

## Do not

- Blindly increase retries
- Skip partition validation sensors

## Related incidents

- [INC-2026-0701](../incidents/inc_2026_07_01_missing_partition.md)
