# Pattern — row_count_mismatch

## Description

Source and target row counts disagree for a processing window. Often surfaces on a validation task, but the on-call page may land on a downstream publisher or BI refresh.

## Common root causes

- Exact-date filters miss late-arriving source records
- Upstream load still running when validation starts
- Partial target write before rerun

## Best known fix

Windowed date validation (`system_date ± N`) plus scoped rerun of validation tasks only.

## Rejected approaches

- Full DAG clear / reload on incremental tables
- Ignoring small diffs without lineage review
- Blindly increasing retries

## Canonical incident

[INC-1029](../incidents/inc_1029.md)

## Prevention

- Completion-marker / partition sensors before validation
- Windowed comparisons for late sources
- Gate publishers on validation success
