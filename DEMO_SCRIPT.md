# AirMemory Demo Script

## 1. Open

Data teams do not just need logs. They need memory.

Airflow tells you what failed. It does not remember why the same pipeline failed last time, what fix worked, or what fix was rejected.

AirMemory gives Airflow memory.

## 2. Show Seeded Memory

AirMemory starts with historical incidents:

- missing partition
- schema drift
- row count mismatch
- duplicate records
- API timeout
- credential expiration

## 3. Trigger Failure

Simulate a new failure:

```text
customer_daily_revenue_dag failed because raw.customer_transactions is missing the 2026-07-01 partition.
```

## 4. Show Event Intake

The failure event lands in Redis Streams or the local queue fallback.

## 5. Show Worker

The worker:

- normalizes the event
- fingerprints the failure
- recalls similar incidents from memory
- generates an incident summary
- updates the Markdown wiki
- writes the new incident back to memory

## 6. Show Recommendation

AirMemory finds the June 12 missing-partition incident.

Previous root cause:
The upstream partition was delayed.

Accepted fix:
Backfill the partition and rerun from `transform_revenue`.

Rejected fix:
Increasing retries alone did not work.

## 7. Show Wiki

AirMemory generates:

- incident page
- DAG page
- failure pattern page
- runbook page

## 8. Close

Every failed DAG now makes the team smarter.

Airflow has logs. Cognee gives it memory.
