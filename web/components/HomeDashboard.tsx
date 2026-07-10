'use client'

import { ArrowRight, Play } from 'lucide-react'
import { ConfidenceRing, SparkBars } from '@/components/MiniCharts'
import type { RecallResponse, RuntimeIncidentResult, RuntimeSummary, SeedResponse } from '@/lib/api'

type ActiveIncident = {
  id: string
  dag: string
  task: string
  error: string
  category: string
  source: 'runtime' | 'seed'
}

export function HomeDashboard({
  activeIncident,
  isBusy,
  recall,
  runtimeDetail,
  seed,
  summary,
  onEmitAndProcess,
  onOpenDocs,
  onOpenOverview,
  onOpenRecall
}: {
  activeIncident: ActiveIncident
  isBusy: boolean
  recall: RecallResponse | null
  runtimeDetail: RuntimeIncidentResult | null
  seed: SeedResponse | null
  summary: RuntimeSummary | null
  onEmitAndProcess: () => void
  onOpenDocs: (docId?: string) => void
  onOpenLineage: () => void
  onOpenOverview: () => void
  onOpenRecall: () => void
}) {
  const sourcePoints = Object.entries(seed?.counts_by_source ?? {})
    .slice(0, 5)
    .map(([label, value], index) => ({
      label: label.slice(0, 3),
      value,
      tone: (['accent', 'success', 'muted', 'warning', 'accent'] as const)[index]
    }))

  const advice =
    runtimeDetail?.advice.recommended_fix ??
    recall?.resolutions[0]?.title ??
    'Emit a failure to get a recommended fix.'

  const confidence = runtimeDetail?.advice.confidence ?? 0.62
  const topMatch = runtimeDetail?.similar_incidents[0]

  return (
    <div className="mx-auto grid w-full max-w-3xl min-w-0 gap-10">
      <header className="fade-in flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">AirMemory</p>
          <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-text sm:text-3xl">Dashboard</h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={onEmitAndProcess}
            className="control-button border-transparent bg-accent text-white hover:bg-accent-strong"
          >
            <Play size={14} />
            Emit failure
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onOpenOverview}
            className="control-button border-border bg-transparent text-text hover:bg-surface"
          >
            Open incident
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <section className="fade-in fade-in-delay-1 grid min-w-0 gap-6 sm:grid-cols-3">
        <InlineStat label="Incident" value={activeIncident.id} />
        <InlineStat label="Queue" value={summary ? `${summary.incident_count} · ${summary.queue_mode}` : '—'} />
        <InlineStat label="Memory" value={seed ? `${seed.remembered} artifacts` : '—'} />
      </section>

      <section className="premium-card fade-in fade-in-delay-2 min-w-0 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={
              activeIncident.source === 'runtime'
                ? 'inline-flex items-center gap-1.5 text-[11px] font-medium text-success'
                : 'inline-flex items-center gap-1.5 text-[11px] font-medium text-warning'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${activeIncident.source === 'runtime' ? 'bg-success' : 'bg-warning'}`}
            />
            {activeIncident.source === 'runtime' ? 'Live' : 'Seed'}
          </span>
          <p className="font-mono text-[12px] text-muted">{activeIncident.error}</p>
        </div>

        <h3 className="mt-5 break-words text-xl font-semibold tracking-[-0.025em] text-text sm:text-2xl">
          {activeIncident.dag}
          <span className="text-muted"> / </span>
          {activeIncident.task}
        </h3>

        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">{advice}</p>

        {topMatch ? (
          <p className="mt-3 break-all font-mono text-[11px] text-muted">
            Closest match · {topMatch.incident_id} · {topMatch.similarity_score.toFixed(2)}
          </p>
        ) : null}

        <div className="mt-8 grid min-w-0 gap-8 border-t border-border pt-8 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
          <ConfidenceRing value={confidence} />
          <div className="min-w-0">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Sources in memory</p>
            {sourcePoints.length ? (
              <SparkBars points={sourcePoints} />
            ) : (
              <p className="text-sm text-muted">No seed data yet.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={isBusy}
          onClick={onOpenRecall}
          className="mt-8 text-[13px] font-medium text-accent-strong transition-colors hover:text-accent"
        >
          Ask memory →
        </button>
      </section>

      <section className="fade-in fade-in-delay-3 grid min-w-0 gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onOpenDocs('incidents/inc_1029.md')}
          className="text-left"
        >
          <DocLink label="Incident write-up" value="INC-1029 summary · root cause · fix" />
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onOpenDocs('runbooks/row_count_mismatch.md')}
          className="text-left"
        >
          <DocLink label="Runbook" value="row_count_mismatch steps" />
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onOpenDocs('patterns/row_count_mismatch.md')}
          className="text-left"
        >
          <DocLink label="Pattern" value="What to avoid next time" />
        </button>
      </section>
    </div>
  )
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border pb-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 truncate font-mono text-[13px] text-text" title={value}>
        {value}
      </p>
    </div>
  )
}

function DocLink({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-control border border-border/80 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1.5 text-[13px] leading-5 text-text">{value}</p>
    </div>
  )
}
