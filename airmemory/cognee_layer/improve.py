from __future__ import annotations

from airmemory.cognee_layer.client import import_cognee
from airmemory.cognee_layer.remember import remember_incident_markdown


async def improve_memory(
    dataset_name: str,
    *,
    incident_id: str | None = None,
    feedback: str | None = None,
    accepted_resolution: str | None = None,
    feedback_alpha: float = 0.7,
) -> str | None:
    cognee = import_cognee()
    if cognee is None or not hasattr(cognee, "improve"):
        if incident_id and feedback:
            feedback_doc = (
                f"# Feedback for {incident_id}\n"
                f"Accepted resolution: {accepted_resolution or 'unknown'}\n"
                f"Feedback: {feedback}"
            )
            await remember_incident_markdown(feedback_doc, dataset_name)
            return "local:feedback remembered"
        return None

    if incident_id and feedback:
        session_id = f"incident_{incident_id}"
        feedback_doc = (
            f"# Feedback for {incident_id}\n"
            f"Accepted resolution: {accepted_resolution or 'unknown'}\n"
            f"Feedback: {feedback}"
        )
        try:
            await cognee.remember(
                feedback_doc,
                dataset_name=dataset_name,
                session_id=session_id,
                self_improvement=False,
                node_set=["source:feedback", f"incident:{incident_id}"],
            )
        except TypeError:
            await cognee.remember(feedback_doc, dataset_name=dataset_name, session_id=session_id)

    try:
        return str(
            await cognee.improve(
                dataset=dataset_name,
                session_ids=[f"incident_{incident_id}"] if incident_id else None,
                feedback_alpha=feedback_alpha,
            )
        )
    except TypeError:
        return str(await cognee.improve(datasets=[dataset_name]))
