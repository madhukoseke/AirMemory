export type Citation = {
  id: string
  label: string
  source: string
  artifact_id: string
  excerpt: string
  facets: string[]
  url?: string | null
}

export type ResolutionRank = {
  id: string
  title: string
  status: 'accepted' | 'rejected' | 'deprecated'
  score: number
  rank: number
  citation_id: string
}

export type GraphNode = {
  id: string
  label: string
  kind: 'pipeline' | 'task' | 'table' | 'incident' | 'resolution'
  status?: string | null
  active: boolean
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  label: string
  active: boolean
}

export type GraphPath = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  explanation: string
}

export type RecallResponse = {
  answer: string
  citations: Citation[]
  resolutions: ResolutionRank[]
  graph_path?: GraphPath | null
  vector_only_contrast?: string | null
}

export type ImproveResponse = {
  incident_id: string
  rank_before: number
  rank_after: number
  score_before: number
  score_after: number
  session_id: string
  message: string
}

export type ForgetResponse = {
  removed: boolean
  target: string
  leakage_check: number
  message: string
}

export type EvalResponse = {
  before: {
    recall_at_1: number
    recall_at_3: number
    preferred_fix_first_rate: number
  }
  after: {
    recall_at_1: number
    recall_at_3: number
    preferred_fix_first_rate: number
  }
  forget_leakage: number
  rows: Array<Record<string, unknown>>
  results_path: string
}

export type SeedResponse = {
  remembered: number
  counts_by_source: Record<string, number>
  dataset: string
  cognee_enabled: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getHealth() {
  return apiRequest<Record<string, string | boolean>>('/health')
}

export function seedAirMemory() {
  return apiRequest<SeedResponse>('/seed', { method: 'POST', body: '{}' })
}

export function recallMemory(question: string) {
  return apiRequest<RecallResponse>('/recall', {
    method: 'POST',
    body: JSON.stringify({ question, dag_id: 'customer_daily_migration_dag' })
  })
}

export function generateRunbook() {
  return apiRequest<{ markdown: string; citations: Citation[] }>('/runbook', {
    method: 'POST',
    body: JSON.stringify({
      dag_id: 'customer_daily_migration_dag',
      task_id: 'validate_row_counts',
      failure_summary: 'Source HANA count 1588, target BigQuery count 1297, diff 291.'
    })
  })
}

export function improveMemory(feedback: string) {
  return apiRequest<ImproveResponse>('/improve', {
    method: 'POST',
    body: JSON.stringify({
      incident_id: 'INC-1029',
      feedback,
      accepted_resolution: 'res-window-3-day',
      feedback_alpha: 0.7
    })
  })
}

export function forgetDeprecated() {
  return apiRequest<ForgetResponse>('/forget', {
    method: 'POST',
    body: JSON.stringify({
      target_dataset: 'airmemory_deprecated_full_dag_clear',
      resolution_id: 'res-full-dag-clear',
      reason: 'Deprecated full-DAG clear workaround should not be retrieved.'
    })
  })
}

export function runEval() {
  return apiRequest<EvalResponse>('/eval', { method: 'POST', body: '{}' })
}

export function getGraph() {
  return apiRequest<GraphPath>('/graph')
}

export type RuntimeSummary = {
  queue_mode: string
  wiki_dir: string
  state_dir: string
  incident_count: number
  latest_incident_id?: string | null
  latest_summary?: string | null
}

export type RuntimeIncidentResult = {
  incident: {
    incident_id: string
    dag_id: string
    task_id: string
    failure_category: string
    raw_error: string
    recommended_fix?: string | null
    likely_root_cause?: string | null
    rejected_fix_warning?: string | null
  }
  advice: {
    summary: string
    likely_root_cause: string
    recommended_fix: string
    rejected_fix_warning?: string | null
    confidence: number
    recommended_next_steps: string[]
  }
  similar_incidents: Array<{
    incident_id: string
    similarity_score: number
    reason: string
  }>
  wiki_paths: string[]
  cognee_recall_text?: string | null
}

export function getRuntimeSummary() {
  return apiRequest<RuntimeSummary>('/runtime/summary')
}

export function listRuntimeIncidents() {
  return apiRequest<{ incident_ids: string[] }>('/runtime/incidents')
}

export function getRuntimeIncident(incidentId: string) {
  return apiRequest<RuntimeIncidentResult>(`/runtime/incidents/${incidentId}`)
}

export function emitRuntimeFailure() {
  return apiRequest<{ message_id: string; dag_id: string; task_id: string; incident_id: string }>(
    '/runtime/emit',
    { method: 'POST', body: '{}' }
  )
}

export function processRuntimeFailure() {
  return apiRequest<{ processed: boolean; result: RuntimeIncidentResult | null; formatted: string }>(
    '/runtime/process',
    { method: 'POST', body: '{}' }
  )
}
