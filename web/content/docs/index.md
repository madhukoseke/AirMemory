# AirMemory docs

Markdown memory for incidents, root causes, fixes, and runbooks.

## Incidents

- [INC-1029 — Row count mismatch](incidents/inc_1029.md)
- [INC-DEMO-1041 — Live demo failure](incidents/inc_demo_1041.md)
- [INC-2026-0701 — Missing partition](incidents/inc_2026_07_01_missing_partition.md)

## Runbooks

- [row_count_mismatch](runbooks/row_count_mismatch.md)
- [missing_partition](runbooks/missing_partition.md)

## Failure patterns

- [row_count_mismatch](patterns/row_count_mismatch.md)

## How to add a doc

1. Add a `.md` file under `web/content/docs/{incidents,runbooks,patterns}/`
2. Register it in `web/lib/docs.ts`
3. Keep sections useful for on-call: **Summary**, **Root Cause**, **Accepted Fix**, **Rejected Fixes**, **Next Steps**
