from __future__ import annotations

from app.lineage import graph_for_symptom, migration_lineage_graph
from app.schema import GraphPath


def lineage_graph(active_downstream_path: bool = False) -> GraphPath:
    return migration_lineage_graph(active_downstream_path=active_downstream_path)


__all__ = ["lineage_graph", "graph_for_symptom", "GraphPath"]
