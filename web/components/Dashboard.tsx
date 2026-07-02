'use client'

import dynamic from 'next/dynamic'
import {
  Activity,
  Brain,
  GitBranch,
  Play,
  RefreshCw,
  ShieldCheck,
  ThumbsUp,
  Trash2
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  forgetDeprecated,
  generateRunbook,
  getGraph,
  getHealth,
  improveMemory,
  recallMemory,
  runEval,
  seedAirMemory,
  type EvalResponse,
  type ForgetResponse,
  type GraphPath,
  type ImproveResponse,
  type RecallResponse,
  type SeedResponse
} from '@/lib/api'

const LineageGraph = dynamic(
  () => import('@/components/LineageGraph').then((mod) => mod.LineageGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center border border-dashed border-border text-xs text-muted">
        graph loading
      </div>
    )
  }
)

const DEFAULT_QUESTION = 'Have we seen validate_row_counts fail on customer_master before? Root cause and safe fix?'
const DOWNSTREAM_QUESTION =
  'Looker customer_metrics is stale after publish_metrics. Have we seen the upstream cause?'

type RunbookState = {
  markdown: string
  citations: RecallResponse['citations']
}

export function Dashboard() {
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
  const [isPending, startTransition] = useTransition()

  const activeRanks = recall?.resolutions ?? []
  const accepted = activeRanks.find((rank) => rank.id === 'res-window-3-day')
  const deprecatedVisible = activeRanks.some((rank) => rank.id === 'res-full-dag-clear')

  const seedCount = useMemo(() => {
    if (!seed) {
      return '0'
    }
    return Object.entries(seed.counts_by_source)
      .map(([source, count]) => `${source}:${count}`)
      .join(' ')
  }, [seed])

  const refreshAll = useCallback((nextQuestion: string) => {
    startTransition(() => {
      void (async () => {
      try {
        setError(null)
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Backend request failed')
      }
      })()
    })
  }, [])

  useEffect(() => {
    refreshAll(DEFAULT_QUESTION)
  }, [refreshAll])

  function askCurrent() {
    refreshAll(question)
  }

  function askDownstream() {
    setQuestion(DOWNSTREAM_QUESTION)
    refreshAll(DOWNSTREAM_QUESTION)
  }

  function submitImprove() {
    startTransition(() => {
      void (async () => {
      try {
        setError(null)
        const improved = await improveMemory('Confirmed the 3 day processing_date window resolved the incident.')
        const recalled = await recallMemory(question)
        setImprove(improved)
        setRecall(recalled)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Improve failed')
      }
      })()
    })
  }

  function submitForget() {
    startTransition(() => {
      void (async () => {
      try {
        setError(null)
        const forgotten = await forgetDeprecated()
        const recalled = await recallMemory(question)
        setForget(forgotten)
        setRecall(recalled)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Forget failed')
      }
      })()
    })
  }

  function submitEval() {
    startTransition(() => {
      void (async () => {
      try {
        setError(null)
        const result = await runEval()
        setEvalResult(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Eval failed')
      }
      })()
    })
  }

  return (
    <main className="min-h-screen px-4 py-4 text-text md:px-6 md:py-6">
      <header className="mb-4 grid gap-3 border-b border-dashed border-border pb-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="mb-2 text-xs uppercase text-accent">Airflow has logs. AirMemory gives it memory.</p>
          <h1 className="text-2xl font-semibold tracking-normal md:text-4xl">AirMemory</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <Status label="api" value={health?.status ?? 'pending'} />
          <Status label="storage" value={String(health?.storage ?? 'embedded')} />
          <Status label="cognee" value={health?.cognee_enabled ? 'live' : 'adapter'} />
          <Status label="seed" value={seed ? `${seed.remembered}` : '0'} />
        </div>
      </header>

      {error ? (
        <div className="mb-4 border border-dashed border-red-400/70 bg-red-950/20 p-3 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.88fr_1.25fr_0.9fr]">
        <div className="grid gap-4">
          <Panel title="Current Failure" icon={<Activity size={16} />}>
            <dl className="grid gap-2 text-xs">
              <Metric label="dag" value="customer_daily_migration_dag" />
              <Metric label="task" value="validate_row_counts" />
              <Metric label="error" value="ROW_COUNT_MISMATCH" accent />
              <Metric label="counts" value="HANA 1588 / BQ 1297 / diff 291" />
              <Metric label="blocked" value="publish_metrics" />
            </dl>
          </Panel>

          <Panel title="Ask AirMemory" icon={<Brain size={16} />}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-28 w-full resize-none border border-dashed border-border bg-bg p-3 text-xs text-text outline-none"
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <IconButton title="Recall" onClick={askCurrent} disabled={isPending} icon={<Play size={14} />} />
              <IconButton title="Lineage" onClick={askDownstream} disabled={isPending} icon={<GitBranch size={14} />} />
              <IconButton title="Refresh" onClick={() => refreshAll(question)} disabled={isPending} icon={<RefreshCw size={14} />} />
            </div>
          </Panel>

          <Panel title="Improve" icon={<ThumbsUp size={16} />}>
            <div className="grid gap-2 text-xs">
              <Metric label="accepted rank" value={accepted ? `#${accepted.rank} score ${accepted.score.toFixed(2)}` : 'pending'} accent={accepted?.rank === 1} />
              <Metric label="delta" value={improve ? `#${improve.rank_before} -> #${improve.rank_after}` : 'not applied'} />
              <IconTextButton title="Confirm Fix" onClick={submitImprove} disabled={isPending} icon={<ThumbsUp size={14} />} />
            </div>
          </Panel>

          <Panel title="Forget" icon={<Trash2 size={16} />}>
            <div className="grid gap-2 text-xs">
              <Metric label="deprecated visible" value={deprecatedVisible ? 'yes' : 'no'} accent={!deprecatedVisible} />
              <Metric label="leakage" value={forget ? `${forget.leakage_check}` : 'pending'} accent={forget?.leakage_check === 0} />
              <IconTextButton title="Remove Deprecated" onClick={submitForget} disabled={isPending} icon={<Trash2 size={14} />} />
            </div>
          </Panel>
        </div>

        <div className="grid gap-4">
          <Panel title="Recalled Memory" icon={<ShieldCheck size={16} />}>
            <p className="min-h-28 whitespace-pre-wrap text-sm leading-6 text-text">
              {recall?.answer ?? 'waiting for recall'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {recall?.citations.map((citation) => (
                <span
                  key={citation.id}
                  title={citation.excerpt}
                  className="max-w-full border border-dashed border-border px-2 py-1 text-[11px] text-muted"
                >
                  {citation.label}
                </span>
              ))}
            </div>
          </Panel>

          <Panel title="Lineage Graph" icon={<GitBranch size={16} />}>
            <LineageGraph graph={graph} />
            <p className="mt-3 text-xs leading-5 text-muted">{graph?.explanation ?? recall?.graph_path?.explanation}</p>
            {recall?.vector_only_contrast ? (
              <p className="mt-2 border border-dashed border-border p-2 text-xs leading-5 text-accent">
                {recall.vector_only_contrast}
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="grid gap-4">
          <Panel title="Generated Runbook" icon={<Play size={16} />}>
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-text">
              {runbook?.markdown ?? 'runbook pending'}
            </pre>
          </Panel>

          <Panel title="Resolution Rank" icon={<ShieldCheck size={16} />}>
            <div className="grid gap-2">
              {activeRanks.map((rank) => (
                <div
                  key={rank.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-2 border border-dashed border-border p-2 text-xs"
                >
                  <span className={rank.rank === 1 ? 'text-accent' : 'text-muted'}>#{rank.rank}</span>
                  <span className="overflow-wrap-anywhere text-text">{rank.title}</span>
                  <span className={rank.status === 'deprecated' ? 'text-red-300' : 'text-accent'}>{rank.status}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Eval" icon={<Activity size={16} />}>
            <div className="grid gap-3 text-xs">
              <Metric label="cold @1" value={evalResult ? pct(evalResult.before.recall_at_1) : 'pending'} />
              <Metric label="warm @1" value={evalResult ? pct(evalResult.after.recall_at_1) : 'pending'} accent={Boolean(evalResult)} />
              <Metric label="leakage" value={evalResult ? `${evalResult.forget_leakage}` : 'pending'} accent={evalResult?.forget_leakage === 0} />
              <div className="h-20 border border-dashed border-border p-2">
                <EvalBars evalResult={evalResult} />
              </div>
              <IconTextButton title="Run Eval" onClick={submitEval} disabled={isPending} icon={<Activity size={14} />} />
            </div>
          </Panel>

          <div className="border border-dashed border-border bg-surface p-3 text-[11px] leading-5 text-muted">
            {seedCount}
          </div>
        </div>
      </section>
    </main>
  )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-dashed border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-dashed border-border pb-2 text-xs uppercase text-muted">
        <span className="text-accent">{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Status({ label, value }: { label: string; value: string | boolean }) {
  return (
    <div className="border border-dashed border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-accent">{String(value)}</div>
    </div>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 border-b border-dashed border-border pb-1">
      <dt className="text-muted">{label}</dt>
      <dd className={accent ? 'overflow-wrap-anywhere text-accent' : 'overflow-wrap-anywhere text-text'}>{value}</dd>
    </div>
  )
}

function IconButton({
  title,
  onClick,
  disabled,
  icon
}: {
  title: string
  onClick: () => void
  disabled: boolean
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 items-center justify-center border border-dashed border-border bg-surface2 text-accent disabled:opacity-40"
    >
      {icon}
    </button>
  )
}

function IconTextButton({
  title,
  onClick,
  disabled,
  icon
}: {
  title: string
  onClick: () => void
  disabled: boolean
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-10 items-center justify-center gap-2 border border-dashed border-border bg-surface2 px-3 text-xs text-accent disabled:opacity-40"
    >
      {icon}
      <span>{title}</span>
    </button>
  )
}

function EvalBars({ evalResult }: { evalResult: EvalResponse | null }) {
  const before = evalResult?.before.recall_at_1 ?? 0
  const after = evalResult?.after.recall_at_1 ?? 0
  return (
    <div className="flex h-full items-end gap-3">
      <Bar label="cold" value={before} />
      <Bar label="warm" value={after} />
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-full flex-1 flex-col justify-end gap-1">
      <div className="border border-dashed border-accent bg-accent/20" style={{ height: `${Math.max(value * 100, 5)}%` }} />
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}
