import {
  demoEmit,
  demoEval,
  demoForget,
  demoGetIncident,
  demoGraph,
  demoHealth,
  demoImprove,
  demoListIncidents,
  demoProcess,
  demoRecall,
  demoRunbook,
  demoRuntimeSummary,
  demoSeed
} from '@/lib/demo'

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
    normalized_error?: string
    source_tables?: string[]
    target_tables?: string[]
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
    historical_incident?: {
      incident_id: string
      accepted_fix?: string
      root_cause?: string
      rejected_fixes?: string[]
    }
  }>
  wiki_paths: string[]
  cognee_recall_text?: string | null
}

export type RecallContext = {
  question: string
  dagId?: string
  taskId?: string
}

export type RunbookContext = {
  dagId: string
  taskId: string
  failureSummary: string
}

export type ImproveContext = {
  incidentId: string
  feedback: string
  acceptedResolution?: string
  feedbackAlpha?: number
}

const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
const forceDemo =
  process.env.NEXT_PUBLIC_DEMO_MODE === '1' || configuredBase === 'demo' || configuredBase === ''

/** Demo mode when no live API is configured (Vercel default). */
export const isDemoMode = forceDemo || !configuredBase

const API_BASE = !isDemoMode && configuredBase ? configuredBase : 'http://127.0.0.1:8000'

const SEED_DAG = 'customer_daily_migration_dag'
const SEED_TASK = 'validate_row_counts'
const SEED_INCIDENT = 'INC-1029'
const SEED_RESOLUTION = 'res-window-3-day'

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

export function buildRecallQuestion(detail: RuntimeIncidentResult): string {
  const { incident } = detail
  return [
    `Have we seen ${incident.task_id} fail on ${incident.dag_id} before?`,
    `Failure category: ${incident.failure_category}.`,
    `Error: ${incident.raw_error}`,
    'What was the root cause and safe fix?'
  ].join(' ')
}

export function buildRunbookContext(detail: RuntimeIncidentResult): RunbookContext {
  return {
    dagId: detail.incident.dag_id,
    taskId: detail.incident.task_id,
    failureSummary: detail.advice.summary || detail.incident.raw_error
  }
}

export function getHealth() {
  if (isDemoMode) return demoHealth()
  return apiRequest<Record<string, string | boolean>>('/health').catch(() => demoHealth())
}

export function seedAirMemory() {
  if (isDemoMode) return demoSeed()
  return apiRequest<SeedResponse>('/seed', { method: 'POST', body: '{}' }).catch(() => demoSeed())
}

export function recallMemory(context: string | RecallContext) {
  const question = typeof context === 'string' ? context : context.question
  const payload =
    typeof context === 'string'
      ? { question: context, dag_id: SEED_DAG }
      : {
          question: context.question,
          dag_id: context.dagId ?? SEED_DAG,
          task_id: context.taskId
        }

  if (isDemoMode) return demoRecall(question)
  return apiRequest<RecallResponse>('/recall', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).catch(() => demoRecall(question))
}

export function generateRunbook(context?: RunbookContext) {
  if (isDemoMode) return demoRunbook()
  return apiRequest<{ markdown: string; citations: Citation[] }>('/runbook', {
    method: 'POST',
    body: JSON.stringify({
      dag_id: context?.dagId ?? SEED_DAG,
      task_id: context?.taskId ?? SEED_TASK,
      failure_summary:
        context?.failureSummary ??
        'Source HANA count 1588, target BigQuery count 1297, diff 291.'
    })
  }).catch(() => demoRunbook())
}

export function improveMemory(context: string | ImproveContext) {
  const incidentId = typeof context === 'string' ? SEED_INCIDENT : context.incidentId
  const feedback = typeof context === 'string' ? context : context.feedback
  const payload =
    typeof context === 'string'
      ? {
          incident_id: SEED_INCIDENT,
          feedback: context,
          accepted_resolution: SEED_RESOLUTION,
          feedback_alpha: 0.7
        }
      : {
          incident_id: context.incidentId,
          feedback: context.feedback,
          accepted_resolution: context.acceptedResolution ?? SEED_RESOLUTION,
          feedback_alpha: context.feedbackAlpha ?? 0.7
        }

  if (isDemoMode) return demoImprove(incidentId, feedback)
  return apiRequest<ImproveResponse>('/improve', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).catch(() => demoImprove(incidentId, feedback))
}

export function forgetDeprecated() {
  if (isDemoMode) return demoForget()
  return apiRequest<ForgetResponse>('/forget', {
    method: 'POST',
    body: JSON.stringify({
      target_dataset: 'airmemory_deprecated_full_dag_clear',
      resolution_id: 'res-full-dag-clear',
      reason: 'Deprecated full-DAG clear workaround should not be retrieved.'
    })
  }).catch(() => demoForget())
}

export function runEval() {
  if (isDemoMode) return demoEval()
  return apiRequest<EvalResponse>('/eval', { method: 'POST', body: '{}' }).catch(() => demoEval())
}

export function getGraph(dagId = SEED_DAG, table = 'bq.prod.customer_metrics') {
  if (isDemoMode) return demoGraph()
  const params = new URLSearchParams({ dag_id: dagId, table })
  return apiRequest<GraphPath>(`/graph?${params.toString()}`).catch(() => demoGraph())
}

export function getRuntimeSummary() {
  if (isDemoMode) return demoRuntimeSummary()
  return apiRequest<RuntimeSummary>('/runtime/summary').catch(() => demoRuntimeSummary())
}

export function listRuntimeIncidents() {
  if (isDemoMode) return demoListIncidents()
  return apiRequest<{ incident_ids: string[] }>('/runtime/incidents').catch(() => demoListIncidents())
}

export function getRuntimeIncident(incidentId: string) {
  if (isDemoMode) return demoGetIncident(incidentId)
  return apiRequest<RuntimeIncidentResult>(`/runtime/incidents/${incidentId}`).catch(() =>
    demoGetIncident(incidentId)
  )
}

export function emitRuntimeFailure() {
  if (isDemoMode) return demoEmit()
  return apiRequest<{ message_id: string; dag_id: string; task_id: string; incident_id: string }>(
    '/runtime/emit',
    { method: 'POST', body: '{}' }
  ).catch(() => demoEmit())
}

export function processRuntimeFailure() {
  if (isDemoMode) return demoProcess()
  return apiRequest<{ processed: boolean; result: RuntimeIncidentResult | null; formatted: string }>(
    '/runtime/process',
    { method: 'POST', body: '{}' }
  ).catch(() => demoProcess())
}
