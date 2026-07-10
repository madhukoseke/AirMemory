type BarPoint = {
  label: string
  value: number
  tone?: 'accent' | 'success' | 'warning' | 'muted'
}

const TONE_FILL: Record<NonNullable<BarPoint['tone']>, string> = {
  accent: 'var(--chart-1)',
  success: 'var(--chart-2)',
  warning: 'var(--chart-3)',
  muted: 'var(--chart-4)'
}

export function SparkBars({ points, max }: { points: BarPoint[]; max?: number }) {
  const peak = max ?? Math.max(...points.map((point) => point.value), 1)

  return (
    <div className="grid h-24 grid-cols-5 items-end gap-2.5">
      {points.map((point) => {
        const height = Math.max((point.value / peak) * 100, point.value > 0 ? 10 : 2)
        return (
          <div key={point.label} className="flex h-full min-w-0 flex-col justify-end gap-2">
            <div className="relative flex flex-1 items-end">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${height}%`,
                  background: TONE_FILL[point.tone ?? 'accent'],
                  opacity: point.tone === 'muted' ? 0.55 : 0.9
                }}
                title={`${point.label}: ${point.value}`}
              />
            </div>
            <span className="truncate text-center font-mono text-[10px] text-muted">{point.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RankGauge({
  before,
  after,
  label = 'Accepted fix rank'
}: {
  before: number
  after: number
  label?: string
}) {
  const beforePct = Math.max(0, Math.min(100, (4 - before) * 25))
  const afterPct = Math.max(0, Math.min(100, (4 - after) * 25))

  return (
    <div className="grid gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
          <span>{label} · before</span>
          <span className="font-mono text-text">#{before}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-chart-4" style={{ width: `${beforePct}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
          <span>{label} · after improve</span>
          <span className="font-mono text-accent-strong">#{after}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${afterPct}%` }} />
        </div>
      </div>
    </div>
  )
}

export function ConfidenceRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value))
  const degrees = Math.round(clamped * 360)

  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--accent) ${degrees}deg, var(--surface-2) ${degrees}deg)`
        }}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-panel font-mono text-[13px] text-text">
          {Math.round(clamped * 100)}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Confidence</p>
        <p className="mt-1 text-sm tracking-tight text-text">{Math.round(clamped * 100)}%</p>
      </div>
    </div>
  )
}
