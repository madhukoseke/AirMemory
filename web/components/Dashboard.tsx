'use client'

import dynamic from 'next/dynamic'
import { HomeDashboard } from '@/components/HomeDashboard'
import { MarkdownDoc } from '@/components/MarkdownDoc'
import { DOC_KIND_LABEL, DOCS, getDoc, listDocs, type DocKind } from '@/lib/docs'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  GitBranch,
  Home,
  LayoutDashboard,
  Menu,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildRecallQuestion,
  buildRunbookContext,
  emitRuntimeFailure,
  forgetDeprecated,
  generateRunbook,
  getGraph,
  getHealth,
  getRuntimeIncident,
  getRuntimeSummary,
  improveMemory,
  isDemoMode,
  listRuntimeIncidents,
  processRuntimeFailure,
  recallMemory,
  runEval,
  seedAirMemory,
  type Citation,
  type EvalResponse,
  type ForgetResponse,
  type GraphPath,
  type ImproveResponse,
  type RecallResponse,
  type ResolutionRank,
  type RuntimeIncidentResult,
  type RuntimeSummary,
  type SeedResponse
} from '@/lib/api'
import { DEMO_BOOTSTRAP } from '@/lib/demo'

const LineageGraph = dynamic(
  () => import('@/components/LineageGraph').then((mod) => mod.LineageGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-control border border-border bg-surface text-xs text-muted">
        graph loading
      </div>
    )
  }
)

const DEFAULT_QUESTION = 'Have we seen validate_row_counts fail on customer_master before? Root cause and safe fix?'
const DOWNSTREAM_QUESTION =
  'Looker customer_metrics is stale after publish_metrics. Have we seen the upstream cause?'

const SEED_INCIDENT = {
  id: 'INC-1029',
  dag: 'customer_daily_migration_dag',
  task: 'validate_row_counts',
  error: 'ROW_COUNT_MISMATCH',
  category: 'row_count_mismatch',
  counts: 'HANA 1588 / BigQuery 1297 / diff 291',
  blocked: 'publish_metrics',
  table: 'bq.prod.customer_master',
  source: 'seed' as const
}

type ActiveIncident = {
  id: string
  dag: string
  task: string
  error: string
  category: string
  counts?: string
  blocked?: string
  table?: string
  source: 'runtime' | 'seed'
}

type ViewId = 'home' | 'overview' | 'recall' | 'lineage' | 'docs' | 'runtime' | 'improve' | 'forget' | 'evals' | 'settings'

type IconType = ComponentType<{ size?: number; className?: string }>

type NavItem = {
  id: ViewId
  label: string
  description: string
  icon: IconType
}

type BusyAction = 'refresh' | 'recall' | 'lineage' | 'runtime' | 'improve' | 'forget' | 'eval' | null

const PRIMARY_NAV: NavItem[] = [
  { id: 'home', label: 'Dashboard', description: '', icon: Home },
  { id: 'overview', label: 'Incident', description: '', icon: LayoutDashboard },
  { id: 'recall', label: 'Recall', description: '', icon: Brain },
  { id: 'lineage', label: 'Lineage', description: '', icon: GitBranch },
  { id: 'docs', label: 'Docs', description: '', icon: BookOpen }
]

const TOOL_NAV: NavItem[] = [
  { id: 'runtime', label: 'Runtime', description: '', icon: Zap },
  { id: 'improve', label: 'Improve', description: '', icon: ThumbsUp },
  { id: 'forget', label: 'Forget', description: '', icon: Trash2 },
  { id: 'evals', label: 'Evals', description: '', icon: BarChart3 },
  { id: 'settings', label: 'Settings', description: '', icon: Settings }
]

const NAV_ITEMS: NavItem[] = [...PRIMARY_NAV, ...TOOL_NAV]

function activeFromRuntime(detail: RuntimeIncidentResult): ActiveIncident {
  const tables = [...(detail.incident.source_tables ?? []), ...(detail.incident.target_tables ?? [])]
  return {
    id: detail.incident.incident_id,
    dag: detail.incident.dag_id,
    task: detail.incident.task_id,
    error: detail.incident.failure_category,
    category: detail.incident.failure_category,
    table: tables[0],
    blocked: tables[1],
    source: 'runtime'
  }
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>('home')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [health, setHealth] = useState<Record<string, string | boolean> | null>(() =>
    isDemoMode ? DEMO_BOOTSTRAP.health : null
  )
  const [seed, setSeed] = useState<SeedResponse | null>(() => (isDemoMode ? DEMO_BOOTSTRAP.seed : null))
  const [recall, setRecall] = useState<RecallResponse | null>(() => (isDemoMode ? DEMO_BOOTSTRAP.recall() : null))
  const [graph, setGraph] = useState<GraphPath | null>(() => (isDemoMode ? DEMO_BOOTSTRAP.graph : null))
  const [improve, setImprove] = useState<ImproveResponse | null>(null)
  const [forget, setForget] = useState<ForgetResponse | null>(null)
  const [evalResult, setEvalResult] = useState<EvalResponse | null>(null)
  const [runtimeSummary, setRuntimeSummary] = useState<RuntimeSummary | null>(() =>
    isDemoMode ? DEMO_BOOTSTRAP.summary : null
  )
  const [runtimeIncidents, setRuntimeIncidents] = useState<string[]>(() =>
    isDemoMode ? [...DEMO_BOOTSTRAP.incidentIds] : []
  )
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(() =>
    isDemoMode ? DEMO_BOOTSTRAP.incidentIds[0] : null
  )
  const [runtimeDetail, setRuntimeDetail] = useState<RuntimeIncidentResult | null>(() =>
    isDemoMode ? DEMO_BOOTSTRAP.detail() : null
  )
  const [runtimeFormatted, setRuntimeFormatted] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>(isDemoMode ? null : 'refresh')
  const [selectedDocId, setSelectedDocId] = useState(DOCS.find((doc) => doc.kind === 'incident')?.id ?? DOCS[0]?.id ?? 'index.md')

  const activeIncident: ActiveIncident = runtimeDetail ? activeFromRuntime(runtimeDetail) : SEED_INCIDENT
  const activeRanks = recall?.resolutions ?? []
  const accepted = activeRanks.find((rank) => rank.id === 'res-window-3-day')
  const topResolution = activeRanks[0]
  const deprecatedVisible = activeRanks.some((rank) => rank.id === 'res-full-dag-clear')
  const graphForDisplay = graph ?? recall?.graph_path ?? null
  const isBusy = busyAction !== null

  const sourceCounts = useMemo(() => Object.entries(seed?.counts_by_source ?? {}), [seed])

  const runAction = useCallback(async (action: Exclude<BusyAction, null>, work: () => Promise<void>) => {
    setBusyAction(action)
    try {
      setError(null)
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`)
    } finally {
      setBusyAction(null)
    }
  }, [])

  const syncMemoryForIncident = useCallback(async (detail: RuntimeIncidentResult | null, nextQuestion?: string) => {
    const recallQuestion = nextQuestion ?? (detail ? buildRecallQuestion(detail) : DEFAULT_QUESTION)
    const runbookContext = detail ? buildRunbookContext(detail) : undefined
    const dagId = detail?.incident.dag_id
    const taskId = detail?.incident.task_id

    const [recallResult, graphResult] = await Promise.all([
      recallMemory({ question: recallQuestion, dagId, taskId }),
      getGraph(dagId)
    ])
    await generateRunbook(runbookContext)

    setQuestion(recallQuestion)
    setRecall(recallResult)
    setGraph(recallResult.graph_path ?? graphResult)
  }, [])

  const refreshAll = useCallback(
    async (nextQuestion: string, action: Exclude<BusyAction, null> = 'refresh') => {
      await runAction(action, async () => {
        const [healthResult, seedResult] = await Promise.all([getHealth(), seedAirMemory()])
        setHealth(healthResult)
        setSeed(seedResult)
        await syncMemoryForIncident(runtimeDetail, nextQuestion)
      })
    },
    [runAction, runtimeDetail, syncMemoryForIncident]
  )

  const loadRuntime = useCallback(
    async (preferId?: string | null) => {
      const [summary, incidents] = await Promise.all([getRuntimeSummary(), listRuntimeIncidents()])
      setRuntimeSummary(summary)
      setRuntimeIncidents(incidents.incident_ids)

      const nextId = preferId && incidents.incident_ids.includes(preferId) ? preferId : incidents.incident_ids[0] ?? null
      setSelectedIncidentId(nextId)

      if (!nextId) {
        setRuntimeDetail(null)
        return null
      }

      const detail = await getRuntimeIncident(nextId)
      setRuntimeDetail(detail)
      return detail
    },
    []
  )

  const refreshRuntime = useCallback(async () => {
    await runAction('runtime', async () => {
      const detail = await loadRuntime(selectedIncidentId)
      if (detail) {
        await syncMemoryForIncident(detail)
      }
    })
  }, [loadRuntime, runAction, selectedIncidentId, syncMemoryForIncident])

  useEffect(() => {
    void (async () => {
      if (!isDemoMode) {
        setBusyAction('refresh')
      }
      try {
        setError(null)
        const [healthResult, seedResult, detail] = await Promise.all([getHealth(), seedAirMemory(), loadRuntime()])
        setHealth(healthResult)
        setSeed(seedResult)
        await syncMemoryForIncident(detail)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'refresh failed')
      } finally {
        setBusyAction(null)
      }
    })()
  }, [loadRuntime, syncMemoryForIncident])

  function switchView(view: ViewId) {
    setActiveView(view)
    setMobileNavOpen(false)
  }

  function askCurrent() {
    setActiveView('recall')
    void refreshAll(question, 'recall')
  }

  function askDownstream() {
    setQuestion(DOWNSTREAM_QUESTION)
    setActiveView('lineage')
    void refreshAll(DOWNSTREAM_QUESTION, 'lineage')
  }

  function submitImprove() {
    setActiveView('improve')
    void runAction('improve', async () => {
      const feedbackIncidentId =
        activeIncident.source === 'runtime' && runtimeDetail?.similar_incidents[0]?.incident_id
          ? runtimeDetail.similar_incidents[0].incident_id
          : 'INC-1029'

      const improved = await improveMemory({
        incidentId: feedbackIncidentId,
        feedback:
          activeIncident.source === 'runtime'
            ? `Confirmed runtime advice for ${activeIncident.id}: ${runtimeDetail?.advice.recommended_fix ?? 'accepted fix'}`
            : 'Confirmed the 3 day processing_date window resolved the incident.',
        acceptedResolution: 'res-window-3-day'
      })
      const recalled = await recallMemory({
        question,
        dagId: activeIncident.dag,
        taskId: activeIncident.task
      })
      setImprove(improved)
      setRecall(recalled)
      if (recalled.graph_path) {
        setGraph(recalled.graph_path)
      }
    })
  }

  function submitForget() {
    setActiveView('forget')
    void runAction('forget', async () => {
      const forgotten = await forgetDeprecated()
      const recalled = await recallMemory({
        question,
        dagId: activeIncident.dag,
        taskId: activeIncident.task
      })
      setForget(forgotten)
      setRecall(recalled)
      if (recalled.graph_path) {
        setGraph(recalled.graph_path)
      }
    })
  }

  function submitEval() {
    setActiveView('evals')
    void runAction('eval', async () => {
      const result = await runEval()
      setEvalResult(result)
    })
  }

  function emitAndProcessRuntime() {
    setActiveView('home')
    void runAction('runtime', async () => {
      await emitRuntimeFailure()
      const processed = await processRuntimeFailure()
      setRuntimeFormatted(processed.formatted)
      const nextId = processed.result?.incident.incident_id ?? null
      const detail = await loadRuntime(nextId)
      if (detail) {
        await syncMemoryForIncident(detail)
      } else if (processed.result) {
        setRuntimeDetail(processed.result)
        setSelectedIncidentId(processed.result.incident.incident_id)
        await syncMemoryForIncident(processed.result)
      }
    })
  }

  function selectRuntimeIncident(incidentId: string) {
    void runAction('runtime', async () => {
      setSelectedIncidentId(incidentId)
      const detail = await getRuntimeIncident(incidentId)
      setRuntimeDetail(detail)
      await syncMemoryForIncident(detail)
    })
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-text">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <ControlNav activeIncident={activeIncident} activeView={activeView} onSelect={switchView} />
        <MobileNav
          activeIncident={activeIncident}
          open={mobileNavOpen}
          activeView={activeView}
          onClose={() => setMobileNavOpen(false)}
          onSelect={switchView}
        />

        <main className="min-w-0 overflow-x-hidden px-4 pb-14 pt-6 sm:px-6 lg:px-10">
          <CommandBar
            activeIncident={activeIncident}
            activeView={activeView}
            busyAction={busyAction}
            isBusy={isBusy}
            question={question}
            seed={seed}
            onMenu={() => setMobileNavOpen(true)}
            onQuestionChange={setQuestion}
            onRecall={askCurrent}
            onRefresh={() => void refreshAll(question)}
          />

          {error ? (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-control border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          ) : null}

          <div className="mt-5">
            {activeView === 'home' ? (
              <HomeDashboard
                activeIncident={activeIncident}
                isBusy={isBusy}
                recall={recall}
                runtimeDetail={runtimeDetail}
                seed={seed}
                summary={runtimeSummary}
                onEmitAndProcess={emitAndProcessRuntime}
                onOpenLineage={askDownstream}
                onOpenOverview={() => switchView('overview')}
                onOpenRecall={askCurrent}
                onOpenDocs={(docId) => {
                  setSelectedDocId(docId ?? 'incidents/inc_1029.md')
                  switchView('docs')
                }}
              />
            ) : null}

            {activeView === 'overview' ? (
              <OverviewView
                activeIncident={activeIncident}
                accepted={accepted}
                graph={graphForDisplay}
                incidentIds={runtimeIncidents}
                isBusy={isBusy}
                recall={recall}
                runtimeDetail={runtimeDetail}
                selectedIncidentId={selectedIncidentId}
                summary={runtimeSummary}
                topResolution={topResolution}
                onDownstream={askDownstream}
                onEmitAndProcess={emitAndProcessRuntime}
                onImprove={submitImprove}
                onRecall={askCurrent}
                onRefreshRuntime={refreshRuntime}
                onSelectIncident={selectRuntimeIncident}
              />
            ) : null}

            {activeView === 'recall' ? (
              <RecallView
                activeIncident={activeIncident}
                activeRanks={activeRanks}
                isBusy={isBusy}
                question={question}
                recall={recall}
                onQuestionChange={setQuestion}
                onRecall={askCurrent}
              />
            ) : null}

            {activeView === 'lineage' ? (
              <LineageView graph={graphForDisplay} recall={recall} onDownstream={askDownstream} isBusy={isBusy} />
            ) : null}

            {activeView === 'docs' ? (
              <DocsView
                activeIncidentId={activeIncident.id}
                selectedDocId={selectedDocId}
                onSelectDoc={setSelectedDocId}
              />
            ) : null}

            {activeView === 'runtime' ? (
              <RuntimeView
                activeIncident={activeIncident}
                formatted={runtimeFormatted}
                incidentIds={runtimeIncidents}
                isBusy={isBusy}
                runtimeDetail={runtimeDetail}
                selectedIncidentId={selectedIncidentId}
                summary={runtimeSummary}
                onEmitAndProcess={emitAndProcessRuntime}
                onRefresh={refreshRuntime}
                onSelectIncident={selectRuntimeIncident}
              />
            ) : null}

            {activeView === 'improve' ? (
              <ImproveView
                activeIncident={activeIncident}
                accepted={accepted}
                improve={improve}
                isBusy={isBusy}
                onImprove={submitImprove}
                ranks={activeRanks}
                runtimeDetail={runtimeDetail}
              />
            ) : null}

            {activeView === 'forget' ? (
              <ForgetView deprecatedVisible={deprecatedVisible} forget={forget} isBusy={isBusy} onForget={submitForget} ranks={activeRanks} />
            ) : null}

            {activeView === 'evals' ? (
              <EvalsView evalResult={evalResult} isBusy={isBusy} onEval={submitEval} />
            ) : null}

            {activeView === 'settings' ? (
              <SettingsView health={health} seed={seed} sourceCounts={sourceCounts} summary={runtimeSummary} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function ControlNav({
  activeIncident,
  activeView,
  onSelect
}: {
  activeIncident: ActiveIncident
  activeView: ViewId
  onSelect: (view: ViewId) => void
}) {
  return (
    <aside className="sticky top-0 hidden h-screen border-r border-border bg-sidebar px-3 py-6 lg:block">
      <BrandBlock />
      <nav aria-label="Primary" className="mt-10 grid gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavButton key={item.id} item={item} active={activeView === item.id} onSelect={onSelect} />
        ))}
      </nav>
      <p className="mb-2 mt-10 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Tools</p>
      <nav aria-label="Tools" className="grid gap-0.5">
        {TOOL_NAV.map((item) => (
          <NavButton key={item.id} item={item} active={activeView === item.id} onSelect={onSelect} />
        ))}
      </nav>
      <div className="absolute bottom-6 left-3 right-3 border-t border-border pt-4">
        <p className="truncate font-mono text-[11px] text-muted">{activeIncident.id}</p>
      </div>
    </aside>
  )
}

function MobileNav({
  activeIncident,
  activeView,
  onClose,
  onSelect,
  open
}: {
  activeIncident: ActiveIncident
  activeView: ViewId
  onClose: () => void
  onSelect: (view: ViewId) => void
  open: boolean
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close navigation overlay" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative flex h-full w-[min(320px,calc(100vw-40px))] flex-col border-r border-border bg-sidebar p-4 shadow-glow">
        <div className="flex items-start justify-between gap-3">
          <BrandBlock />
          <IconOnlyButton title="Close navigation" icon={<X size={18} />} onClick={onClose} />
        </div>
        <nav aria-label="Mobile primary" className="mt-6 grid gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavButton key={item.id} item={item} active={activeView === item.id} onSelect={onSelect} />
          ))}
        </nav>
        <p className="mb-2 mt-6 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Tools</p>
        <nav aria-label="Mobile tools" className="grid gap-0.5">
          {TOOL_NAV.map((item) => (
            <NavButton key={item.id} item={item} active={activeView === item.id} onSelect={onSelect} />
          ))}
        </nav>
        <p className="mt-auto px-2 font-mono text-xs text-muted">{activeIncident.id}</p>
      </aside>
    </div>
  )
}

function BrandBlock() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-[11px] font-semibold text-accent-strong">
        A
      </span>
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-text">AirMemory</h1>
        {isDemoMode ? (
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Demo</p>
        ) : null}
      </div>
    </div>
  )
}

function NavButton({ active, item, onSelect }: { active: boolean; item: NavItem; onSelect: (view: ViewId) => void }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={active ? 'nav-item nav-item-active' : 'nav-item'}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={16} className="shrink-0 opacity-80" />
      <span className="text-sm">{item.label}</span>
    </button>
  )
}

function CommandBar({
  activeIncident,
  activeView,
  busyAction,
  isBusy,
  onMenu,
  onQuestionChange,
  onRecall,
  onRefresh,
  question,
  seed
}: {
  activeIncident: ActiveIncident
  activeView: ViewId
  busyAction: BusyAction
  isBusy: boolean
  onMenu: () => void
  onQuestionChange: (value: string) => void
  onRecall: () => void
  onRefresh: () => void
  question: string
  seed: SeedResponse | null
}) {
  const currentView = NAV_ITEMS.find((item) => item.id === activeView)
  const isHome = activeView === 'home'

  if (isHome) {
    return (
      <header className="mb-2 flex items-center gap-3 lg:hidden">
        <IconOnlyButton title="Open navigation" icon={<Menu size={18} />} onClick={onMenu} />
        <p className="text-sm text-muted">AirMemory</p>
      </header>
    )
  }

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <IconOnlyButton className="lg:hidden" title="Open navigation" icon={<Menu size={18} />} onClick={onMenu} />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-text">{currentView?.label ?? 'Incident'}</h2>
          <p className="mt-0.5 truncate font-mono text-xs text-muted">
            {activeIncident.id} · {activeIncident.dag}
          </p>
        </div>
      </div>

      {activeView === 'recall' ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xl sm:justify-end">
          <label className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-border bg-panel px-3 focus-within:border-accent/50">
            <Search size={15} className="shrink-0 text-muted" />
            <span className="sr-only">Memory question</span>
            <input
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onRecall()
                }
              }}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-text outline-none"
            />
          </label>
          <ActionButton title={busyAction === 'recall' ? '...' : 'Ask'} icon={<Play size={14} />} onClick={onRecall} disabled={isBusy} />
        </div>
      ) : (
        <ActionButton
          title={busyAction === 'refresh' ? '...' : 'Refresh'}
          icon={<RefreshCw size={14} className={busyAction === 'refresh' ? 'animate-spin' : undefined} />}
          onClick={onRefresh}
          disabled={isBusy}
          tone="secondary"
        />
      )}
      <span className="sr-only">{seed?.dataset}</span>
    </header>
  )
}

function OverviewView({
  accepted,
  activeIncident,
  graph,
  incidentIds,
  isBusy,
  onDownstream,
  onEmitAndProcess,
  onImprove,
  onRecall,
  onRefreshRuntime,
  onSelectIncident,
  recall,
  runtimeDetail,
  selectedIncidentId,
  summary,
  topResolution
}: {
  accepted?: ResolutionRank
  activeIncident: ActiveIncident
  graph: GraphPath | null
  incidentIds: string[]
  isBusy: boolean
  onDownstream: () => void
  onEmitAndProcess: () => void
  onImprove: () => void
  onRecall: () => void
  onRefreshRuntime: () => void
  onSelectIncident: (incidentId: string) => void
  recall: RecallResponse | null
  runtimeDetail: RuntimeIncidentResult | null
  selectedIncidentId: string | null
  summary: RuntimeSummary | null
  topResolution?: ResolutionRank
}) {
  return (
    <div className="mx-auto grid w-full max-w-3xl min-w-0 gap-6">
      <section className="premium-card min-w-0 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                activeIncident.source === 'runtime' ? 'text-success' : 'text-warning'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  activeIncident.source === 'runtime' ? 'bg-success' : 'bg-warning'
                }`}
              />
              {activeIncident.source === 'runtime' ? 'Live' : 'Seed'}
            </span>
            <span className="text-border-strong">·</span>
            <span className="font-mono text-[12px]">{activeIncident.error}</span>
          </p>
          <ActionButton title="Emit" icon={<Zap size={14} />} onClick={onEmitAndProcess} disabled={isBusy} />
        </div>

        <h3 className="mt-5 break-words text-xl font-semibold tracking-[-0.025em] text-text">{activeIncident.task}</h3>
        <p className="mt-1.5 break-all font-mono text-[11px] text-muted">{activeIncident.dag}</p>

        <div className="mt-5 space-y-3 text-sm leading-6 text-muted">
          {runtimeDetail ? (
            <>
              <p>{runtimeDetail.advice.likely_root_cause}</p>
              <p className="text-text">{runtimeDetail.advice.recommended_fix}</p>
            </>
          ) : (
            <AnswerText answer={recall?.answer} />
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <ActionButton title="Recall" icon={<Brain size={14} />} onClick={onRecall} disabled={isBusy} tone="secondary" />
          <ActionButton title="Lineage" icon={<GitBranch size={14} />} onClick={onDownstream} disabled={isBusy} tone="secondary" />
          <ActionButton title="Confirm" icon={<ThumbsUp size={14} />} onClick={onImprove} disabled={isBusy} tone="secondary" />
        </div>
      </section>

      {runtimeDetail?.similar_incidents?.[0] ? (
        <section className="min-w-0 px-1">
          <p className="text-xs text-muted">Closest match</p>
          <p className="mt-1 break-all font-mono text-sm text-text">{runtimeDetail.similar_incidents[0].incident_id}</p>
        </section>
      ) : null}

      {incidentIds.length ? (
        <section className="premium-card min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text">Inbox</h3>
            <button type="button" className="text-xs text-muted hover:text-text" onClick={onRefreshRuntime} disabled={isBusy}>
              Refresh
            </button>
          </div>
          <IncidentInbox incidentIds={incidentIds} selectedIncidentId={selectedIncidentId} onSelect={onSelectIncident} />
          {summary ? <p className="mt-3 text-xs text-muted">{summary.queue_mode} · {summary.incident_count}</p> : null}
        </section>
      ) : null}

      <section className="premium-card min-w-0 p-5">
        <h3 className="mb-3 text-sm font-semibold text-text">Lineage</h3>
        <LineageGraph graph={graph} />
      </section>

      {accepted || topResolution ? (
        <section className="min-w-0 px-1">
          <p className="text-xs text-muted">Top fix</p>
          <p className="mt-1 text-sm text-text">{(accepted ?? topResolution)?.title}</p>
        </section>
      ) : null}
    </div>
  )
}

function RecallView({
  activeIncident,
  activeRanks,
  isBusy,
  onQuestionChange,
  onRecall,
  question,
  recall
}: {
  activeIncident: ActiveIncident
  activeRanks: ResolutionRank[]
  isBusy: boolean
  onQuestionChange: (value: string) => void
  onRecall: () => void
  question: string
  recall: RecallResponse | null
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid min-w-0 gap-4">
        <Panel title="Ask memory" icon={<Brain size={17} />}>
          <MetricGrid>
            <Metric label="Context DAG" value={activeIncident.dag} mono />
            <Metric label="Context task" value={activeIncident.task} mono />
          </MetricGrid>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-medium text-muted">Question</span>
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              className="min-h-32 w-full resize-y rounded-control border border-border bg-panel p-3 text-sm leading-6 text-text outline-none focus:border-accent/50"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton title="Recall prior incident" icon={<Play size={15} />} onClick={onRecall} disabled={isBusy} />
          </div>
        </Panel>

        <Panel title="Answer" icon={<ShieldCheck size={17} />}>
          <AnswerText answer={recall?.answer} />
        </Panel>

        <Panel title="Citation ledger" icon={<FileText size={17} />}>
          <CitationLedger citations={recall?.citations ?? []} />
        </Panel>
      </div>

      <Panel title="Resolution ranking" icon={<BarChart3 size={17} />}>
        <ResolutionList ranks={activeRanks} />
      </Panel>
    </div>
  )
}

function LineageView({
  graph,
  isBusy,
  onDownstream,
  recall
}: {
  graph: GraphPath | null
  isBusy: boolean
  onDownstream: () => void
  recall: RecallResponse | null
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Lineage graph" icon={<GitBranch size={17} />}>
        <LineageGraph graph={graph} />
        <PathSummary graph={graph} contrast={recall?.vector_only_contrast} />
        <ActionButton className="mt-4" title="Trace downstream symptom" icon={<GitBranch size={15} />} onClick={onDownstream} disabled={isBusy} />
      </Panel>

      <div className="grid min-w-0 content-start gap-4">
        <Panel title="Legend" icon={<Database size={17} />}>
          <Legend />
        </Panel>
        <Panel title="Path fallback" icon={<FileText size={17} />}>
          <PathList graph={graph} />
        </Panel>
      </div>
    </div>
  )
}

function DocsView({
  activeIncidentId,
  onSelectDoc,
  selectedDocId
}: {
  activeIncidentId: string
  onSelectDoc: (id: string) => void
  selectedDocId: string
}) {
  const selected = getDoc(selectedDocId)
  const groups: DocKind[] = ['incident', 'runbook', 'pattern', 'index']
  const relatedHint =
    activeIncidentId.toLowerCase().includes('1029') || activeIncidentId.toLowerCase().includes('demo')
      ? 'incidents/inc_1029.md'
      : null

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="premium-card min-w-0 p-4">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Library</p>
        <div className="grid gap-5">
          {groups.map((kind) => {
            const items = listDocs(kind)
            if (!items.length) return null
            return (
              <div key={kind}>
                <p className="mb-2 text-[11px] font-medium text-muted">{DOC_KIND_LABEL[kind]}</p>
                <div className="grid gap-0.5">
                  {items.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => onSelectDoc(doc.id)}
                      className={
                        selectedDocId === doc.id
                          ? 'rounded-control bg-surface px-2.5 py-2 text-left text-[13px] text-text'
                          : 'rounded-control px-2.5 py-2 text-left text-[13px] text-muted hover:bg-surface hover:text-text'
                      }
                    >
                      <span className="line-clamp-2">{doc.title.replace(/^#\s*/, '')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {relatedHint ? (
          <button
            type="button"
            onClick={() => onSelectDoc(relatedHint)}
            className="mt-5 w-full border-t border-border pt-4 text-left text-[12px] text-accent-strong hover:text-accent"
          >
            Open write-up for {activeIncidentId} →
          </button>
        ) : null}
      </aside>

      <section className="premium-card min-w-0 p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <BookOpen size={15} className="text-muted" />
          <p className="font-mono text-[11px] text-muted">{selected.id}</p>
        </div>
        <MarkdownDoc source={selected.body} />
      </section>
    </div>
  )
}

function ImproveView({
  accepted,
  activeIncident,
  improve,
  isBusy,
  onImprove,
  ranks,
  runtimeDetail
}: {
  accepted?: ResolutionRank
  activeIncident: ActiveIncident
  improve: ImproveResponse | null
  isBusy: boolean
  onImprove: () => void
  ranks: ResolutionRank[]
  runtimeDetail: RuntimeIncidentResult | null
}) {
  const feedbackTarget =
    runtimeDetail?.similar_incidents[0]?.incident_id ?? (activeIncident.source === 'seed' ? activeIncident.id : 'INC-1029')

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Feedback control" icon={<ThumbsUp size={17} />}>
        <MetricGrid>
          <Metric label="Active incident" value={activeIncident.id} mono />
          <Metric label="Feedback target" value={feedbackTarget} mono />
          <Metric label="Accepted fix" value="res-window-3-day" mono />
          <Metric label="Current rank" value={accepted ? `#${accepted.rank}` : 'pending'} tone={accepted?.rank === 1 ? 'success' : 'warning'} mono />
          <Metric label="Current score" value={accepted ? accepted.score.toFixed(2) : 'pending'} mono />
        </MetricGrid>
        <div className="mt-4 rounded-control border border-border bg-bg p-3">
          <p className="text-xs font-medium text-muted">Feedback payload</p>
          <p className="mt-2 font-mono text-sm leading-6 text-text">
            {activeIncident.source === 'runtime'
              ? `Confirmed runtime advice for ${activeIncident.id}: ${runtimeDetail?.advice.recommended_fix ?? 'accepted fix'}`
              : 'Confirmed the 3 day processing_date window resolved the incident.'}
          </p>
        </div>
        <ActionButton className="mt-4" title="Confirm fix and improve ranking" icon={<ThumbsUp size={15} />} onClick={onImprove} disabled={isBusy} />
      </Panel>

      <div className="grid min-w-0 content-start gap-4">
        <Panel title="Rank movement" icon={<Activity size={17} />}>
          <MetricGrid>
            <Metric label="Before" value={improve ? `#${improve.rank_before} / ${improve.score_before.toFixed(2)}` : 'not applied'} mono />
            <Metric label="After" value={improve ? `#${improve.rank_after} / ${improve.score_after.toFixed(2)}` : 'not applied'} tone={improve ? 'success' : 'muted'} mono />
            <Metric label="Session" value={improve?.session_id ?? 'pending'} mono />
          </MetricGrid>
        </Panel>
        <Panel title="Current ranks" icon={<BarChart3 size={17} />}>
          <ResolutionList ranks={ranks} compact />
        </Panel>
      </div>
    </div>
  )
}

function ForgetView({
  deprecatedVisible,
  forget,
  isBusy,
  onForget,
  ranks
}: {
  deprecatedVisible: boolean
  forget: ForgetResponse | null
  isBusy: boolean
  onForget: () => void
  ranks: ResolutionRank[]
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Forget control" icon={<Trash2 size={17} />} action={<StatusPill tone={deprecatedVisible ? 'danger' : 'success'}>{deprecatedVisible ? 'visible' : 'clean'}</StatusPill>}>
        <MetricGrid>
          <Metric label="Target dataset" value="airmemory_deprecated_full_dag_clear" mono />
          <Metric label="Resolution" value="res-full-dag-clear" mono />
          <Metric label="Deprecated visible" value={deprecatedVisible ? 'yes' : 'no'} tone={deprecatedVisible ? 'danger' : 'success'} mono />
          <Metric label="Leakage check" value={forget ? `${forget.leakage_check}` : 'pending'} tone={forget?.leakage_check === 0 ? 'success' : 'muted'} mono />
        </MetricGrid>
        <div className="mt-4 rounded-control border border-warning/20 bg-warning/10 p-3 text-sm leading-6 text-warning">
          This removes the deprecated workaround from retrieval. It does not run or clear any Airflow task.
        </div>
        <ActionButton className="mt-4" title="Remove deprecated workaround" icon={<Trash2 size={15} />} onClick={onForget} disabled={isBusy} tone="danger" />
      </Panel>

      <div className="grid min-w-0 content-start gap-4">
        <Panel title="Forget result" icon={<ShieldCheck size={17} />}>
          <p className="text-sm leading-6 text-muted">{forget?.message ?? 'No forget operation has been applied in this session.'}</p>
        </Panel>
        <Panel title="Visible resolutions" icon={<BarChart3 size={17} />}>
          <ResolutionList ranks={ranks} compact />
        </Panel>
      </div>
    </div>
  )
}

function EvalsView({ evalResult, isBusy, onEval }: { evalResult: EvalResponse | null; isBusy: boolean; onEval: () => void }) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Panel title="Evaluation summary" icon={<BarChart3 size={17} />}>
        <MetricGrid>
          <Metric label="Cold recall @1" value={evalResult ? pct(evalResult.before.recall_at_1) : 'pending'} mono />
          <Metric label="Warm recall @1" value={evalResult ? pct(evalResult.after.recall_at_1) : 'pending'} tone={evalResult ? 'success' : 'muted'} mono />
          <Metric label="Recall @3" value={evalResult ? pct(evalResult.after.recall_at_3) : 'pending'} mono />
          <Metric label="Forget leakage" value={evalResult ? `${evalResult.forget_leakage}` : 'pending'} tone={evalResult?.forget_leakage === 0 ? 'success' : 'muted'} mono />
        </MetricGrid>
        <EvalBars evalResult={evalResult} />
        <ActionButton className="mt-4" title="Run eval harness" icon={<Activity size={15} />} onClick={onEval} disabled={isBusy} />
      </Panel>

      <Panel title="Eval rows" icon={<FileText size={17} />}>
        <EvalRowsTable evalResult={evalResult} />
      </Panel>
    </div>
  )
}

function RuntimeView({
  activeIncident,
  formatted,
  incidentIds,
  isBusy,
  onEmitAndProcess,
  onRefresh,
  onSelectIncident,
  runtimeDetail,
  selectedIncidentId,
  summary
}: {
  activeIncident: ActiveIncident
  formatted: string | null
  incidentIds: string[]
  isBusy: boolean
  onEmitAndProcess: () => void
  onRefresh: () => void
  onSelectIncident: (incidentId: string) => void
  runtimeDetail: RuntimeIncidentResult | null
  selectedIncidentId: string | null
  summary: RuntimeSummary | null
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Live worker pipeline" icon={<Zap size={17} />}>
        <MetricGrid>
          <Metric label="Queue mode" value={summary?.queue_mode ?? 'pending'} mono />
          <Metric label="Processed incidents" value={summary ? `${summary.incident_count}` : '0'} mono />
          <Metric label="Active incident" value={activeIncident.id} mono />
          <Metric label="Latest summary" value={summary?.latest_summary ?? 'No processed incidents yet'} />
        </MetricGrid>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton title="Emit demo failure" icon={<Play size={15} />} onClick={onEmitAndProcess} disabled={isBusy} />
          <ActionButton title="Refresh runtime inbox" icon={<RefreshCw size={15} />} onClick={onRefresh} disabled={isBusy} />
        </div>
        {formatted ? (
          <pre className="mt-4 max-h-[280px] min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-control border border-border bg-bg p-3 font-mono text-xs leading-6 text-text">
            {formatted}
          </pre>
        ) : null}
        {runtimeDetail?.cognee_recall_text ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted">Cognee evidence</p>
            <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-control border border-border bg-bg p-3 font-mono text-xs leading-6 text-muted">
              {runtimeDetail.cognee_recall_text}
            </pre>
          </div>
        ) : null}
      </Panel>

      <div className="grid min-w-0 content-start gap-4">
        <Panel title="Incident inbox" icon={<Activity size={17} />}>
          <IncidentInbox incidentIds={incidentIds} selectedIncidentId={selectedIncidentId} onSelect={onSelectIncident} />
        </Panel>

        <Panel title="Selected incident" icon={<CheckCircle2 size={17} />}>
          {runtimeDetail ? (
            <div className="grid gap-3 text-sm leading-6">
              <p>
                <span className="font-semibold text-text">DAG:</span> {runtimeDetail.incident.dag_id}
              </p>
              <p>
                <span className="font-semibold text-text">Task:</span> {runtimeDetail.incident.task_id}
              </p>
              <p>
                <span className="font-semibold text-text">Category:</span> {runtimeDetail.incident.failure_category}
              </p>
              <p className="text-muted">{runtimeDetail.advice.likely_root_cause}</p>
              <p className="text-text">{runtimeDetail.advice.recommended_fix}</p>
              {runtimeDetail.advice.rejected_fix_warning ? (
                <p className="text-danger">{runtimeDetail.advice.rejected_fix_warning}</p>
              ) : null}
              {runtimeDetail.similar_incidents.length ? (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted">Similar matches</p>
                  {runtimeDetail.similar_incidents.map((match) => (
                    <p key={match.incident_id} className="font-mono text-xs text-text">
                      {match.incident_id} · {match.similarity_score.toFixed(2)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">Select an incident from the inbox or process a new failure.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function SettingsView({
  health,
  seed,
  sourceCounts,
  summary
}: {
  health: Record<string, string | boolean> | null
  seed: SeedResponse | null
  sourceCounts: Array<[string, number]>
  summary: RuntimeSummary | null
}) {
  return (
    <div className="mx-auto grid w-full max-w-3xl min-w-0 gap-4">
      <Panel title="Runtime" icon={<Settings size={17} />}>
        <MetricGrid>
          <Metric
            label="Mode"
            value={isDemoMode ? 'Demo (client-side)' : 'Live API'}
            tone={isDemoMode ? 'warning' : 'success'}
            mono
          />
          <Metric label="Service" value={String(health?.service ?? health?.mode ?? 'AirMemory')} mono />
          <Metric
            label="Cognee"
            value={health?.cognee_enabled ? 'Live Cognee' : 'Adapter / demo'}
            tone={health?.cognee_enabled ? 'success' : 'muted'}
            mono
          />
          <Metric label="Dataset" value={seed?.dataset ?? 'airmemory'} mono />
          <Metric label="Queue" value={summary?.queue_mode ?? 'pending'} mono />
          <Metric label="Docs library" value="web/content/docs" mono />
          <Metric label="Wiki dir" value={summary?.wiki_dir ?? 'pending'} mono />
        </MetricGrid>
      </Panel>

      <Panel title="Source inventory" icon={<Database size={17} />}>
        {sourceCounts.length ? (
          <div className="grid gap-2">
            {sourceCounts.map(([source, count]) => (
              <div
                key={source}
                className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0"
              >
                <span className="font-mono text-text">{source}</span>
                <span className="font-mono text-text">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Seed data has not loaded yet.</p>
        )}
      </Panel>

      <section className="premium-card min-w-0 p-5">
        <h3 className="text-sm font-semibold text-text">Markdown memory</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Incident write-ups live under <span className="font-mono text-text">content/docs/incidents</span>, with matching
          runbooks and patterns. Open the Docs view to browse summary, root cause, and fix notes.
        </p>
      </section>
    </div>
  )
}

function IncidentInbox({
  incidentIds,
  onSelect,
  selectedIncidentId
}: {
  incidentIds: string[]
  onSelect: (incidentId: string) => void
  selectedIncidentId: string | null
}) {
  if (!incidentIds.length) {
    return <p className="text-sm text-muted">No runtime incidents yet. Emit and process a demo failure to populate the inbox.</p>
  }

  return (
    <div className="grid gap-2">
      {incidentIds.map((incidentId) => {
        const selected = incidentId === selectedIncidentId
        return (
          <button
            key={incidentId}
            type="button"
            className={
              selected
                ? 'flex min-h-11 items-center justify-between gap-3 rounded-control border border-accent/40 bg-accent-soft px-3 py-2 text-left text-sm'
                : 'flex min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-panel px-3 py-2 text-left text-sm hover:bg-surface2'
            }
            onClick={() => onSelect(incidentId)}
            aria-current={selected ? 'true' : undefined}
          >
            <span className="min-w-0 truncate font-mono text-text">{incidentId}</span>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </button>
        )
      })}
    </div>
  )
}

function Panel({ action, children, icon, title }: { action?: ReactNode; children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="premium-card min-w-0 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted">{icon}</span>
          <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-2">{children}</dl>
}

function Metric({
  label,
  mono = false,
  tone = 'default',
  value
}: {
  label: string
  mono?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted'
  value: string
}) {
  return (
    <div className="grid gap-1 border-b border-border py-2 last:border-b-0 sm:grid-cols-[136px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={`${mono ? 'font-mono' : ''} min-w-0 text-sm leading-6 ${toneTextClass(tone)}`}>
        <span className="block truncate" title={value}>{value}</span>
      </dd>
    </div>
  )
}

function ActionButton({
  className = '',
  disabled,
  icon,
  onClick,
  title,
  tone = 'primary'
}: {
  className?: string
  disabled: boolean
  icon: ReactNode
  onClick: () => void
  title: string
  tone?: 'primary' | 'secondary' | 'danger'
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`control-button ${buttonToneClass(tone)} ${className}`}>
      {icon}
      <span className="truncate">{title}</span>
    </button>
  )
}

function IconOnlyButton({
  className = '',
  icon,
  onClick,
  title
}: {
  className?: string
  icon: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={`icon-button ${className}`}>
      {icon}
    </button>
  )
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'success' | 'warning' | 'danger' }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pillToneClass(tone)}`}>{children}</span>
}

function AnswerText({ answer }: { answer?: string }) {
  return <p className="min-h-28 whitespace-pre-wrap text-sm leading-7 text-text">{answer ?? 'Waiting for recall.'}</p>
}

function CitationLedger({ citations, compact = false }: { citations: Citation[]; compact?: boolean }) {
  if (!citations.length) {
    return <p className="text-sm text-muted">No citations loaded yet.</p>
  }

  return (
    <div className={compact ? 'mt-4 grid gap-2' : 'grid gap-2'}>
      {citations.map((citation) => (
        <div key={citation.id} className="grid gap-2 border-b border-border py-3 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-text" title={citation.label}>
              {citation.label}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">{citation.source}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-6 text-text">{citation.excerpt}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {citation.facets.slice(0, 4).map((facet) => (
                <span key={facet} className="rounded-full border border-border bg-bg px-2 py-1 font-mono text-[11px] text-muted">
                  {facet}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ResolutionList({ compact = false, ranks }: { compact?: boolean; ranks: ResolutionRank[] }) {
  if (!ranks.length) {
    return <p className="text-sm text-muted">Run recall to populate resolution ranks.</p>
  }

  return (
    <div className="grid gap-2">
      {ranks.map((rank) => (
        <div key={rank.id} className="grid min-h-11 gap-2 border-b border-border py-3 last:border-b-0 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-start">
          <span className={rank.rank === 1 ? 'font-mono text-sm text-text' : 'font-mono text-sm text-muted'}>#{rank.rank}</span>
          <div className="min-w-0">
            <p className={`${compact ? 'text-sm' : 'text-base'} leading-6 text-text`}>{rank.title}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted" title={rank.id}>{rank.id}</p>
          </div>
          <span className={`w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${rank.status === 'deprecated' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-success/30 bg-success/10 text-success'}`}>
            {rank.status}
          </span>
        </div>
      ))}
    </div>
  )
}

function PathSummary({ contrast, graph }: { contrast?: string | null; graph: GraphPath | null }) {
  return (
    <div className="mt-4 grid gap-2">
      <p className="text-sm leading-6 text-muted">{graph?.explanation ?? 'Lineage graph pending.'}</p>
      {contrast ? <p className="rounded-control border border-border bg-bg p-3 text-sm leading-6 text-muted">{contrast}</p> : null}
    </div>
  )
}

function PathList({ graph }: { graph: GraphPath | null }) {
  if (!graph) {
    return <p className="text-sm text-muted">Graph path pending.</p>
  }

  return (
    <div className="grid gap-2">
      {graph.edges.map((edge) => (
        <div key={edge.id} className="border-b border-border py-2 last:border-b-0">
          <p className={edge.active ? 'font-mono text-xs text-text' : 'font-mono text-xs text-muted'}>{edge.label}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-text">
            {edge.source} {'->'} {edge.target}
          </p>
        </div>
      ))}
    </div>
  )
}

function Legend() {
  const items = [
    ['Pipeline', 'bg-graph-pipeline'],
    ['Task', 'bg-graph-task'],
    ['Table', 'bg-graph-table'],
    ['Incident', 'bg-graph-incident'],
    ['Resolution', 'bg-graph-resolution']
  ]

  return (
    <div className="grid gap-3">
      {items.map(([label, color]) => (
        <div key={label} className="flex min-h-11 items-center gap-3 border-b border-border py-2 last:border-b-0">
          <span className={`h-3 w-3 rounded-full ${color}`} />
          <span className="text-sm text-text">{label}</span>
        </div>
      ))}
    </div>
  )
}

function EvalBars({ evalResult }: { evalResult: EvalResponse | null }) {
  const before = evalResult?.before.recall_at_1 ?? 0
  const after = evalResult?.after.recall_at_1 ?? 0

  return (
    <div className="mt-5 grid gap-3">
      <EvalBar label="Cold @1" value={before} />
      <EvalBar label="Warm @1" value={after} accent />
    </div>
  )
}

function EvalBar({ accent = false, label, value }: { accent?: boolean; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-xs text-text">{pct(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <div className={accent ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-text'} style={{ width: `${Math.max(value * 100, value > 0 ? 6 : 0)}%` }} />
      </div>
    </div>
  )
}

function EvalRowsTable({ evalResult }: { evalResult: EvalResponse | null }) {
  if (!evalResult?.rows.length) {
    return <p className="text-sm text-muted">Run the eval harness to inspect row-level results.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-semibold">Pass</th>
            <th className="py-2 pr-4 font-semibold">Query</th>
            <th className="py-2 pr-4 font-semibold">Expected</th>
            <th className="py-2 pr-4 font-semibold">Rank</th>
            <th className="py-2 pr-4 font-semibold">@1</th>
            <th className="py-2 font-semibold">@3</th>
          </tr>
        </thead>
        <tbody>
          {evalResult.rows.map((row, index) => (
            <tr key={`${String(row.pass)}-${index}`} className="border-b border-border last:border-b-0">
              <td className="py-3 pr-4 font-mono text-xs text-text">{String(row.pass ?? '')}</td>
              <td className="max-w-[360px] py-3 pr-4 text-text">{String(row.query ?? '')}</td>
              <td className="py-3 pr-4 font-mono text-xs text-muted">{String(row.expected_resolution ?? '')}</td>
              <td className="py-3 pr-4 font-mono text-xs text-text">{String(row.actual_rank ?? '')}</td>
              <td className="py-3 pr-4 font-mono text-xs text-text">{String(row.in_top_1 ?? '')}</td>
              <td className="py-3 font-mono text-xs text-text">{String(row.in_top_3 ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function toneTextClass(tone: 'default' | 'success' | 'warning' | 'danger' | 'muted') {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'muted') return 'text-muted'
  return 'text-text'
}


function buttonToneClass(tone: 'primary' | 'secondary' | 'danger') {
  if (tone === 'danger') return 'border-danger/25 bg-danger/10 text-danger hover:bg-danger/15'
  if (tone === 'secondary') return 'border-border bg-transparent text-text hover:bg-surface'
  return 'border-transparent bg-accent text-white hover:bg-accent-strong'
}

function pillToneClass(tone: 'success' | 'warning' | 'danger') {
  if (tone === 'success') return 'border-success/30 bg-success/10 text-success'
  if (tone === 'danger') return 'border-danger/30 bg-danger/10 text-danger'
  return 'border-warning/30 bg-warning/10 text-warning'
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

