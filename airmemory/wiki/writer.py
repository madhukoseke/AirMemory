from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from airmemory.models import DagMetadata, HistoricalIncident, IncidentAdvice, NormalizedIncident, SimilarIncidentMatch
from airmemory.processing.data import load_dag_metadata
from airmemory.wiki.paths import get_wiki_dir, relative_to_root


def write_initial_wiki(
    incidents: list[HistoricalIncident],
    wiki_dir: Path | None = None,
    dag_metadata: dict[str, DagMetadata] | None = None,
) -> list[str]:
    root = _ensure_wiki_dirs(wiki_dir)
    metadata = dag_metadata or load_dag_metadata()
    written: list[Path] = []

    by_dag: dict[str, list[HistoricalIncident]] = defaultdict(list)
    by_pattern: dict[str, list[HistoricalIncident]] = defaultdict(list)
    for incident in incidents:
        by_dag[incident.dag_id].append(incident)
        by_pattern[incident.failure_category].append(incident)

    for dag_id, dag_incidents in by_dag.items():
        path = root / "dags" / f"{dag_id}.md"
        _write(path, _render_dag_page(dag_id, metadata.get(dag_id), dag_incidents, []))
        written.append(path)

    for category, pattern_incidents in by_pattern.items():
        path = root / "failure-patterns" / f"{category}.md"
        _write(path, _render_pattern_page(category, pattern_incidents, None))
        written.append(path)
        runbook_path = root / "runbooks" / f"{category}_runbook.md"
        _write(runbook_path, _render_runbook_page(category, pattern_incidents, None))
        written.append(runbook_path)

    _write(root / "index.md", _render_index(root, incidents=[]))
    if not (root / "log.md").exists():
        _write(root / "log.md", "# AirMemory Log\n")
    written.extend([root / "index.md", root / "log.md"])
    return [relative_to_root(path) for path in written]


def write_incident_wiki(
    incident: NormalizedIncident,
    similar_incidents: list[SimilarIncidentMatch],
    advice: IncidentAdvice,
    cognee_recall_text: str | None,
    dag_metadata: DagMetadata | dict[str, object] | None,
    wiki_dir: Path | None = None,
) -> list[str]:
    root = _ensure_wiki_dirs(wiki_dir)
    historical = [match.historical_incident for match in similar_incidents]
    metadata = _coerce_metadata(dag_metadata)

    incident_path = root / "incidents" / f"{incident.incident_id}.md"
    dag_path = root / "dags" / f"{incident.dag_id}.md"
    pattern_path = root / "failure-patterns" / f"{incident.failure_category}.md"
    runbook_path = root / "runbooks" / f"{incident.failure_category}_runbook.md"
    index_path = root / "index.md"
    log_path = root / "log.md"

    _write(
        incident_path,
        _render_incident_page(
            incident=incident,
            similar_incidents=similar_incidents,
            advice=advice,
            cognee_recall_text=cognee_recall_text,
        ),
    )
    _write(dag_path, _render_dag_page(incident.dag_id, metadata, historical, [incident]))
    _write(pattern_path, _render_pattern_page(incident.failure_category, historical, advice))
    _write(runbook_path, _render_runbook_page(incident.failure_category, historical, advice))
    _write(index_path, _render_index(root, incidents=[incident]))
    _append_log(log_path, incident, similar_incidents)

    return [relative_to_root(path) for path in [incident_path, dag_path, pattern_path, runbook_path]]


def _ensure_wiki_dirs(wiki_dir: Path | None) -> Path:
    root = get_wiki_dir(wiki_dir)
    for name in [
        "dags",
        "tasks",
        "incidents",
        "failure-patterns",
        "root-causes",
        "fixes",
        "runbooks",
        "postmortems",
    ]:
        (root / name).mkdir(parents=True, exist_ok=True)
    return root


def _render_incident_page(
    incident: NormalizedIncident,
    similar_incidents: list[SimilarIncidentMatch],
    advice: IncidentAdvice,
    cognee_recall_text: str | None,
) -> str:
    top = similar_incidents[0].historical_incident if similar_incidents else None
    similar_markdown = "\n".join(
        f"- `{match.incident_id}` - {match.similarity_score:.2f}: {match.reason}"
        for match in similar_incidents
    ) or "- No similar incidents found"
    rejected_items = []
    if advice.rejected_fix_warning:
        rejected_items.append(advice.rejected_fix_warning)
    if top:
        rejected_items.extend(top.rejected_fixes)
    rejected = _list(rejected_items)
    steps = _numbered(advice.recommended_next_steps)

    return f"""# Incident: {incident.dag_id} / {incident.task_id}

Status: {incident.status}  
Incident ID: {incident.incident_id}  
Failure Category: {incident.failure_category}  
Fingerprint: `{incident.failure_fingerprint}`  
Owner: {incident.owner or "unknown"}  
Confidence: {advice.confidence:.2f}  

## What Happened

{advice.summary}

## Raw Error

```text
{incident.raw_error}
```

## Likely Root Cause

{advice.likely_root_cause}

## Similar Incidents

{similar_markdown}

## Accepted Fix From Previous Incident

{top.accepted_fix if top else "No accepted fix found in historical memory."}

## Rejected Fixes / What Not To Repeat

{rejected}

## Recommended Next Steps

{steps}

## Prevention

{advice.prevention or "None recorded"}

## Source Tables

{_list(incident.source_tables)}

## Target Tables

{_list(incident.target_tables)}

## Cognee Recall Evidence

```text
{cognee_recall_text or "No recall evidence returned."}
```
"""


def _render_dag_page(
    dag_id: str,
    metadata: DagMetadata | None,
    historical_incidents: list[HistoricalIncident],
    current_incidents: list[NormalizedIncident],
) -> str:
    owner = metadata.owner if metadata else _first([item.owner for item in historical_incidents]) or "unknown"
    criticality = metadata.criticality if metadata else "unknown"
    schedule = metadata.schedule if metadata else "unknown"
    business_impact = metadata.business_impact if metadata else "Not recorded."
    tasks = metadata.tasks if metadata else sorted({item.task_id for item in historical_incidents + []})
    sources = metadata.source_tables if metadata else sorted({table for item in historical_incidents for table in item.source_tables})
    targets = metadata.target_tables if metadata else sorted({table for item in historical_incidents for table in item.target_tables})
    current_lines = [f"- [{item.incident_id}](../incidents/{item.incident_id}.md)" for item in current_incidents]
    historical_lines = [f"- {item.incident_id} ({item.date}) - {item.failure_category}" for item in historical_incidents]
    patterns = sorted({item.failure_category for item in historical_incidents} | {item.failure_category for item in current_incidents})
    fixes = [item.accepted_fix for item in historical_incidents[:5]]

    return f"""# DAG: {dag_id}

Owner: {owner}  
Criticality: {criticality}  
Schedule: {schedule}  

## Business Impact

{business_impact}

## Tasks

{_list(tasks)}

## Source Tables

{_list(sources)}

## Target Tables

{_list(targets)}

## Recent Incidents

{chr(10).join(current_lines + historical_lines) or "- None recorded"}

## Common Failure Patterns

{_list(patterns)}

## Known Fixes

{_list(fixes)}
"""


def _render_pattern_page(
    failure_category: str,
    incidents: list[HistoricalIncident],
    advice: IncidentAdvice | None,
) -> str:
    root_causes = [item.root_cause for item in incidents[:5]]
    fixes = [item.accepted_fix for item in incidents[:5]]
    rejected = [fix for item in incidents for fix in item.rejected_fixes]
    related = [f"{item.incident_id} ({item.date})" for item in incidents]
    prevention = advice.prevention if advice and advice.prevention else _first([item.prevention for item in incidents]) or "None recorded"

    return f"""# Failure Pattern: {failure_category}

## Description

Known Airflow failure pattern `{failure_category}` captured by AirMemory.

## Symptoms

{_list([item.normalized_error for item in incidents] or ([advice.summary] if advice else []))}

## Common Root Causes

{_list(root_causes or ([advice.likely_root_cause] if advice else []))}

## Best Known Fixes

{_list(fixes or ([advice.recommended_fix] if advice else []))}

## Rejected Fixes

{_list(rejected)}

## Related Incidents

{_list(related)}

## Prevention

{prevention}
"""


def _render_runbook_page(
    failure_category: str,
    incidents: list[HistoricalIncident],
    advice: IncidentAdvice | None,
) -> str:
    diagnosis = [
        "Inspect the Airflow task log and confirm the exact failing input.",
        "Check source table freshness, partitions, and completion markers.",
        "Confirm whether target data was partially written before rerunning.",
    ]
    fix_steps = advice.recommended_next_steps if advice else [item.accepted_fix for item in incidents[:3]]
    validation = [
        "Confirm the failed task completes after rerun.",
        "Validate source and target row counts for the processing window.",
        "Check downstream dashboard or report freshness.",
    ]
    prevention = advice.prevention if advice and advice.prevention else _first([item.prevention for item in incidents]) or "None recorded"
    related = [f"{item.incident_id} ({item.date})" for item in incidents]

    return f"""# Runbook: {failure_category}

## When to Use

Use this runbook when an Airflow DAG fails with category `{failure_category}`.

## Symptoms

{_list([item.normalized_error for item in incidents] or ([advice.summary] if advice else []))}

## Diagnosis Steps

{_numbered(diagnosis)}

## Fix Steps

{_numbered(fix_steps)}

## Validation Steps

{_numbered(validation)}

## Prevention

{prevention}

## Related Incidents

{_list(related)}
"""


def _render_index(root: Path, incidents: list[NormalizedIncident]) -> str:
    dag_links = _links(root / "dags", "dags")
    pattern_links = _links(root / "failure-patterns", "failure-patterns")
    incident_links = [f"- [{item.incident_id}](incidents/{item.incident_id}.md)" for item in incidents]
    if not incident_links:
        incident_links = _links(root / "incidents", "incidents")
    runbook_links = _links(root / "runbooks", "runbooks")

    return f"""# AirMemory Wiki

## DAGs

{chr(10).join(dag_links) or "- No DAG pages yet"}

## Failure Patterns

{chr(10).join(pattern_links) or "- No failure patterns yet"}

## Recent Incidents

{chr(10).join(incident_links) or "- No processed incidents yet"}

## Runbooks

{chr(10).join(runbook_links) or "- No runbooks yet"}
"""


def _append_log(log_path: Path, incident: NormalizedIncident, similar_incidents: list[SimilarIncidentMatch]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else "# AirMemory Log\n"
    if incident.incident_id in existing:
        return

    top = similar_incidents[0].incident_id if similar_incidents else "none"
    entry = f"""
## {_timestamp()} - Processed Incident

- Incident: {incident.incident_id}
- DAG: {incident.dag_id}
- Task: {incident.task_id}
- Category: {incident.failure_category}
- Similar incidents found: {len(similar_incidents)}
- Top match: {top}
- Wiki updated: yes
- Cognee updated: yes
"""
    log_path.write_text(existing.rstrip() + "\n" + entry, encoding="utf-8")


def _links(path: Path, prefix: str) -> list[str]:
    if not path.exists():
        return []
    return [f"- [{item.stem}]({prefix}/{item.name})" for item in sorted(path.glob("*.md"))]


def _list(items: Iterable[str | None]) -> str:
    rows = [f"- {item}" for item in items if item]
    return "\n".join(rows) if rows else "- None recorded"


def _numbered(items: Iterable[str | None]) -> str:
    rows = [item for item in items if item]
    return "\n".join(f"{index}. {item}" for index, item in enumerate(rows, start=1)) if rows else "1. None recorded"


def _first(items: Iterable[str | None]) -> str | None:
    for item in items:
        if item:
            return item
    return None


def _coerce_metadata(value: DagMetadata | dict[str, object] | None) -> DagMetadata | None:
    if isinstance(value, DagMetadata):
        return value
    if isinstance(value, dict) and value:
        return DagMetadata.model_validate(value)
    return None


def _timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalized = content.rstrip() + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == normalized:
        return
    path.write_text(normalized, encoding="utf-8")
