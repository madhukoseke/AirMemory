from __future__ import annotations


def normalize_table_name(table: str) -> str:
    return table.strip().lower()


def build_fingerprint(
    failure_category: str,
    dag_id: str,
    task_id: str,
    source_tables: list[str],
    normalized_error: str,
) -> str:
    _ = normalized_error
    primary_source = normalize_table_name(source_tables[0]) if source_tables else "unknown_source"
    return "|".join(
        [
            failure_category.strip().lower(),
            dag_id.strip().lower(),
            task_id.strip().lower(),
            primary_source,
        ]
    )
