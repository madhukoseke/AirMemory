from __future__ import annotations

from app.schema import GraphEdge, GraphNode, GraphPath


def lineage_graph(active_downstream_path: bool = False) -> GraphPath:
    active_ids = {
        "table-hana-customer-master",
        "table-bq-customer-master",
        "table-bq-customer-metrics",
    }
    active_edge_ids = {"edge-hana-to-bq-master", "edge-bq-master-to-metrics"}
    nodes = [
        GraphNode(id="dag-customer-daily-migration", label="customer_daily_migration_dag", kind="pipeline"),
        GraphNode(id="task-extract-hana-customer", label="extract_hana_customer", kind="task"),
        GraphNode(id="task-validate-row-counts", label="validate_row_counts", kind="task"),
        GraphNode(id="task-publish-metrics", label="publish_metrics", kind="task"),
        GraphNode(
            id="table-hana-customer-master",
            label="hana.customer_master",
            kind="table",
            active=active_downstream_path,
        ),
        GraphNode(
            id="table-bq-customer-master",
            label="bq.prod.customer_master",
            kind="table",
            active=active_downstream_path,
        ),
        GraphNode(
            id="table-bq-customer-metrics",
            label="bq.prod.customer_metrics",
            kind="table",
            active=active_downstream_path,
        ),
        GraphNode(id="incident-inc-1029", label="INC-1029", kind="incident", status="resolved"),
        GraphNode(id="resolution-window", label="processing_date -3/+3", kind="resolution", status="accepted"),
    ]
    edges = [
        GraphEdge(
            id="edge-dag-extract",
            source="dag-customer-daily-migration",
            target="task-extract-hana-customer",
            label="HAS_TASK",
        ),
        GraphEdge(
            id="edge-dag-validate",
            source="dag-customer-daily-migration",
            target="task-validate-row-counts",
            label="HAS_TASK",
        ),
        GraphEdge(
            id="edge-dag-publish",
            source="dag-customer-daily-migration",
            target="task-publish-metrics",
            label="HAS_TASK",
        ),
        GraphEdge(
            id="edge-dag-consumes-hana",
            source="dag-customer-daily-migration",
            target="table-hana-customer-master",
            label="CONSUMES",
        ),
        GraphEdge(
            id="edge-dag-produces-master",
            source="dag-customer-daily-migration",
            target="table-bq-customer-master",
            label="PRODUCES",
        ),
        GraphEdge(
            id="edge-dag-produces-metrics",
            source="dag-customer-daily-migration",
            target="table-bq-customer-metrics",
            label="PRODUCES",
        ),
        GraphEdge(
            id="edge-hana-to-bq-master",
            source="table-hana-customer-master",
            target="table-bq-customer-master",
            label="DOWNSTREAM_OF",
            active=active_downstream_path,
        ),
        GraphEdge(
            id="edge-bq-master-to-metrics",
            source="table-bq-customer-master",
            target="table-bq-customer-metrics",
            label="DOWNSTREAM_OF",
            active=active_downstream_path,
        ),
        GraphEdge(
            id="edge-inc-affects-validate",
            source="incident-inc-1029",
            target="task-validate-row-counts",
            label="AFFECTS",
        ),
        GraphEdge(
            id="edge-inc-resolution",
            source="incident-inc-1029",
            target="resolution-window",
            label="RESOLVED_BY",
        ),
    ]
    explanation = (
        "Traversed bq.prod.customer_metrics upstream to bq.prod.customer_master, then to "
        "hana.customer_master, where INC-1029 explains the row-count root cause."
        if active_downstream_path
        else "Lineage subgraph for customer_daily_migration_dag."
    )
    if not active_downstream_path:
        nodes = [
            node.model_copy(update={"active": node.id in active_ids})
            if node.id in active_ids
            else node
            for node in nodes
        ]
        edges = [
            edge.model_copy(update={"active": edge.id in active_edge_ids})
            if edge.id in active_edge_ids
            else edge
            for edge in edges
        ]
    return GraphPath(nodes=nodes, edges=edges, explanation=explanation)

