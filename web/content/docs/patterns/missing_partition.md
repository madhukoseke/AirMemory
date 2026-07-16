# Pattern — missing_partition

## Description

A required source partition is absent when a transform or load starts. Common on daily warehouse DAGs that assume yesterday’s partition already landed.

## Common root causes

- Upstream load delayed or failed
- DAG schedule starts before source completion
- Wrong processing-date partition requested

## Best known fix

Confirm or backfill the missing partition, then rerun from the failed task only.

## Rejected approaches

- Increasing retries without checking partition existence
- Skipping partition sensors

## Canonical incident

[INC-2026-0701](../incidents/inc_2026_07_01_missing_partition.md)

## Prevention

Add an upstream partition / completion-marker sensor before the transform.
