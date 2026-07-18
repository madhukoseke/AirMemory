type Citation = {
  id: string
  label: string
  source: string
  artifact_id: string
  excerpt: string
  facets: string[]
  url?: string | null
}

type ResolutionRank = {
  id: string
  title: string
  status: 'accepted' | 'rejected' | 'deprecated'
  score: number
  rank: number
  citation_id: string
}

type GraphPath = {
  nodes: Array<{
    id: string
    label: string
    kind: 'pipeline' | 'task' | 'table' | 'incident' | 'resolution'
    status?: string | null
    active: boolean
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label: string
    active: boolean
  }>
  explanation: string
}

type RecallResponse = {
  answer: string
  citations: Citation[]
  resolutions: ResolutionRank[]
  graph_path?: GraphPath | null
  vector_only_contrast?: string | null
}

type ImproveResponse = {
  incident_id: string
  rank_before: number
  rank_after: number
  score_before: number
  score_after: number
  session_id: string
  message: string
}

type ForgetResponse = {
  removed: boolean
  target: string
  leakage_check: number
  message: string
}

type EvalResponse = {
  before: { recall_at_1: number; recall_at_3: number; preferred_fix_first_rate: number }
  after: { recall_at_1: number; recall_at_3: number; preferred_fix_first_rate: number }
  forget_leakage: number
  rows: Array<Record<string, unknown>>
  results_path: string
}

type SeedResponse = {
  remembered: number
  counts_by_source: Record<string, number>
  dataset: string
  cognee_enabled: boolean
}

type RuntimeSummary = {
  queue_mode: string
  wiki_dir: string
  state_dir: string
  incident_count: number
  latest_incident_id?: string | null
  latest_summary?: string | null
}

type RuntimeIncidentResult = {
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

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms))

const DEMO_GRAPH: GraphPath = {
  nodes: [
    { id: 'dag-customer-daily-migration', label: 'customer_daily_migration_dag', kind: 'pipeline', active: false },
    { id: 'task-extract-hana-customer', label: 'extract_hana_customer', kind: 'task', active: false },
    { id: 'task-validate-row-counts', label: 'validate_row_counts', kind: 'task', active: true },
    { id: 'task-publish-metrics', label: 'publish_metrics', kind: 'task', active: false },
    { id: 'table-hana-customer-master', label: 'hana.customer_master', kind: 'table', active: true },
    { id: 'table-bq-customer-master', label: 'bq.prod.customer_master', kind: 'table', active: true },
    { id: 'table-bq-customer-metrics', label: 'bq.prod.customer_metrics', kind: 'table', active: true },
    { id: 'incident-inc-1029', label: 'INC-1029', kind: 'incident', status: 'resolved', active: true },
    { id: 'resolution-window', label: 'processing_date -3/+3', kind: 'resolution', status: 'accepted', active: true }
  ],
  edges: [
    {
      id: 'edge-dag-extract',
      source: 'dag-customer-daily-migration',
      target: 'task-extract-hana-customer',
      label: 'HAS_TASK',
      active: false
    },
    {
      id: 'edge-dag-validate',
      source: 'dag-customer-daily-migration',
      target: 'task-validate-row-counts',
      label: 'HAS_TASK',
      active: true
    },
    {
      id: 'edge-dag-publish',
      source: 'dag-customer-daily-migration',
      target: 'task-publish-metrics',
      label: 'HAS_TASK',
      active: false
    },
    {
      id: 'edge-hana-to-bq-master',
      source: 'table-hana-customer-master',
      target: 'table-bq-customer-master',
      label: 'DOWNSTREAM_OF',
      active: true
    },
    {
      id: 'edge-bq-master-to-metrics',
      source: 'table-bq-customer-master',
      target: 'table-bq-customer-metrics',
      label: 'DOWNSTREAM_OF',
      active: true
    },
    {
      id: 'edge-inc-affects-validate',
      source: 'incident-inc-1029',
      target: 'task-validate-row-counts',
      label: 'AFFECTS',
      active: true
    },
    {
      id: 'edge-inc-resolution',
      source: 'incident-inc-1029',
      target: 'resolution-window',
      label: 'RESOLVED_BY',
      active: true
    }
  ],
  explanation:
    'Traversed bq.prod.customer_metrics upstream to bq.prod.customer_master, then to hana.customer_master, where INC-1029 explains the row-count root cause.'
}

const DEMO_CITATIONS: Citation[] = [
  {
    id: 'cit-postmortem',
    label: 'INC-1029 postmortem',
    source: 'incident',
    artifact_id: 'inc_1029',
    excerpt: 'Exact processing_date = system_date missed late HANA records arriving after cutover.',
    facets: ['row_count_mismatch', 'customer_master']
  },
  {
    id: 'cit-runbook',
    label: 'Row count mismatch runbook',
    source: 'runbook',
    artifact_id: 'row_count_mismatch_runbook',
    excerpt: 'Widen validation window to system_date - 3 through system_date + 3, then rerun validate_row_counts only.',
    facets: ['safe_fix', 'window']
  },
  {
    id: 'cit-sql',
    label: 'validate_row_counts SQL',
    source: 'sql',
    artifact_id: 'validate_row_counts_sql',
    excerpt: 'WHERE processing_date BETWEEN DATE_SUB(system_date, 3) AND DATE_ADD(system_date, 3)',
    facets: ['sql', 'window']
  },
  {
    id: 'cit-slack',
    label: 'INC-1029 Slack triage',
    source: 'slack',
    artifact_id: 'inc_1029_thread',
    excerpt: 'Confirmed: full DAG clear is unsafe. Prefer windowed revalidation.',
    facets: ['rejected_workaround']
  }
]

function baseResolutions(improved: boolean, forgotten: boolean): ResolutionRank[] {
  const ranks: ResolutionRank[] = [
    {
      id: 'res-window-3-day',
      title: 'Widen processing_date window to system_date ± 3 days',
      status: 'accepted',
      score: improved ? 0.94 : 0.78,
      rank: improved ? 1 : 2,
      citation_id: 'cit-runbook'
    },
    {
      id: 'res-rerun-validate-only',
      title: 'Rerun validate_row_counts and dq_reconciliation_check only',
      status: 'accepted',
      score: improved ? 0.81 : 0.86,
      rank: improved ? 2 : 1,
      citation_id: 'cit-postmortem'
    }
  ]

  if (!forgotten) {
    ranks.push({
      id: 'res-full-dag-clear',
      title: 'Clear and reload the full customer_daily_migration_dag',
      status: 'deprecated',
      score: 0.41,
      rank: 3,
      citation_id: 'cit-slack'
    })
  }

  return ranks.sort((a, b) => a.rank - b.rank)
}

type DemoState = {
  improved: boolean
  forgotten: boolean
  emitCount: number
  incidentIds: string[]
}

const state: DemoState = {
  improved: false,
  forgotten: false,
  emitCount: 0,
  incidentIds: ['INC-DEMO-1041', 'INC-1029']
}

function runtimeDetail(
  incidentId: string,
  overrides?: {
    dagId?: string
    taskId?: string
    category?: string
    rawError?: string
  }
): RuntimeIncidentResult {
  const isPartition = overrides?.category === 'missing_partition'
  return {
    incident: {
      incident_id: incidentId,
      dag_id: overrides?.dagId ?? (isPartition ? 'customer_daily_revenue_dag' : 'customer_daily_migration_dag'),
      task_id: overrides?.taskId ?? (isPartition ? 'transform_revenue' : 'validate_row_counts'),
      failure_category: overrides?.category ?? 'row_count_mismatch',
      raw_error:
        overrides?.rawError ??
        (isPartition
          ? 'BigQuery error: partition not found in raw.customer_transactions'
          : 'ROW_COUNT_MISMATCH: HANA 1588 / BigQuery 1297 / diff 291'),
      normalized_error: overrides?.category ?? 'row_count_mismatch',
      source_tables: isPartition ? ['raw.customer_transactions'] : ['hana.customer_master'],
      target_tables: isPartition ? ['mart.customer_daily_revenue'] : ['bq.prod.customer_master'],
      recommended_fix: isPartition
        ? 'Backfill the missing partition, then rerun transform_revenue only'
        : 'Widen processing_date window to system_date ± 3 days',
      likely_root_cause: isPartition
        ? 'Upstream extract did not land the expected partition before transform.'
        : 'Exact processing_date filter missed late-arriving HANA records.',
      rejected_fix_warning: state.forgotten ? null : 'Avoid full DAG clear — previously rejected.'
    },
    advice: {
      summary: isPartition
        ? 'Matched prior missing_partition incidents on revenue transform.'
        : 'Matched INC-1029 via lineage from customer_metrics → customer_master.',
      likely_root_cause: isPartition
        ? 'The expected daily partition was missing from the upstream raw table when transform_revenue ran.'
        : 'Exact `processing_date = system_date` validation missed late HANA records that arrived after cutover.',
      recommended_fix: isPartition
        ? 'Confirm upstream extract completed, backfill the missing partition, then rerun `transform_revenue` only.'
        : 'Widen the validation window to `system_date - 3` through `system_date + 3`, then rerun `validate_row_counts` and `dq_reconciliation_check` only.',
      rejected_fix_warning: state.forgotten
        ? null
        : 'Do not clear/reload the full DAG — that workaround was deprecated after INC-1029.',
      confidence: state.improved ? 0.91 : 0.78,
      recommended_next_steps: isPartition
        ? ['Verify upstream extract status', 'Backfill missing partition', 'Rerun transform_revenue only']
        : [
            'Apply ±3 day processing_date window',
            'Rerun validate_row_counts only',
            'Confirm Looker customer_metrics freshness'
          ]
    },
    similar_incidents: [
      {
        incident_id: isPartition ? 'INC-980' : 'INC-1029',
        similarity_score: 0.93,
        reason: isPartition
          ? 'Same missing_partition fingerprint on revenue DAG'
          : 'Same failure category and upstream table via lineage',
        historical_incident: {
          incident_id: isPartition ? 'INC-980' : 'INC-1029',
          accepted_fix: isPartition
            ? 'Backfill partition then rerun transform'
            : 'Widen processing_date window to system_date ± 3 days',
          root_cause: isPartition ? 'Missing upstream partition' : 'Exact date filter missed late source records',
          rejected_fixes: ['Full DAG clear and reload']
        }
      }
    ],
    wiki_paths: isPartition
      ? ['content/docs/runbooks/missing_partition.md', 'content/docs/patterns/missing_partition.md']
      : [
          'content/docs/incidents/inc_1029.md',
          'content/docs/runbooks/row_count_mismatch.md',
          'content/docs/patterns/row_count_mismatch.md'
        ],
    cognee_recall_text: isPartition
      ? 'Demo memory recall for missing partition failures.'
      : 'Demo memory recall for INC-1029 row-count mismatch.'
  }
}

export async function demoHealth() {
  await delay(120)
  return {
    status: 'ok',
    mode: 'demo',
    cognee_enabled: false,
    message: 'Running with local demo data'
  }
}

/** Sync snapshots for first paint in demo mode (no empty dashes on Vercel). */
export const DEMO_BOOTSTRAP = {
  health: {
    status: 'ok',
    mode: 'demo',
    cognee_enabled: false,
    message: 'Running with local demo data'
  } as Record<string, string | boolean>,
  seed: {
    remembered: 10,
    counts_by_source: {
      dag: 1,
      log: 1,
      incident: 1,
      runbook: 2,
      sql: 1,
      slack: 1,
      github: 3
    },
    dataset: 'airmemory_demo',
    cognee_enabled: false
  } satisfies SeedResponse,
  summary: {
    queue_mode: 'demo',
    wiki_dir: './wiki',
    state_dir: './.airmemory_state',
    incident_count: 2,
    latest_incident_id: 'INC-DEMO-1041',
    latest_summary: 'ROW_COUNT_MISMATCH on validate_row_counts'
  } satisfies RuntimeSummary,
  incidentIds: ['INC-DEMO-1041', 'INC-1029'] as string[],
  detail: () => runtimeDetail('INC-DEMO-1041'),
  recall: (): RecallResponse => ({
    answer: [
      'Yes — this matches INC-1029 on customer_daily_migration_dag / validate_row_counts.',
      'Root cause: exact `processing_date = system_date` missed late HANA records.',
      'Safe fix: widen the window to `system_date - 3` through `system_date + 3`, then rerun `validate_row_counts` and `dq_reconciliation_check` only.'
    ].join(' '),
    citations: DEMO_CITATIONS,
    resolutions: baseResolutions(false, false),
    graph_path: DEMO_GRAPH,
    vector_only_contrast: null
  }),
  graph: DEMO_GRAPH
}

export async function demoSeed(): Promise<SeedResponse> {
  await delay()
  return DEMO_BOOTSTRAP.seed
}

export async function demoRecall(question: string): Promise<RecallResponse> {
  await delay(360)
  const downstream = /looker|customer_metrics|publish_metrics|stale/i.test(question)
  return {
    answer: [
      'Yes — this matches INC-1029 on customer_daily_migration_dag / validate_row_counts.',
      'Root cause: exact `processing_date = system_date` missed late HANA records.',
      'Safe fix: widen the window to `system_date - 3` through `system_date + 3`, then rerun `validate_row_counts` and `dq_reconciliation_check` only.',
      downstream
        ? 'Downstream Looker staleness on customer_metrics is explained by the upstream row-count mismatch via lineage.'
        : 'Avoid the deprecated full-DAG clear workaround.'
    ].join(' '),
    citations: DEMO_CITATIONS,
    resolutions: baseResolutions(state.improved, state.forgotten),
    graph_path: DEMO_GRAPH,
    vector_only_contrast: downstream
      ? 'Vector-only recall on the Looker symptom returned no match. Lineage traversal found INC-1029 upstream.'
      : null
  }
}

export async function demoRunbook() {
  await delay(200)
  return {
    markdown: [
      '# Row count mismatch runbook',
      '',
      '1. Confirm HANA vs BigQuery counts for customer_master.',
      '2. Widen processing_date to system_date ± 3.',
      '3. Rerun validate_row_counts and dq_reconciliation_check only.',
      '4. Verify Looker customer_metrics freshness.'
    ].join('\n'),
    citations: DEMO_CITATIONS.slice(0, 2)
  }
}

export async function demoImprove(incidentId: string, feedback: string): Promise<ImproveResponse> {
  await delay(320)
  state.improved = true
  return {
    incident_id: incidentId,
    rank_before: 2,
    rank_after: 1,
    score_before: 0.78,
    score_after: 0.94,
    session_id: `incident_${incidentId}`,
    message: `Demo improve applied. Feedback stored: ${feedback.slice(0, 80)}`
  }
}

export async function demoForget(): Promise<ForgetResponse> {
  await delay(280)
  state.forgotten = true
  return {
    removed: true,
    target: 'airmemory_deprecated_full_dag_clear',
    leakage_check: 0,
    message: 'Deprecated full-DAG clear workaround removed from demo memory.'
  }
}

export async function demoEval(): Promise<EvalResponse> {
  await delay(400)
  return {
    before: {
      recall_at_1: 0,
      recall_at_3: 1,
      preferred_fix_first_rate: 0
    },
    after: {
      recall_at_1: 1,
      recall_at_3: 1,
      preferred_fix_first_rate: 1
    },
    forget_leakage: 0,
    rows: [
      {
        pass: 'cold',
        query: 'validate_row_counts failed on customer_master with ROW_COUNT_MISMATCH',
        expected_resolution: 'res-window-3-day',
        actual_rank: 2,
        in_top_1: false
      },
      {
        pass: 'improved',
        query: 'validate_row_counts failed on customer_master with ROW_COUNT_MISMATCH',
        expected_resolution: 'res-window-3-day',
        actual_rank: 1,
        in_top_1: true
      }
    ],
    results_path: 'demo://eval/results.json'
  }
}

export async function demoGraph(): Promise<GraphPath> {
  await delay(180)
  return DEMO_GRAPH
}

export async function demoRuntimeSummary(): Promise<RuntimeSummary> {
  await delay(120)
  return {
    ...DEMO_BOOTSTRAP.summary,
    incident_count: state.incidentIds.length,
    latest_incident_id: state.incidentIds[0]
  }
}

export async function demoListIncidents() {
  await delay(100)
  return { incident_ids: [...state.incidentIds] }
}

export async function demoGetIncident(incidentId: string): Promise<RuntimeIncidentResult> {
  await delay(200)
  return runtimeDetail(incidentId)
}

export async function demoEmit() {
  await delay(220)
  state.emitCount += 1
  const incidentId = `INC-DEMO-${1041 + state.emitCount}`
  if (!state.incidentIds.includes(incidentId)) {
    state.incidentIds = [incidentId, ...state.incidentIds]
  }
  return {
    message_id: `demo-msg-${state.emitCount}`,
    dag_id: 'customer_daily_migration_dag',
    task_id: 'validate_row_counts',
    incident_id: incidentId
  }
}

export async function demoProcess() {
  await delay(360)
  const incidentId = state.incidentIds[0] ?? 'INC-DEMO-1041'
  const result = runtimeDetail(incidentId)
  return {
    processed: true,
    result,
    formatted: [
      `## ${incidentId}`,
      `DAG: ${result.incident.dag_id}`,
      `Task: ${result.incident.task_id}`,
      `Advice: ${result.advice.recommended_fix}`,
      `Confidence: ${Math.round(result.advice.confidence * 100)}%`
    ].join('\n')
  }
}

export async function demoAnalyze(logText: string) {
  await delay(420)
  state.emitCount += 1
  const incidentId = `INC-DEMO-${1041 + state.emitCount}`
  if (!state.incidentIds.includes(incidentId)) {
    state.incidentIds = [incidentId, ...state.incidentIds]
  }

  const dagMatch = /dag_id\s*[=:]\s*['"]?([A-Za-z0-9_.-]+)/i.exec(logText)
  const taskMatch = /task_id\s*[=:]\s*['"]?([A-Za-z0-9_.-]+)/i.exec(logText)
  const lower = logText.toLowerCase()
  const isPartition = lower.includes('partition') && (lower.includes('not found') || lower.includes('missing'))
  const result = runtimeDetail(incidentId, {
    dagId: dagMatch?.[1] ?? (isPartition ? 'customer_daily_revenue_dag' : 'customer_daily_migration_dag'),
    taskId: taskMatch?.[1] ?? (isPartition ? 'transform_revenue' : 'validate_row_counts'),
    category: isPartition ? 'missing_partition' : 'row_count_mismatch',
    rawError: logText.split('\n').find((line) => /error/i.test(line))?.trim() ?? logText.slice(0, 180)
  })

  return {
    processed: true,
    parsed: {
      dag_id: result.incident.dag_id,
      task_id: result.incident.task_id,
      run_id: 'manual__demo',
      execution_date: '2026-06-30T03:14:08Z',
      error_message: result.incident.raw_error,
      stack_trace: null,
      source_tables: result.incident.source_tables ?? [],
      target_tables: result.incident.target_tables ?? [],
      log_chars: logText.length,
      log_preview: logText.slice(0, 400)
    },
    result,
    formatted: [
      `## ${incidentId}`,
      `Parsed from pasted log`,
      `DAG: ${result.incident.dag_id}`,
      `Task: ${result.incident.task_id}`,
      `Category: ${result.incident.failure_category}`,
      `Advice: ${result.advice.recommended_fix}`
    ].join('\n')
  }
}
