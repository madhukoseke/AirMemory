'use client'

import { ArrowRight, FileUp, Play, Search } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { ConfidenceRing } from '@/components/MiniCharts'
import type { RuntimeIncidentResult, RuntimeSummary, SeedResponse } from '@/lib/api'

type ActiveIncident = {
  id: string
  dag: string
  task: string
  error: string
  category: string
  source: 'runtime' | 'seed'
}

const SAMPLE_LOG = `2026-06-30T03:14:08Z ERROR dag_id=customer_daily_migration_dag task_id=validate_row_counts
2026-06-30T03:14:08Z ERROR error_type=ROW_COUNT_MISMATCH source_table=hana.customer_master target_table=bq.prod.customer_master
2026-06-30T03:14:08Z ERROR source_count=1588 target_count=1297 diff=291 processing_date=2026-06-30
2026-06-30T03:15:11Z INFO downstream task publish_metrics remains blocked because dq_reconciliation_check did not run`

export function HomeDashboard({
  activeIncident,
  isBusy,
  logText,
  runtimeDetail,
  seed,
  summary,
  onEmitAndProcess,
  onLogTextChange,
  onAnalyze,
  onOpenDocs,
  onOpenOverview,
  onOpenRecall
}: {
  activeIncident: ActiveIncident
  isBusy: boolean
  logText: string
  runtimeDetail: RuntimeIncidentResult | null
  seed: SeedResponse | null
  summary: RuntimeSummary | null
  onEmitAndProcess: () => void
  onLogTextChange: (value: string) => void
  onAnalyze: () => void
  onOpenDocs: (docId?: string) => void
  onOpenLineage: () => void
  onOpenOverview: () => void
  onOpenRecall: () => void
}) {
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const advice =
    runtimeDetail?.advice.recommended_fix ??
    'Paste or upload an Airflow task log to get a recommended fix.'
  const confidence = runtimeDetail?.advice.confidence ?? null
  const topMatch = runtimeDetail?.similar_incidents[0]
  const canAnalyze = logText.trim().length > 0 && !isBusy

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setFileName(file.name)
    onLogTextChange(text)
    event.target.value = ''
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl min-w-0 gap-10">
      <header className="fade-in flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">AirMemory</p>
          <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-text sm:text-3xl">Analyze</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted">
            Paste a failed Airflow task log or upload a <span className="font-mono text-[12px]">.log</span> file.
            We normalize the failure, recall similar incidents, and recommend a fix.
          </p>
        </div>
      </header>

      <section className="premium-card fade-in fade-in-delay-1 min-w-0 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Airflow log</p>
            <p className="mt-1 text-[13px] text-muted">
              {fileName ? (
                <>
                  Loaded <span className="font-mono text-text">{fileName}</span>
                </>
              ) : (
                'Paste from the Airflow UI, or upload the task log file'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setFileName(null)
                onLogTextChange(SAMPLE_LOG)
              }}
              className="control-button border-border bg-transparent text-text hover:bg-surface"
            >
              Use sample
            </button>
            <label
              htmlFor={fileInputId}
              className={`control-button border-border bg-transparent text-text hover:bg-surface ${
                isBusy ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }`}
            >
              <FileUp size={14} />
              Upload
            </label>
            <input
              id={fileInputId}
              ref={fileRef}
              type="file"
              accept=".log,.txt,text/plain"
              className="sr-only"
              disabled={isBusy}
              onChange={(event) => void handleFile(event)}
            />
          </div>
        </div>

        <textarea
          value={logText}
          disabled={isBusy}
          onChange={(event) => {
            setFileName(null)
            onLogTextChange(event.target.value)
          }}
          rows={10}
          spellCheck={false}
          placeholder={`Paste Airflow task log here…

Example:
2026-06-30T03:14:08Z ERROR dag_id=… task_id=…
2026-06-30T03:14:08Z ERROR error_type=ROW_COUNT_MISMATCH …`}
          className="mt-4 w-full resize-y rounded-control border border-border bg-bg/60 px-3 py-3 font-mono text-[12px] leading-5 text-text placeholder:text-muted/70 focus:border-accent"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canAnalyze}
            onClick={onAnalyze}
            className="control-button border-transparent bg-accent text-white hover:bg-accent-strong disabled:opacity-50"
          >
            <Search size={14} />
            Analyze log
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onEmitAndProcess}
            className="control-button border-border bg-transparent text-text hover:bg-surface"
          >
            <Play size={14} />
            Try demo failure
          </button>
          {runtimeDetail ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={onOpenOverview}
              className="control-button border-border bg-transparent text-text hover:bg-surface"
            >
              Open diagnosis
              <ArrowRight size={14} />
            </button>
          ) : null}
        </div>
      </section>

      {runtimeDetail ? (
        <section className="premium-card fade-in fade-in-delay-2 min-w-0 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {activeIncident.source === 'runtime' ? 'Analyzed' : 'Seed'}
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
            {confidence != null ? <ConfidenceRing value={confidence} /> : null}
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Next</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onOpenOverview}
                  className="text-[13px] font-medium text-accent-strong transition-colors hover:text-accent"
                >
                  Full diagnosis →
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onOpenRecall}
                  className="text-[13px] font-medium text-muted transition-colors hover:text-text"
                >
                  Ask memory →
                </button>
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted">
                {summary ? `Queue ${summary.incident_count} · ${summary.queue_mode}` : '—'}
                {seed ? ` · ${seed.remembered} artifacts in memory` : ''}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="fade-in fade-in-delay-2 grid min-w-0 gap-3 sm:grid-cols-3">
          <InlineStat label="Incident" value={activeIncident.id} />
          <InlineStat label="Queue" value={summary ? `${summary.incident_count} · ${summary.queue_mode}` : '—'} />
          <InlineStat label="Memory" value={seed ? `${seed.remembered} artifacts` : '—'} />
        </section>
      )}

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
