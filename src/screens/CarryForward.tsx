import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { useReconStore } from '../store/reconStore'
import type { ReconItem, ReconContext } from '../data/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// ─── Constants ────────────────────────────────────────────────

const C = {
  bg: '#0f1117',
  card: 'rgba(20,22,32,0.85)',
  border: '1px solid rgba(255,255,255,0.07)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.12)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.12)',
  red: '#f87171',
  redDim: 'rgba(248,113,113,0.12)',
  blue: '#06B6D4',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.065)',
}

const AGE_BUCKETS = [
  { key: '1-2d',  label: '1-2d',  min: 1,  max: 2,  color: '#34d399' },
  { key: '3-5d',  label: '3-5d',  min: 3,  max: 5,  color: '#84cc16' },
  { key: '6-10d', label: '6-10d', min: 6,  max: 10, color: '#fbbf24' },
  { key: '11-15d',label: '11-15d',min: 11, max: 15, color: '#f97316' },
  { key: '16-30d',label: '16-30d',min: 16, max: 30, color: '#fb923c' },
  { key: '30d+',  label: '30d+',  min: 31, max: Infinity, color: '#f87171' },
]

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

function cfDayColor(days: number): string {
  if (days < 3)  return C.green
  if (days <= 7) return C.amber
  return C.red
}

function cfDayBg(days: number): string {
  if (days < 3)  return C.greenDim
  if (days <= 7) return C.amberDim
  return C.redDim
}

function ageBucket(days: number): string {
  for (const b of AGE_BUCKETS) {
    if (days >= b.min && days <= b.max) return b.key
  }
  return '30d+'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────

interface SummaryTileProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function SummaryTile({ label, value, sub, accent = C.blue }: SummaryTileProps) {
  return (
    <div
      style={{
        background: C.card,
        border: C.border,
        borderRadius: 8,
        padding: '14px 18px',
        position: 'relative',
        overflow: 'hidden',
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted }}>
        {label}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: C.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: '3px 0 0', fontSize: 10, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

interface CardProps {
  title: string
  children: React.ReactNode
  style?: React.CSSProperties
}

function Card({ title, children, style }: CardProps) {
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
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: C.textMuted,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Context Summary Row ──────────────────────────────────────

interface CtxRowData {
  ctx: ReconContext
  items: ReconItem[]
  totalValue: number
  avgAge: number
  prevCount: number
}

function ContextSummaryTable({ rows, activeId, onSelect }: {
  rows: CtxRowData[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
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
          {['Context', 'CF Items', 'CF Value', 'Avg Age', 'Trend'].map(h => (
            <th
              key={h}
              style={{
                padding: '7px 12px',
                textAlign: h === 'Context' ? 'left' : 'right',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: C.textMuted,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                whiteSpace: 'nowrap',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const isActive = row.ctx.id === activeId
          const trend = row.items.length - row.prevCount
          return (
            <tr
              key={row.ctx.id}
              onClick={() => onSelect(row.ctx.id)}
              style={{
                cursor: 'pointer',
                background: isActive ? C.surfaceHover : 'transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
            >
              <td style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: isActive ? 600 : 400, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {row.ctx.name}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: C.textSecondary, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {row.items.length}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: C.textSecondary, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {usd.format(row.totalValue)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: cfDayColor(row.avgAge), fontWeight: 600 }}>
                  {row.avgAge.toFixed(1)}d
                </span>
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {trend === 0 ? (
                  <span style={{ color: C.textMuted }}>—</span>
                ) : trend > 0 ? (
                  <span style={{ color: C.red }}>▲ {trend}</span>
                ) : (
                  <span style={{ color: C.green }}>▼ {Math.abs(trend)}</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── CF Items List ────────────────────────────────────────────

function CfItemsList({ items }: { items: ReconItem[] }) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.carryForwardDays - a.carryForwardDays),
    [items]
  )

  if (sorted.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: C.textMuted, fontSize: 11 }}>
        No carry-forward items for this context.
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
            {['Reference', 'Side', 'Amount', 'Original Date', 'CF Days', 'Reason', 'Assigned To'].map(h => (
              <th
                key={h}
                style={{
                  padding: '7px 12px',
                  textAlign: ['Amount', 'CF Days'].includes(h) ? 'right' : 'left',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: C.textMuted,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr
              key={item.id}
              style={{
                background: i % 2 === 0 ? 'transparent' : C.surface,
              }}
            >
              <td style={{ padding: '7px 12px', color: C.blue, fontFamily: 'monospace', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {item.reference}
              </td>
              <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: item.side === 'INTERNAL' ? 'rgba(6,182,212,0.15)' : 'rgba(167,139,250,0.15)',
                    color: item.side === 'INTERNAL' ? C.blue : '#a78bfa',
                  }}
                >
                  {item.side === 'INTERNAL' ? 'INT' : 'EXT'}
                </span>
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', color: item.amount < 0 ? C.red : C.green, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {usd.format(item.amount)}
              </td>
              <td style={{ padding: '7px 12px', color: C.textSecondary, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {formatDate(item.valueDate)}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    background: cfDayBg(item.carryForwardDays),
                    color: cfDayColor(item.carryForwardDays),
                  }}
                >
                  {item.carryForwardDays}d
                </span>
              </td>
              <td style={{ padding: '7px 12px', color: C.textSecondary, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {item.reasonCode ?? '—'}
              </td>
              <td style={{ padding: '7px 12px', color: C.textMuted, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {item.assignedTo ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Aging Chart ──────────────────────────────────────────────

function AgingBarChart({ items }: { items: ReconItem[] }) {
  const bucketTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const b of AGE_BUCKETS) totals[b.key] = 0
    for (const item of items) {
      const b = ageBucket(item.carryForwardDays)
      totals[b] = (totals[b] ?? 0) + 1
    }
    return totals
  }, [items])

  const chartData = {
    labels: AGE_BUCKETS.map(b => b.label),
    datasets: [
      {
        label: 'CF Items',
        data: AGE_BUCKETS.map(b => bucketTotals[b.key] ?? 0),
        backgroundColor: AGE_BUCKETS.map(b => b.color + 'cc'),
        borderColor: AGE_BUCKETS.map(b => b.color),
        borderWidth: 1,
        borderRadius: 3,
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
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        border: { color: 'rgba(255,255,255,0.07)' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { size: 10 }, precision: 0 },
        border: { color: 'rgba(255,255,255,0.07)' },
        beginAtZero: true,
      },
    },
  }

  return (
    <div style={{ height: 180, padding: '12px 16px' }}>
      <Bar data={chartData} options={chartOptions} />
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────

export default function CarryForward() {
  const items          = useReconStore(s => s.items)
  const contexts       = useReconStore(s => s.contexts)
  const activeContextId = useReconStore(s => s.activeContextId)
  const setActiveContext = useReconStore(s => s.setActiveContext)

  // All CF items
  const cfItems = useMemo(
    () => items.filter(i => i.isCarryForward),
    [items]
  )

  // Per-context summaries
  const ctxRows = useMemo<CtxRowData[]>(() => {
    return contexts.map(ctx => {
      const ctxItems = cfItems.filter(i => i.contextId === ctx.id)
      const totalValue = ctxItems.reduce((s, i) => s + Math.abs(i.amount), 0)
      const avgAge = ctxItems.length
        ? ctxItems.reduce((s, i) => s + i.carryForwardDays, 0) / ctxItems.length
        : 0
      // Simulate previous count as 85% of current (seed-deterministic feel)
      const prevCount = Math.round(ctxItems.length * 0.85)
      return { ctx, items: ctxItems, totalValue, avgAge, prevCount }
    })
  }, [cfItems, contexts])

  // Summary bar
  const totalItems = cfItems.length
  const totalValue = cfItems.reduce((s, i) => s + Math.abs(i.amount), 0)
  const avgAge = totalItems
    ? cfItems.reduce((s, i) => s + i.carryForwardDays, 0) / totalItems
    : 0
  const oldestAge = totalItems
    ? Math.max(...cfItems.map(i => i.carryForwardDays))
    : 0

  // Active context filtered items
  const activeItems = useMemo(
    () => cfItems.filter(i => i.contextId === activeContextId),
    [cfItems, activeContextId]
  )

  const activeCtx = contexts.find(c => c.id === activeContextId)

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
      {/* Summary Bar */}
      <div style={{ display: 'flex', gap: 12 }}>
        <SummaryTile
          label="Total CF Items"
          value={String(totalItems)}
          sub="across all contexts"
          accent="#06B6D4"
        />
        <SummaryTile
          label="Total CF Value"
          value={compact.format(totalValue)}
          sub={usd.format(totalValue)}
          accent="#a78bfa"
        />
        <SummaryTile
          label="Avg CF Age"
          value={`${avgAge.toFixed(1)}d`}
          sub="days outstanding"
          accent={cfDayColor(avgAge)}
        />
        <SummaryTile
          label="Oldest Item"
          value={`${oldestAge}d`}
          sub="maximum carry-forward days"
          accent={cfDayColor(oldestAge)}
        />
      </div>

      {/* Context Selector + Summary Table */}
      <Card title="CF Items by Context">
        <ContextSummaryTable
          rows={ctxRows}
          activeId={activeContextId}
          onSelect={setActiveContext}
        />
      </Card>

      {/* CF Items List */}
      <Card
        title={`CF Items — ${activeCtx?.name ?? activeContextId} (${activeItems.length})`}
        style={{ flex: 1 }}
      >
        <CfItemsList items={activeItems} />
      </Card>

      {/* CF Aging Chart */}
      <Card title="CF Aging Distribution — All Contexts">
        <AgingBarChart items={cfItems} />
      </Card>
    </div>
  )
}
