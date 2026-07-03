from __future__ import annotations

from airmemory.cognee_layer.client import import_cognee, write_local_memory


async def remember_incident_markdown(markdown: str, dataset_name: str) -> str:
    cognee = import_cognee()
    if cognee is None:
        path = write_local_memory(markdown, dataset_name)
        return f"local:{path}"

    try:
        if hasattr(cognee, "remember"):
            try:
                result = await cognee.remember(
                    markdown,
                    dataset_name=dataset_name,
                    node_set=["airflow_incidents"],
                )
            except TypeError:
                result = await cognee.remember(markdown, dataset_name=dataset_name)
            return str(result)

        if hasattr(cognee, "add") and hasattr(cognee, "cognify"):
            try:
                await cognee.add(markdown, dataset_name=dataset_name, node_set=["airflow_incidents"])
            except TypeError:
                await cognee.add(markdown, dataset_name=dataset_name)
            result = await cognee.cognify(datasets=[dataset_name])
            return str(result)
    except Exception:
        path = write_local_memory(markdown, dataset_name)
        return f"local:{path}"

    path = write_local_memory(markdown, dataset_name)
    return f"local:{path}"
