from __future__ import annotations


def categorize_failure(error_message: str) -> str:
    msg = error_message.lower()

    if "partition" in msg and ("not found" in msg or "missing" in msg):
        return "missing_partition"

    if ("schema" in msg or "column" in msg) and ("expected" in msg or "type" in msg or "received" in msg):
        return "schema_drift"

    if "row count" in msg or "count mismatch" in msg:
        return "row_count_mismatch"

    if "timeout" in msg or "timed out" in msg:
        return "api_timeout"

    if "duplicate" in msg:
        return "duplicate_records"

    if "null" in msg:
        return "null_value_spike"

    if "auth" in msg or "credential" in msg or "key expired" in msg:
        return "credential_expired"

    if "freshness" in msg or "not updated within sla" in msg:
        return "late_source_data"

    return "unknown"
