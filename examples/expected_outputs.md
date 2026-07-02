# Expected Outputs

## Seed

```json
{
  "remembered": 10,
  "counts_by_source": {
    "dag": 1,
    "log": 1,
    "incident": 1,
    "runbook": 2,
    "sql": 1,
    "slack": 1,
    "github": 3
  },
  "dataset": "airmemory",
  "cognee_enabled": false
}
```

## Recall

Expected answer mentions:

- INC-1029
- exact `processing_date = system_date` root cause
- `system_date - 3` through `system_date + 3`
- rerun `validate_row_counts` and `dq_reconciliation_check` only
- citations from postmortem, runbook, SQL, and Slack

## Improve

```json
{
  "incident_id": "INC-1029",
  "rank_before": 2,
  "rank_after": 1,
  "session_id": "incident_INC-1029"
}
```

## Forget

```json
{
  "removed": true,
  "target": "airmemory_deprecated_full_dag_clear",
  "leakage_check": 0
}
```

## Eval

Cold top-1 is `0%`, warm top-1 is `100%`, and deprecated-workaround leakage is `0`.
