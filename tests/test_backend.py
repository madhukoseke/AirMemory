from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app, memory_engine


client = TestClient(app)


def setup_function() -> None:
    memory_engine.state.reset()


def test_seed_ingests_all_sample_sources() -> None:
    response = client.post("/seed")
    assert response.status_code == 200
    payload = response.json()
    assert payload["remembered"] >= 8
    for source in ["dag", "log", "incident", "runbook", "sql", "slack", "github"]:
        assert payload["counts_by_source"][source] >= 1


def test_recall_returns_citations_and_accepted_fix() -> None:
    response = client.post(
        "/recall",
        json={"question": "Have we seen validate_row_counts fail on customer_master before?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "INC-1029" in payload["answer"]
    assert payload["citations"]
    assert any(rank["id"] == "res-window-3-day" for rank in payload["resolutions"])


def test_lineage_recall_has_graph_contrast() -> None:
    response = client.post(
        "/recall",
        json={"question": "Looker customer_metrics is stale after publish_metrics"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["graph_path"] is not None
    assert "Vector-only recall" in payload["vector_only_contrast"]
    active_edges = [edge for edge in payload["graph_path"]["edges"] if edge["active"]]
    assert len(active_edges) >= 2


def test_improve_moves_accepted_resolution_to_rank_one() -> None:
    before = client.post("/recall", json={"question": "row count mismatch"}).json()
    accepted_before = next(rank for rank in before["resolutions"] if rank["id"] == "res-window-3-day")
    assert accepted_before["rank"] == 2

    response = client.post(
        "/improve",
        json={
            "incident_id": "INC-1029",
            "feedback": "Confirmed the processing_date window.",
            "accepted_resolution": "res-window-3-day",
            "feedback_alpha": 0.7,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["rank_before"] == 2
    assert payload["rank_after"] == 1


def test_forget_removes_deprecated_workaround() -> None:
    client.post("/seed")
    response = client.post(
        "/forget",
        json={
            "target_dataset": "airmemory_deprecated_full_dag_clear",
            "resolution_id": "res-full-dag-clear",
            "reason": "unsafe deprecated workaround",
        },
    )
    assert response.status_code == 200
    assert response.json()["leakage_check"] == 0
    recall = client.post("/recall", json={"question": "row count mismatch"}).json()
    assert all(rank["id"] != "res-full-dag-clear" for rank in recall["resolutions"])


def test_eval_reports_learning_and_zero_leakage() -> None:
    response = client.post("/eval")
    assert response.status_code == 200
    payload = response.json()
    assert payload["before"]["recall_at_1"] < payload["after"]["recall_at_1"]
    assert payload["forget_leakage"] == 0
