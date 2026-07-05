'use client'

import dynamic from 'next/dynamic'
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
  forgetDeprecated,
  generateRunbook,
  getGraph,
  getHealth,
  improveMemory,
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
  type SeedResponse
} from '@/lib/api'

const LineageGraph = dynamic(
  () => import('@/components/LineageGraph').then((mod) => mod.LineageGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-[6px] border border-border bg-surface text-xs text-muted">
        graph loading
      </div>
    )
  }
)

const DEFAULT_QUESTION = 'Have we seen validate_row_counts fail on customer_master before? Root cause and safe fix?'
const DOWNSTREAM_QUESTION =
  'Looker customer_metrics is stale after publish_metrics. Have we seen the upstream cause?'

const INCIDENT = {
  id: 'INC-1029',
  dag: 'customer_daily_migration_dag',
  task: 'validate_row_counts',
  error: 'ROW_COUNT_MISMATCH',
  counts: 'HANA 1588 / BigQuery 1297 / diff 291',
  blocked: 'publish_metrics',
  table: 'bq.prod.customer_master'
}

type ViewId = 'overview' | 'recall' | 'lineage' | 'improve' | 'forget' | 'evals' | 'settings'

type IconType = ComponentType<{ size?: number; className?: string }>

type NavItem = {
  id: ViewId
  label: string
  description: string
  icon: IconType
}

type RunbookState = {
  markdown: string
  citations: Citation[]
}

type BusyAction = 'refresh' | 'recall' | 'lineage' | 'improve' | 'forget' | 'eval' | null

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', description: 'Incident command', icon: LayoutDashboard },
  { id: 'recall', label: 'Recall', description: 'Answers and citations', icon: Brain },
  { id: 'lineage', label: 'Lineage', description: 'Graph path reasoning', icon: GitBranch },
  { id: 'improve', label: 'Improve', description: 'Feedback and ranks', icon: ThumbsUp },
  { id: 'forget', label: 'Forget', description: 'Governance controls', icon: Trash2 },
  { id: 'evals', label: 'Evals', description: 'Recall quality', icon: BarChart3 },
  { id: 'settings', label: 'Settings', description: 'Runtime state', icon: Settings }
]

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>('overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [health, setHealth] = useState<Record<string, string | boolean> | null>(null)
  const [seed, setSeed] = useState<SeedResponse | null>(null)
  const [recall, setRecall] = useState<RecallResponse | null>(null)
  const [graph, setGraph] = useState<GraphPath | null>(null)
  const [runbook, setRunbook] = useState<RunbookState | null>(null)
  const [improve, setImprove] = useState<ImproveResponse | null>(null)
  const [forget, setForget] = useState<ForgetResponse | null>(null)
  const [evalResult, setEvalResult] = useState<EvalResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>('refresh')

  const activeRanks = recall?.resolutions ?? []
  const accepted = activeRanks.find((rank) => rank.id === 'res-window-3-day')
  const topResolution = activeRanks[0]
  const deprecatedVisible = activeRanks.some((rank) => rank.id === 'res-full-dag-clear')
  const graphForDisplay = graph ?? recall?.graph_path ?? null
  const isBusy = busyAction !== null

  const sourceCounts = useMemo(() => Object.entries(seed?.counts_by_source ?? {}), [seed])

  const kpis = useMemo(
    () => [
      {
        label: 'API',
        value: String(health?.status ?? 'pending'),
        detail: String(health?.service ?? 'AirMemory'),
        tone: health?.status === 'ok' ? 'success' : 'muted'
      },
      {
        label: 'Storage',
        value: String(health?.storage ?? 'embedded'),
        detail: 'memory backend',
        tone: 'info'
      },
      {
        label: 'Cognee',
        value: health?.cognee_enabled ? 'Live Cognee' : 'Adapter mode',
        detail: health?.cognee_enabled ? 'external memory' : 'local mirror',
        tone: health?.cognee_enabled ? 'success' : 'warning'
      },
      {
        label: 'Remembered',
        value: seed ? `${seed.remembered}` : '0',
        detail: seed?.dataset ?? 'airmemory',
        tone: seed ? 'success' : 'muted'
      },
      {
        label: 'Accepted rank',
        value: accepted ? `#${accepted.rank}` : 'pending',
        detail: accepted ? `score ${accepted.score.toFixed(2)}` : 'no recall yet',
        tone: accepted?.rank === 1 ? 'success' : 'warning'
      },
      {
        label: 'Leakage',
        value: forget ? `${forget.leakage_check}` : deprecatedVisible ? 'visible' : 'pending',
        detail: forget ? 'deprecated hits' : 'forget not run',
        tone: forget?.leakage_check === 0 ? 'success' : deprecatedVisible ? 'danger' : 'muted'
      },
      {
        label: 'Eval delta',
        value: evalResult ? formatDelta(evalResult.after.recall_at_1 - evalResult.before.recall_at_1) : 'pending',
        detail: 'warm recall @1',
        tone: evalResult ? 'success' : 'muted'
      }
    ],
    [accepted, deprecatedVisible, evalResult, forget, health, seed]
  )

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

  const refreshAll = useCallback(
    async (nextQuestion: string, action: Exclude<BusyAction, null> = 'refresh') => {
      await runAction(action, async () => {
        const [healthResult, seedResult, recallResult, graphResult, runbookResult] = await Promise.all([
          getHealth(),
          seedAirMemory(),
          recallMemory(nextQuestion),
          getGraph(),
          generateRunbook()
        ])
        setHealth(healthResult)
        setSeed(seedResult)
        setRecall(recallResult)
        setGraph(recallResult.graph_path ?? graphResult)
        setRunbook(runbookResult)
      })
    },
    [runAction]
  )

  useEffect(() => {
    void refreshAll(DEFAULT_QUESTION)
  }, [refreshAll])

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
      const improved = await improveMemory('Confirmed the 3 day processing_date window resolved the incident.')
      const recalled = await recallMemory(question)
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
      const recalled = await recallMemory(question)
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

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <ControlNav activeView={activeView} onSelect={switchView} />
        <MobileNav open={mobileNavOpen} activeView={activeView} onClose={() => setMobileNavOpen(false)} onSelect={switchView} />

        <main className="min-w-0 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          <CommandBar
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
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-[6px] border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          ) : null}

          <KpiStrip items={kpis} />

          <div className="mt-5">
            {activeView === 'overview' ? (
              <OverviewView
                accepted={accepted}
                graph={graphForDisplay}
                isBusy={isBusy}
                recall={recall}
                runbook={runbook}
                topResolution={topResolution}
                onDownstream={askDownstream}
                onEval={submitEval}
                onForget={submitForget}
                onImprove={submitImprove}
                onRecall={askCurrent}
              />
            ) : null}

            {activeView === 'recall' ? (
              <RecallView
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

            {activeView === 'improve' ? (
              <ImproveView accepted={accepted} improve={improve} isBusy={isBusy} onImprove={submitImprove} ranks={activeRanks} />
            ) : null}

            {activeView === 'forget' ? (
              <ForgetView deprecatedVisible={deprecatedVisible} forget={forget} isBusy={isBusy} onForget={submitForget} ranks={activeRanks} />
            ) : null}

            {activeView === 'evals' ? (
              <EvalsView evalResult={evalResult} isBusy={isBusy} onEval={submitEval} />
            ) : null}

            {activeView === 'settings' ? (
              <SettingsView health={health} seed={seed} sourceCounts={sourceCounts} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function ControlNav({ activeView, onSelect }: { activeView: ViewId; onSelect: (view: ViewId) => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen border-r border-border bg-panel/95 px-4 py-5 lg:block">
      <BrandBlock />
      <nav aria-label="Control plane" className="mt-7 grid gap-1">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} active={activeView === item.id} onSelect={onSelect} />
        ))}
      </nav>
      <div className="absolute bottom-5 left-4 right-4 rounded-[6px] border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          <Zap size={14} className="text-accent" />
          Active incident
        </div>
        <p className="mt-2 font-mono text-sm text-text">{INCIDENT.id}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{INCIDENT.error}</p>
      </div>
    </aside>
  )
}

function MobileNav({
  activeView,
  onClose,
  onSelect,
  open
}: {
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
      <aside className="relative flex h-full w-[min(320px,calc(100vw-40px))] flex-col border-r border-border bg-panel p-4 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-3">
          <BrandBlock />
          <IconOnlyButton title="Close navigation" icon={<X size={18} />} onClick={onClose} />
        </div>
        <nav aria-label="Mobile control plane" className="mt-6 grid gap-1">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} active={activeView === item.id} onSelect={onSelect} />
          ))}
        </nav>
      </aside>
    </div>
  )
}

function BrandBlock() {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Airflow memory ops</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-text">AirMemory</h1>
      <p className="mt-2 max-w-[210px] text-xs leading-5 text-muted">Recall, lineage, feedback, and forgetting in one operator plane.</p>
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
      <Icon size={18} className="shrink-0" />
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="block truncate text-[11px] text-muted">{item.description}</span>
      </span>
      <ChevronRight size={14} className="ml-auto shrink-0 opacity-60" />
    </button>
  )
}

function CommandBar({
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

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-bg/92 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <IconOnlyButton className="lg:hidden" title="Open navigation" icon={<Menu size={18} />} onClick={onMenu} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{currentView?.description ?? 'Control plane'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold text-text">{currentView?.label ?? 'Overview'}</h2>
              <span className="rounded-[6px] border border-border bg-surface px-2 py-1 font-mono text-[11px] text-accent">{INCIDENT.id}</span>
              <span className="min-w-0 truncate text-xs text-muted">{seed?.dataset ?? 'airmemory'} dataset</span>
            </div>
          </div>
        </div>

        <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-[6px] border border-border bg-surface px-3 focus-within:border-accent">
          <Search size={16} className="shrink-0 text-muted" />
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
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text outline-none placeholder:text-muted"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <ActionButton title={busyAction === 'recall' ? 'Recalling' : 'Recall'} icon={<Play size={15} />} onClick={onRecall} disabled={isBusy} />
          <ActionButton
            title={busyAction === 'refresh' ? 'Refreshing' : 'Refresh'}
            icon={<RefreshCw size={15} className={busyAction === 'refresh' ? 'animate-spin' : undefined} />}
            onClick={onRefresh}
            disabled={isBusy}
            tone="secondary"
          />
        </div>
      </div>
    </header>
  )
}

function KpiStrip({
  items
}: {
  items: Array<{ label: string; value: string; detail: string; tone: string }>
}) {
  return (
    <section aria-label="Runtime KPIs" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
      {items.map((item) => (
        <div key={item.label} className="rounded-[6px] border border-border bg-surface px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
            <span className={toneDotClass(item.tone)} />
          </div>
          <p className="mt-2 truncate font-mono text-sm text-text" title={item.value}>
            {item.value}
          </p>
          <p className="mt-1 truncate text-xs text-muted" title={item.detail}>
            {item.detail}
          </p>
        </div>
      ))}
    </section>
  )
}

function OverviewView({
  accepted,
  graph,
  isBusy,
  onDownstream,
  onEval,
  onForget,
  onImprove,
  onRecall,
  recall,
  runbook,
  topResolution
}: {
  accepted?: ResolutionRank
  graph: GraphPath | null
  isBusy: boolean
  onDownstream: () => void
  onEval: () => void
  onForget: () => void
  onImprove: () => void
  onRecall: () => void
  recall: RecallResponse | null
  runbook: RunbookState | null
  topResolution?: ResolutionRank
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <div className="grid gap-4">
        <Panel title="Current failure" icon={<Activity size={17} />} action={<StatusPill tone="danger">blocked</StatusPill>}>
          <MetricGrid>
            <Metric label="DAG" value={INCIDENT.dag} mono />
            <Metric label="Task" value={INCIDENT.task} mono />
            <Metric label="Error" value={INCIDENT.error} tone="danger" mono />
            <Metric label="Counts" value={INCIDENT.counts} mono />
            <Metric label="Blocked" value={INCIDENT.blocked} mono />
          </MetricGrid>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <ActionButton title="Recall" icon={<Brain size={15} />} onClick={onRecall} disabled={isBusy} />
            <ActionButton title="Lineage" icon={<GitBranch size={15} />} onClick={onDownstream} disabled={isBusy} tone="secondary" />
            <ActionButton title="Improve" icon={<ThumbsUp size={15} />} onClick={onImprove} disabled={isBusy} tone="secondary" />
            <ActionButton title="Run eval" icon={<BarChart3 size={15} />} onClick={onEval} disabled={isBusy} tone="secondary" />
          </div>
        </Panel>

        <Panel title="Latest recalled memory" icon={<ShieldCheck size={17} />}>
          <AnswerText answer={recall?.answer} />
          <CitationLedger citations={recall?.citations ?? []} compact />
        </Panel>

        <Panel title="Lineage snapshot" icon={<GitBranch size={17} />}>
          <LineageGraph graph={graph} />
          <PathSummary graph={graph} contrast={recall?.vector_only_contrast} />
        </Panel>
      </div>

      <div className="grid content-start gap-4">
        <Panel title="Top resolution" icon={<CheckCircle2 size={17} />}>
          <ResolutionHighlight accepted={accepted} topResolution={topResolution} />
        </Panel>

        <Panel title="Runbook preview" icon={<BookOpen size={17} />}>
          <RunbookPreview runbook={runbook} />
        </Panel>

        <Panel title="Governance" icon={<Trash2 size={17} />}>
          <p className="text-sm leading-6 text-muted">
            Deprecated broad DAG clears remain visible until a forget action removes the deprecated dataset and verifies zero leakage.
          </p>
          <ActionButton className="mt-4 w-full" title="Review forget control" icon={<Trash2 size={15} />} onClick={onForget} disabled={isBusy} tone="secondary" />
        </Panel>
      </div>
    </div>
  )
}

function RecallView({
  activeRanks,
  isBusy,
  onQuestionChange,
  onRecall,
  question,
  recall
}: {
  activeRanks: ResolutionRank[]
  isBusy: boolean
  onQuestionChange: (value: string) => void
  onRecall: () => void
  question: string
  recall: RecallResponse | null
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-4">
        <Panel title="Ask memory" icon={<Brain size={17} />}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">Question</span>
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              className="min-h-32 w-full resize-y rounded-[6px] border border-border bg-bg p-3 font-mono text-sm leading-6 text-text outline-none focus:border-accent"
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Lineage graph" icon={<GitBranch size={17} />}>
        <LineageGraph graph={graph} />
        <PathSummary graph={graph} contrast={recall?.vector_only_contrast} />
        <ActionButton className="mt-4" title="Trace downstream symptom" icon={<GitBranch size={15} />} onClick={onDownstream} disabled={isBusy} />
      </Panel>

      <div className="grid content-start gap-4">
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

function ImproveView({
  accepted,
  improve,
  isBusy,
  onImprove,
  ranks
}: {
  accepted?: ResolutionRank
  improve: ImproveResponse | null
  isBusy: boolean
  onImprove: () => void
  ranks: ResolutionRank[]
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Feedback control" icon={<ThumbsUp size={17} />}>
        <MetricGrid>
          <Metric label="Incident" value={INCIDENT.id} mono />
          <Metric label="Accepted fix" value="res-window-3-day" mono />
          <Metric label="Current rank" value={accepted ? `#${accepted.rank}` : 'pending'} tone={accepted?.rank === 1 ? 'success' : 'warning'} mono />
          <Metric label="Current score" value={accepted ? accepted.score.toFixed(2) : 'pending'} mono />
        </MetricGrid>
        <div className="mt-4 rounded-[6px] border border-border bg-bg p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Feedback payload</p>
          <p className="mt-2 font-mono text-sm leading-6 text-text">Confirmed the 3 day processing_date window resolved the incident.</p>
        </div>
        <ActionButton className="mt-4" title="Confirm fix and improve ranking" icon={<ThumbsUp size={15} />} onClick={onImprove} disabled={isBusy} />
      </Panel>

      <div className="grid content-start gap-4">
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Forget control" icon={<Trash2 size={17} />} action={<StatusPill tone={deprecatedVisible ? 'danger' : 'success'}>{deprecatedVisible ? 'visible' : 'clean'}</StatusPill>}>
        <MetricGrid>
          <Metric label="Target dataset" value="airmemory_deprecated_full_dag_clear" mono />
          <Metric label="Resolution" value="res-full-dag-clear" mono />
          <Metric label="Deprecated visible" value={deprecatedVisible ? 'yes' : 'no'} tone={deprecatedVisible ? 'danger' : 'success'} mono />
          <Metric label="Leakage check" value={forget ? `${forget.leakage_check}` : 'pending'} tone={forget?.leakage_check === 0 ? 'success' : 'muted'} mono />
        </MetricGrid>
        <div className="mt-4 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-warning">
          This removes the deprecated workaround from retrieval. It does not run or clear any Airflow task.
        </div>
        <ActionButton className="mt-4" title="Remove deprecated workaround" icon={<Trash2 size={15} />} onClick={onForget} disabled={isBusy} tone="danger" />
      </Panel>

      <div className="grid content-start gap-4">
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
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
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

function SettingsView({
  health,
  seed,
  sourceCounts
}: {
  health: Record<string, string | boolean> | null
  seed: SeedResponse | null
  sourceCounts: Array<[string, number]>
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Runtime" icon={<Settings size={17} />}>
        <MetricGrid>
          <Metric label="Service" value={String(health?.service ?? 'AirMemory')} mono />
          <Metric label="Backend" value={String(health?.backend ?? 'cognee')} mono />
          <Metric label="Storage" value={String(health?.storage ?? 'embedded')} mono />
          <Metric label="Cognee mode" value={health?.cognee_enabled ? 'Live Cognee' : 'Adapter mode'} tone={health?.cognee_enabled ? 'success' : 'warning'} mono />
          <Metric label="Dataset" value={seed?.dataset ?? 'airmemory'} mono />
        </MetricGrid>
      </Panel>

      <Panel title="Source inventory" icon={<Database size={17} />}>
        {sourceCounts.length ? (
          <div className="grid gap-2">
            {sourceCounts.map(([source, count]) => (
              <div key={source} className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                <span className="font-mono text-text">{source}</span>
                <span className="font-mono text-accent">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Seed data has not loaded yet.</p>
        )}
      </Panel>
    </div>
  )
}

function Panel({ action, children, icon, title }: { action?: ReactNode; children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-[6px] border border-border bg-panel p-4 shadow-lg shadow-black/10">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-accent">{icon}</span>
          <h3 className="truncate text-sm font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
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
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className={`${mono ? 'font-mono' : ''} min-w-0 text-sm leading-6 ${toneTextClass(tone)}`}>
        <span className="block overflow-x-auto whitespace-nowrap pb-1">{value}</span>
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
  return <span className={`rounded-[6px] border px-2 py-1 font-mono text-[11px] ${pillToneClass(tone)}`}>{children}</span>
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
            <p className="truncate font-mono text-xs text-accent" title={citation.label}>
              {citation.label}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">{citation.source}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-6 text-text">{citation.excerpt}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {citation.facets.slice(0, 4).map((facet) => (
                <span key={facet} className="rounded-[6px] border border-border bg-surface px-2 py-1 font-mono text-[11px] text-muted">
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

function ResolutionHighlight({ accepted, topResolution }: { accepted?: ResolutionRank; topResolution?: ResolutionRank }) {
  const rank = accepted ?? topResolution

  if (!rank) {
    return <p className="text-sm text-muted">Run recall to populate resolution ranking.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone={rank.status === 'deprecated' ? 'danger' : 'success'}>#{rank.rank}</StatusPill>
        <span className="font-mono text-sm text-accent">{rank.score.toFixed(2)}</span>
      </div>
      <p className="mt-4 text-lg font-semibold leading-7 text-text">{rank.title}</p>
      <p className="mt-2 text-sm text-muted">Status: {rank.status}</p>
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
          <span className={rank.rank === 1 ? 'font-mono text-sm text-accent' : 'font-mono text-sm text-muted'}>#{rank.rank}</span>
          <div className="min-w-0">
            <p className={`${compact ? 'text-sm' : 'text-base'} leading-6 text-text`}>{rank.title}</p>
            <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-muted">{rank.id}</p>
          </div>
          <span className={`w-fit rounded-[6px] border px-2 py-1 font-mono text-[11px] ${rank.status === 'deprecated' ? 'border-danger/50 text-danger' : 'border-success/50 text-success'}`}>
            {rank.status}
          </span>
        </div>
      ))}
    </div>
  )
}

function RunbookPreview({ runbook }: { runbook: RunbookState | null }) {
  return (
    <pre className="max-h-[360px] overflow-auto rounded-[6px] border border-border bg-bg p-3 font-mono text-xs leading-6 text-text">
      {runbook?.markdown ?? 'Runbook pending.'}
    </pre>
  )
}

function PathSummary({ contrast, graph }: { contrast?: string | null; graph: GraphPath | null }) {
  return (
    <div className="mt-4 grid gap-2">
      <p className="text-sm leading-6 text-muted">{graph?.explanation ?? 'Lineage graph pending.'}</p>
      {contrast ? <p className="rounded-[6px] border border-accent/40 bg-accent/10 p-3 text-sm leading-6 text-accent">{contrast}</p> : null}
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
          <p className={edge.active ? 'font-mono text-xs text-accent' : 'font-mono text-xs text-muted'}>{edge.label}</p>
          <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-text">
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
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className="font-mono text-xs text-text">{pct(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <div className={accent ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-accent'} style={{ width: `${Math.max(value * 100, value > 0 ? 6 : 0)}%` }} />
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
        <thead className="text-xs uppercase tracking-[0.1em] text-muted">
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
              <td className="py-3 pr-4 font-mono text-xs text-accent">{String(row.pass ?? '')}</td>
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

function toneDotClass(tone: string) {
  if (tone === 'success') return 'h-2 w-2 rounded-full bg-success'
  if (tone === 'warning') return 'h-2 w-2 rounded-full bg-warning'
  if (tone === 'danger') return 'h-2 w-2 rounded-full bg-danger'
  if (tone === 'info') return 'h-2 w-2 rounded-full bg-accent'
  return 'h-2 w-2 rounded-full bg-muted'
}

function buttonToneClass(tone: 'primary' | 'secondary' | 'danger') {
  if (tone === 'danger') return 'border-danger/50 bg-danger/10 text-danger hover:bg-danger/15'
  if (tone === 'secondary') return 'border-border bg-surface text-text hover:border-accent/60 hover:text-accent'
  return 'border-accent/50 bg-accent/15 text-accent hover:bg-accent/20'
}

function pillToneClass(tone: 'success' | 'warning' | 'danger') {
  if (tone === 'success') return 'border-success/50 bg-success/10 text-success'
  if (tone === 'danger') return 'border-danger/50 bg-danger/10 text-danger'
  return 'border-warning/50 bg-warning/10 text-warning'
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatDelta(value: number) {
  const rounded = Math.round(value * 100)
  return `${rounded >= 0 ? '+' : ''}${rounded} pts`
}
