from __future__ import annotations

from airmemory.processing.categorizer import categorize_failure


def test_missing_partition() -> None:
    assert categorize_failure("partition 2026-07-01 not found") == "missing_partition"


def test_row_count_mismatch() -> None:
    assert categorize_failure("Row count mismatch between source and target") == "row_count_mismatch"


def test_row_count_mismatch_underscore_token() -> None:
    assert categorize_failure("error_type=ROW_COUNT_MISMATCH source_count=1588") == "row_count_mismatch"


def test_schema_drift() -> None:
    assert categorize_failure("Column expected STRING but received INT64") == "schema_drift"


def test_api_timeout() -> None:
    assert categorize_failure("API request timed out after 300 seconds") == "api_timeout"


def test_duplicate_records() -> None:
    assert categorize_failure("Duplicate key detected") == "duplicate_records"
