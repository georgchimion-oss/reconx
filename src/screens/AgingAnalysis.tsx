import { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { useReconStore } from '../store/reconStore'
import type { Exception, ReasonCode } from '../data/types'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

// ─── Constants ────────────────────────────────────────────────

const C = {
  bg: '#0f1117',
  card: 'rgba(20,22,32,0.85)',
  border: '1px solid rgba(255,255,255,0.07)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
  blue: '#06B6D4',
  purple: '#a78bfa',
  orange: '#fb923c',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.065)',
}

const AGE_BUCKETS = [
  { key: '0-1d',  label: '0-1d',  min: 0,  max: 1,        color: '#34d399', colorDim: 'rgba(52,211,153,0.65)' },
  { key: '2-5d',  label: '2-5d',  min: 2,  max: 5,        color: '#84cc16', colorDim: 'rgba(132,204,22,0.65)'  },
  { key: '6-15d', label: '6-15d', min: 6,  max: 15,       color: '#fbbf24', colorDim: 'rgba(251,191,36,0.65)'  },
  { key: '16-30d',label: '16-30d',min: 16, max: 30,       color: '#f97316', colorDim: 'rgba(249,115,22,0.65)'  },
  { key: '30d+',  label: '30d+',  min: 31, max: Infinity,  color: '#f87171', colorDim: 'rgba(248,113,113,0.65)' },
]

const REASON_LABELS: Record<ReasonCode, string> = {
  TIMING:             'Timing',
  MISSING_TRADE:      'Missing Trade',
  RATE_DIFFERENCE:    'Rate Diff',
  COUNTERPARTY_ERROR: 'Counterparty Err',
  FEE_DIFFERENCE:     'Fee Diff',
  DUPLICATE:          'Duplicate',
  UNKNOWN:            'Unknown',
}

// ─── Helpers ──────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function getBucket(age: number): string {
  for (const b of AGE_BUCKETS) {
    if (age >= b.min && age <= b.max) return b.key
  }
  return '30d+'
}

// Intensity scale: more items = darker background
function intensityBg(count: number, max: number): string {
  if (max === 0 || count === 0) return 'transparent'
  const t = Math.min(count / max, 1)
  // interpolate from near-transparent amber to strong red
  const r = Math.round(251 + (248 - 251) * t)
  const g = Math.round(191 + (113 - 191) * t)
  const b_ = Math.round(36 + (113 - 36) * t)
  return `rgba(${r},${g},${b_},${0.08 + t * 0.3})`
}

function intensityText(count: number, max: number): string {
  if (max === 0 || count === 0) return C.textMuted
  const t = Math.min(count / max, 1)
  if (t > 0.6) return C.red
  if (t > 0.3) return C.amber
  return C.textSecondary
}

// ─── Card wrapper ─────────────────────────────────────────────

interface CardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

function Card({ title, subtitle, children, style }: CardProps) {
  return (
    <div
      style={{
        background: C.card,
        border: C.border,
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: C.textMuted,
          }}
        >
          {title}
        </span>
        {subtitle && (
          <span style={{ fontSize: 10, color: C.textMuted }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Aging Matrix ─────────────────────────────────────────────

interface MatrixRow {
  label: string
  buckets: Record<string, { count: number; value: number }>
}

function AgingMatrix({ rows, title }: { rows: MatrixRow[]; title: string }) {
  const maxCount = useMemo(() => {
    let m = 0
    for (const row of rows) {
      for (const b of AGE_BUCKETS) {
        const c = row.buckets[b.key]?.count ?? 0
        if (c > m) m = c
      }
    }
    return m
  }, [rows])

  if (rows.length === 0) {
    return (
      <div style={{ padding: '20px 16px', textAlign: 'center', color: C.textMuted, fontSize: 11 }}>
        No data available.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: '7px 12px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: C.textMuted,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                whiteSpace: 'nowrap',
                minWidth: 140,
              }}
            >
              {title}
            </th>
            {AGE_BUCKETS.map(b => (
              <th
                key={b.key}
                style={{
                  padding: '7px 10px',
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  color: b.color,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  whiteSpace: 'nowrap',
                  minWidth: 80,
                }}
              >
                {b.label}
              </th>
            ))}
            <th
              style={{
                padding: '7px 10px',
                textAlign: 'right',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: C.textMuted,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                whiteSpace: 'nowrap',
              }}
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const rowTotal = AGE_BUCKETS.reduce((s, b) => s + (row.buckets[b.key]?.count ?? 0), 0)
            const rowValue = AGE_BUCKETS.reduce((s, b) => s + (row.buckets[b.key]?.value ?? 0), 0)
            return (
              <tr
                key={ri}
                style={{ background: ri % 2 === 0 ? 'transparent' : C.surface }}
              >
                <td
                  style={{
                    padding: '7px 12px',
                    color: C.textPrimary,
                    fontWeight: 500,
                    fontSize: 11,
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.label}
                </td>
                {AGE_BUCKETS.map(b => {
                  const cell = row.buckets[b.key]
                  const cnt = cell?.count ?? 0
                  const val = cell?.value ?? 0
                  return (
                    <td
                      key={b.key}
                      style={{
                        padding: '6px 10px',
                        textAlign: 'center',
                        background: intensityBg(cnt, maxCount),
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      {cnt > 0 ? (
                        <>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: intensityText(cnt, maxCount),
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {cnt}
                          </div>
                          <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {compact.format(val)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10 }}>—</span>
                      )}
                    </td>
                  )
                })}
                <td
                  style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary }}>{rowTotal}</div>
                  <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>{compact.format(rowValue)}</div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Analyst Bar Chart ────────────────────────────────────────

function AnalystAgingChart({ exceptions }: { exceptions: Exception[] }) {
  const { analysts, datasets } = useMemo(() => {
    const analystSet = new Set<string>()
    for (const exc of exceptions) analystSet.add(exc.assignedTo)
    const analysts = [...analystSet].sort()

    const datasets = AGE_BUCKETS.map(b => ({
      label: b.label,
      data: analysts.map(analyst => {
        return exceptions.filter(
          exc => exc.assignedTo === analyst && getBucket(exc.item.age) === b.key
        ).length
      }),
      backgroundColor: b.colorDim,
      borderColor: b.color,
      borderWidth: 1,
      borderRadius: 2,
    }))

    return { analysts, datasets }
  }, [exceptions])

  const chartData = { labels: analysts, datasets }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: C.textMuted,
          font: { size: 10 },
          boxWidth: 10,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15,17,23,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: C.textPrimary,
        bodyColor: C.textSecondary,
        padding: 10,
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: C.textMuted, font: { size: 10 } },
        border: { color: 'rgba(255,255,255,0.07)' },
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: C.textMuted, font: { size: 10 }, precision: 0 },
        border: { color: 'rgba(255,255,255,0.07)' },
        beginAtZero: true,
      },
    },
  }

  return (
    <div style={{ height: 220, padding: '12px 16px' }}>
      <Bar data={chartData} options={chartOptions} />
    </div>
  )
}

// ─── Aging Trend Line ─────────────────────────────────────────

function AgingTrendChart() {
  const kpis = useReconStore(s => s.kpis)
  const trend = kpis?.matchRateTrend ?? []

  const chartData = {
    labels: trend.map(p => {
      const d = new Date(p.date)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'Match Rate %',
        data: trend.map(p => p.matchRate),
        borderColor: C.blue,
        backgroundColor: 'rgba(6,182,212,0.08)',
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: C.blue,
        tension: 0.35,
        fill: true,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,17,23,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: C.textPrimary,
        bodyColor: C.textSecondary,
        padding: 10,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => `Match Rate: ${(ctx.parsed.y ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.03)' },
        ticks: { color: C.textMuted, font: { size: 10 }, maxTicksLimit: 10 },
        border: { color: 'rgba(255,255,255,0.07)' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: C.textMuted, font: { size: 10 }, callback: (v: number | string) => `${v}%` },
        border: { color: 'rgba(255,255,255,0.07)' },
        min: 80,
        max: 100,
      },
    },
  }

  return (
    <div style={{ height: 190, padding: '12px 16px' }}>
      <Line data={chartData} options={chartOptions} />
    </div>
  )
}

// ─── Value at Risk Donut ──────────────────────────────────────

function ValueAtRiskChart({ exceptions }: { exceptions: Exception[] }) {
  const bucketValues = useMemo(() => {
    const vals: Record<string, number> = {}
    for (const b of AGE_BUCKETS) vals[b.key] = 0
    for (const exc of exceptions) {
      const b = getBucket(exc.item.age)
      vals[b] = (vals[b] ?? 0) + Math.abs(exc.item.amount)
    }
    return vals
  }, [exceptions])

  const total = Object.values(bucketValues).reduce((s, v) => s + v, 0)

  const chartData = {
    labels: AGE_BUCKETS.map(b => b.label),
    datasets: [
      {
        data: AGE_BUCKETS.map(b => bucketValues[b.key] ?? 0),
        backgroundColor: AGE_BUCKETS.map(b => b.colorDim),
        borderColor: AGE_BUCKETS.map(b => b.color),
        borderWidth: 1,
        hoverOffset: 6,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          color: C.textMuted,
          font: { size: 10 },
          boxWidth: 10,
          padding: 8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15,17,23,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: C.textPrimary,
        bodyColor: C.textSecondary,
        padding: 10,
        callbacks: {
          label: (ctx: { label: string; parsed: number }) => {
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0'
            return `${ctx.label}: ${usd.format(ctx.parsed)} (${pct}%)`
          },
        },
      },
    },
  }

  return (
    <div style={{ height: 200, padding: '12px 16px', position: 'relative' }}>
      <Doughnut data={chartData} options={chartOptions} />
      {/* Center label */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '30%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
          {compact.format(total)}
        </div>
        <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>Total Value</div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────

export default function AgingAnalysis() {
  const exceptions       = useReconStore(s => s.exceptions)
  const contexts         = useReconStore(s => s.contexts)
  const [filterCtx, setFilterCtx] = useState<string>('ALL')

  const filteredExceptions = useMemo(
    () => filterCtx === 'ALL'
      ? exceptions
      : exceptions.filter(e => e.contextId === filterCtx),
    [exceptions, filterCtx]
  )

  // Aging matrix — rows = contexts
  const contextMatrixRows = useMemo<MatrixRow[]>(() => {
    return contexts.map(ctx => {
      const ctxExc = filteredExceptions.filter(e => e.contextId === ctx.id)
      const buckets: Record<string, { count: number; value: number }> = {}
      for (const b of AGE_BUCKETS) buckets[b.key] = { count: 0, value: 0 }
      for (const exc of ctxExc) {
        const b = getBucket(exc.item.age)
        buckets[b].count++
        buckets[b].value += Math.abs(exc.item.amount)
      }
      return { label: ctx.name, buckets }
    })
  }, [filteredExceptions, contexts])

  // Aging matrix — rows = reason codes
  const reasonMatrixRows = useMemo<MatrixRow[]>(() => {
    const codes = new Set<ReasonCode>()
    for (const exc of filteredExceptions) codes.add(exc.reasonCode)
    return [...codes].map(code => {
      const codeExc = filteredExceptions.filter(e => e.reasonCode === code)
      const buckets: Record<string, { count: number; value: number }> = {}
      for (const b of AGE_BUCKETS) buckets[b.key] = { count: 0, value: 0 }
      for (const exc of codeExc) {
        const b = getBucket(exc.item.age)
        buckets[b].count++
        buckets[b].value += Math.abs(exc.item.amount)
      }
      return { label: REASON_LABELS[code] ?? code, buckets }
    })
  }, [filteredExceptions])

  const totalExceptions = filteredExceptions.length
  const totalValue = filteredExceptions.reduce((s, e) => s + Math.abs(e.item.amount), 0)
  const slaBreached = filteredExceptions.filter(e => e.slaBreach).length

  return (
    <div
      style={{
        background: C.bg,
        minHeight: '100%',
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxSizing: 'border-box',
      }}
    >
      {/* Top bar: summary + context filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Mini summary pills */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flex: 1,
          }}
        >
          {[
            { label: 'Total Exceptions', value: String(totalExceptions), color: C.amber },
            { label: 'Total Value',      value: compact.format(totalValue),   color: C.blue   },
            { label: 'SLA Breached',     value: String(slaBreached),           color: C.red    },
            { label: 'Contexts',         value: String(contexts.length),       color: C.purple },
          ].map(pill => (
            <div
              key={pill.label}
              style={{
                background: C.card,
                border: C.border,
                borderRadius: 6,
                padding: '8px 14px',
                flex: 1,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted }}>
                {pill.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: pill.color, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                {pill.value}
              </div>
            </div>
          ))}
        </div>

        {/* Context filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted }}>
            Filter Context
          </span>
          <select
            value={filterCtx}
            onChange={e => setFilterCtx(e.target.value)}
            style={{
              background: C.card,
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 5,
              color: C.textPrimary,
              fontSize: 11,
              padding: '5px 10px',
              outline: 'none',
              cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <option value="ALL">All Contexts</option>
            {contexts.map(ctx => (
              <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 1: Aging matrix by context */}
      <Card title="Aging Matrix — By Context" subtitle={filterCtx === 'ALL' ? 'all contexts' : contexts.find(c => c.id === filterCtx)?.name}>
        <AgingMatrix rows={contextMatrixRows} title="Context" />
      </Card>

      {/* Row 2: Aging matrix by reason code */}
      <Card title="Aging Matrix — By Reason Code">
        <AgingMatrix rows={reasonMatrixRows} title="Reason Code" />
      </Card>

      {/* Row 3: two charts side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Analyst stacked bar */}
        <Card title="Aging by Analyst" subtitle="exceptions by age bucket per analyst">
          <AnalystAgingChart exceptions={filteredExceptions} />
        </Card>

        {/* Value at Risk donut */}
        <Card title="Value at Risk by Age Bucket">
          <ValueAtRiskChart exceptions={filteredExceptions} />
        </Card>
      </div>

      {/* Row 4: Trend line */}
      <Card title="Match Rate Trend" subtitle="historical match rate from recon runs">
        <AgingTrendChart />
      </Card>
    </div>
  )
}
