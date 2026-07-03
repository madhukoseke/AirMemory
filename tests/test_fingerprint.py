from __future__ import annotations

from airmemory.processing.fingerprint import build_fingerprint


def test_fingerprint() -> None:
    fp = build_fingerprint(
        "missing_partition",
        "customer_daily_revenue_dag",
        "transform_revenue",
        ["raw.customer_transactions"],
        "partition not found",
    )
    assert fp == "missing_partition|customer_daily_revenue_dag|transform_revenue|raw.customer_transactions"
