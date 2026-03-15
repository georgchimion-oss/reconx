import type React from 'react'
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
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { useReconStore } from '../store/reconStore'
import type { DashboardKPIs, ReconContext, UserRole, BalancePool, WriteOffRequest } from '../data/types'

ChartJS.register(
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
)

// ─── Constants ───────────────────────────────────────────────

const COLOR = {
  bg: '#0f1117',
  card: 'rgba(26, 29, 41, 0.7)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderAccent: 'rgba(255, 255, 255, 0.18)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  green: '#34d399',
  greenDim: 'rgba(52, 211, 153, 0.15)',
  amber: '#fbbf24',
  amberDim: 'rgba(251, 191, 36, 0.15)',
  red: '#f87171',
  redDim: 'rgba(248, 113, 113, 0.15)',
  blue: '#60a5fa',
  blueDim: 'rgba(96, 165, 250, 0.15)',
  purple: '#a78bfa',
  purpleDim: 'rgba(167, 139, 250, 0.15)',
  cyan: '#06b6d4',
  surface: 'rgba(255, 255, 255, 0.04)',
  surfaceHover: 'rgba(255, 255, 255, 0.07)',
}

const AGING_COLORS = [
  '#34d399', // 0-1d  — green
  '#84cc16', // 2-5d  — lime
  '#fbbf24', // 6-15d — amber
  '#f97316', // 16-30d — orange
  '#f87171', // 30d+  — red
]

const TIER_COLORS = [
  'rgba(96, 165, 250, 0.85)',
  'rgba(167, 139, 250, 0.85)',
  'rgba(251, 191, 36, 0.85)',
  'rgba(248, 113, 113, 0.85)',
]

const TIER_BORDERS = ['#60a5fa', '#a78bfa', '#fbbf24', '#f87171']

// ─── Helpers ─────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function matchRateColor(rate: number): string {
  if (rate >= 95) return COLOR.green
  if (rate >= 90) return COLOR.amber
  return COLOR.red
}

function matchRateDimColor(rate: number): string {
  if (rate >= 95) return COLOR.greenDim
  if (rate >= 90) return COLOR.amberDim
  return COLOR.redDim
}

function healthColor(status: ReconContext['healthStatus']): string {
  if (status === 'GREEN') return COLOR.green
  if (status === 'AMBER') return COLOR.amber
  return COLOR.red
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────

interface StatCardProps {
  label: string
  children: React.ReactNode
  accent?: string
  accentDim?: string
  fullHeight?: boolean
}

function StatCard({ label, children, accent = COLOR.blue, fullHeight }: StatCardProps) {
  return (
    <div
      style={{
        background: COLOR.card,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 4px 16px rgba(0,0,0,0.2)',
        ...(fullHeight ? { height: '100%', boxSizing: 'border-box' } : {}),
      }}
    >
      {/* top accent strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
          borderRadius: '12px 12px 0 0',
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: COLOR.textMuted,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

function ChartCard({ title, subtitle, children, style }: ChartCardProps) {
  return (
    <div
      style={{
        background: COLOR.card,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 4px 16px rgba(0,0,0,0.2)',
        ...style,
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: COLOR.textPrimary,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </p>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: COLOR.textMuted }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Match Rate Ring ──────────────────────────────────────────

function MatchRateRing({ rate }: { rate: number }) {
  const color = matchRateColor(rate)
  const dimColor = matchRateDimColor(rate)
  const radius = 42
  const stroke = 6
  const circ = 2 * Math.PI * radius
  const filled = (rate / 100) * circ

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          {/* track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={dimColor}
            strokeWidth={stroke}
          />
          {/* fill */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeDashoffset={circ * 0.25}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {rate.toFixed(1)}
          </span>
          <span style={{ fontSize: 10, color: COLOR.textMuted, marginTop: 2 }}>%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: dimColor,
              color,
              letterSpacing: '0.04em',
            }}
          >
            {rate >= 95 ? 'STRONG' : rate >= 90 ? 'WATCH' : 'CRITICAL'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: COLOR.textSecondary, lineHeight: 1.5 }}>
          {rate >= 95
            ? 'All contexts within SLA thresholds'
            : rate >= 90
            ? 'Monitor flagged contexts'
            : 'Immediate action required'}
        </p>
      </div>
    </div>
  )
}

// ─── Context Health Pills ─────────────────────────────────────

function ContextHealthRow({ contexts }: { contexts: ReconContext[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {contexts.map(ctx => (
        <div
          key={ctx.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 8,
            background: COLOR.surface,
            border: `1px solid ${COLOR.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: healthColor(ctx.healthStatus),
                boxShadow: `0 0 6px ${healthColor(ctx.healthStatus)}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: COLOR.textPrimary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {ctx.name}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: healthColor(ctx.healthStatus),
              marginLeft: 12,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {ctx.matchRate.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Role Banner ──────────────────────────────────────────────

interface RoleBannerProps {
  activeRole: UserRole
  balancePools: BalancePool[]
  writeOffs: WriteOffRequest[]
}

function RoleBanner({ activeRole, balancePools, writeOffs }: RoleBannerProps) {
  if (activeRole === 'ANALYST') {
    const items = [
      { label: 'Items Assigned', value: '8', color: COLOR.blue },
      { label: 'Avg Resolution', value: '2.4h', color: COLOR.cyan },
      { label: 'SLA Compliance', value: '96.5%', color: COLOR.green },
    ]

    return (
      <div
        style={{
          background: COLOR.card,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 12,
          padding: '16px 24px',
          marginBottom: 20,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${COLOR.blue}, transparent)`,
            borderRadius: '12px 12px 0 0',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: COLOR.textMuted,
                marginBottom: 4,
              }}
            >
              My Queue
            </p>
            <p style={{ margin: 0, fontSize: 12, color: COLOR.textSecondary }}>
              Your personal workload summary for today
            </p>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            {items.map(item => (
              <div key={item.label} style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {item.label}
                </p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: item.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // SUPERVISOR view
  const pendingSignOffs = balancePools.filter(p => p.signOffStatus === 'PENDING').length
  const pendingWriteOffs = writeOffs.filter(w => w.status === 'PENDING').length

  const items = [
    { label: 'Active Analysts', value: '3', color: COLOR.blue },
    { label: 'Pending Sign-offs', value: pendingSignOffs.toString(), color: pendingSignOffs > 0 ? COLOR.amber : COLOR.green },
    { label: 'Write-offs Pending', value: pendingWriteOffs.toString(), color: pendingWriteOffs > 0 ? COLOR.red : COLOR.green },
  ]

  return (
    <div
      style={{
        background: COLOR.card,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 12,
        padding: '16px 24px',
        marginBottom: 20,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${COLOR.purple}, transparent)`,
          borderRadius: '12px 12px 0 0',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: COLOR.textMuted,
              marginBottom: 4,
            }}
          >
            Team Overview
          </p>
          <p style={{ margin: 0, fontSize: 12, color: COLOR.textSecondary }}>
            Supervisor summary — items requiring your action
          </p>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          {items.map(item => (
            <div key={item.label} style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {item.label}
              </p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: item.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────

export default function Dashboard() {
  const kpis: DashboardKPIs = useReconStore(s => s.kpis)
  const contexts: ReconContext[] = useReconStore(s => s.contexts)
  const activeRole: UserRole = useReconStore(s => s.activeRole)
  const balancePools: BalancePool[] = useReconStore(s => s.balancePools)
  const writeOffs: WriteOffRequest[] = useReconStore(s => s.writeOffs)

  // Guard — store not yet initialized
  if (!kpis || kpis.overallMatchRate === undefined) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLOR.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${COLOR.border}`,
              borderTopColor: COLOR.blue,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: COLOR.textSecondary, fontSize: 14, margin: 0 }}>
            Loading dashboard data...
          </p>
        </div>
      </div>
    )
  }

  const {
    overallMatchRate,
    totalItems,
    matchedItems,
    exceptionCount,
    poolsInProof,
    poolsOutOfProof,
    agingBuckets,
    valueTiers,
    matchRateTrend,
    topBreakCounterparties,
  } = kpis

  const totalPools = poolsInProof + poolsOutOfProof
  const matchPct = totalItems > 0 ? ((matchedItems / totalItems) * 100).toFixed(1) : '0'
  const exceptionPct = totalItems > 0 ? (100 - parseFloat(matchPct)).toFixed(1) : '0'

  // ── Chart data: Match Rate Trend ──────────────────────────

  const trendLabels = matchRateTrend.map(p => formatDate(p.date))
  const trendValues = matchRateTrend.map(p => p.matchRate)

  const trendData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Match Rate',
        data: trendValues,
        borderColor: COLOR.blue,
        backgroundColor: 'rgba(96, 165, 250, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: COLOR.blue,
        pointBorderColor: COLOR.bg,
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const trendOptions: React.ComponentProps<typeof Line>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderColor: COLOR.border,
        borderWidth: 1,
        titleColor: COLOR.textSecondary,
        bodyColor: COLOR.textPrimary,
        padding: 12,
        callbacks: {
          label: ctx => ` Match Rate: ${(ctx.parsed.y ?? 0).toFixed(2)}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: COLOR.textMuted,
          font: { size: 10 },
          maxTicksLimit: 8,
          maxRotation: 0,
        },
        border: { color: 'transparent' },
      },
      y: {
        min: 88,
        max: 100,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: COLOR.textMuted,
          font: { size: 10 },
          callback: val => `${val}%`,
        },
        border: { color: 'transparent' },
      },
    },
  }

  // ── Chart data: Aging Buckets ─────────────────────────────

  const agingData = {
    labels: agingBuckets.map(b => b.label),
    datasets: [
      {
        label: 'Items',
        data: agingBuckets.map(b => b.count),
        backgroundColor: AGING_COLORS.map(c => c + 'cc'),
        borderColor: AGING_COLORS,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }

  const agingOptions: React.ComponentProps<typeof Bar>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderColor: COLOR.border,
        borderWidth: 1,
        titleColor: COLOR.textSecondary,
        bodyColor: COLOR.textPrimary,
        padding: 12,
        callbacks: {
          label: ctx => {
            const idx = ctx.dataIndex
            const bucket = agingBuckets[idx]
            return [
              ` Items: ${(ctx.parsed.x ?? 0).toLocaleString()}`,
              ` Value: ${usd.format(bucket.value)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: COLOR.textMuted,
          font: { size: 10 },
          callback: val => compact.format(val as number),
        },
        border: { color: 'transparent' },
      },
      y: {
        grid: { display: false },
        ticks: { color: COLOR.textSecondary, font: { size: 12, weight: 'bold' } },
        border: { color: 'transparent' },
      },
    },
  }

  // ── Chart data: Value Tier Doughnut ───────────────────────

  const tierData = {
    labels: valueTiers.map(t => t.label),
    datasets: [
      {
        data: valueTiers.map(t => t.count),
        backgroundColor: TIER_COLORS,
        borderColor: TIER_BORDERS,
        borderWidth: 1.5,
        hoverOffset: 8,
      },
    ],
  }

  const tierOptions: React.ComponentProps<typeof Doughnut>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: COLOR.textSecondary,
          font: { size: 11 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 17, 23, 0.95)',
        borderColor: COLOR.border,
        borderWidth: 1,
        titleColor: COLOR.textSecondary,
        bodyColor: COLOR.textPrimary,
        padding: 12,
        callbacks: {
          label: ctx => {
            const total = valueTiers.reduce((s, t) => s + t.count, 0)
            const pct = ((ctx.parsed / total) * 100).toFixed(1)
            return ` ${ctx.parsed.toLocaleString()} items (${pct}%)`
          },
        },
      },
    },
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLOR.bg,
        padding: '28px 32px',
        fontFamily:
          "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* ── Page Header ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: COLOR.textPrimary,
              letterSpacing: '-0.03em',
            }}
          >
            Reconciliation Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: COLOR.textMuted }}>
            As of March 15, 2026 &nbsp;·&nbsp; All times UTC &nbsp;·&nbsp; Auto-refreshed at 06:00
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            background: COLOR.greenDim,
            border: `1px solid ${COLOR.green}40`,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: COLOR.green,
              boxShadow: `0 0 6px ${COLOR.green}`,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLOR.green }}>
            Live
          </span>
        </div>
      </div>

      {/* ── Role Banner ───────────────────────────────────── */}
      <RoleBanner activeRole={activeRole} balancePools={balancePools} writeOffs={writeOffs} />

      {/* ── Top KPI Stat Cards ─────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Card 1 — Overall Match Rate */}
        <StatCard
          label="Overall Match Rate"
          accent={matchRateColor(overallMatchRate)}
          accentDim={matchRateDimColor(overallMatchRate)}
        >
          <MatchRateRing rate={overallMatchRate} />
        </StatCard>

        {/* Card 2 — Total Items */}
        <StatCard label="Total Items" accent={COLOR.blue} accentDim={COLOR.blueDim}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 800,
                color: COLOR.textPrimary,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totalItems.toLocaleString()}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLOR.textMuted }}>
              across {contexts.length} reconciliation contexts
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <div
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 8,
                background: COLOR.greenDim,
                border: `1px solid ${COLOR.green}30`,
              }}
            >
              <p style={{ margin: 0, fontSize: 10, color: COLOR.green, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Matched
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: COLOR.green, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {matchedItems.toLocaleString()}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: COLOR.textMuted }}>
                {matchPct}%
              </p>
            </div>

            <div
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 8,
                background: COLOR.redDim,
                border: `1px solid ${COLOR.red}30`,
              }}
            >
              <p style={{ margin: 0, fontSize: 10, color: COLOR.red, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Exceptions
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: COLOR.red, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {exceptionCount.toLocaleString()}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: COLOR.textMuted }}>
                {exceptionPct}%
              </p>
            </div>
          </div>
        </StatCard>

        {/* Card 3 — Pools Status */}
        <StatCard label="Balance Pools" accent={COLOR.purple} accentDim={COLOR.purpleDim}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 800,
                color: COLOR.textPrimary,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totalPools}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: COLOR.textMuted }}>
              total pools across all contexts
            </p>
          </div>

          <div style={{ marginTop: 4 }}>
            {/* In-Proof bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: COLOR.green, fontWeight: 600 }}>
                  In Proof
                </span>
                <span style={{ fontSize: 11, color: COLOR.textSecondary }}>
                  {poolsInProof} / {totalPools}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${totalPools > 0 ? (poolsInProof / totalPools) * 100 : 0}%`,
                    background: `linear-gradient(90deg, ${COLOR.green}, #34d399)`,
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>

            {/* Out-of-Proof bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: COLOR.red, fontWeight: 600 }}>
                  Out of Proof
                </span>
                <span style={{ fontSize: 11, color: COLOR.textSecondary }}>
                  {poolsOutOfProof} / {totalPools}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${totalPools > 0 ? (poolsOutOfProof / totalPools) * 100 : 0}%`,
                    background: `linear-gradient(90deg, ${COLOR.red}, #f87171)`,
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </StatCard>

        {/* Card 4 — Exception Count */}
        <StatCard
          label="Open Exceptions"
          accent={exceptionCount > 200 ? COLOR.red : exceptionCount > 100 ? COLOR.amber : COLOR.green}
          accentDim={exceptionCount > 200 ? COLOR.redDim : exceptionCount > 100 ? COLOR.amberDim : COLOR.greenDim}
        >
          {(() => {
            const excColor =
              exceptionCount > 200 ? COLOR.red : exceptionCount > 100 ? COLOR.amber : COLOR.green
            const excDim =
              exceptionCount > 200 ? COLOR.redDim : exceptionCount > 100 ? COLOR.amberDim : COLOR.greenDim
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 36,
                      fontWeight: 800,
                      color: excColor,
                      letterSpacing: '-0.04em',
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {exceptionCount.toLocaleString()}
                  </p>
                  <span
                    style={{
                      marginBottom: 4,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: excDim,
                      color: excColor,
                    }}
                  >
                    {exceptionCount > 200 ? 'HIGH' : exceptionCount > 100 ? 'MEDIUM' : 'LOW'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: COLOR.textMuted }}>
                  unresolved breaks requiring action
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {[
                    { label: 'SLA Breached', value: Math.floor(exceptionCount * 0.12), color: COLOR.red },
                    { label: 'Due Today', value: Math.floor(exceptionCount * 0.19), color: COLOR.amber },
                    { label: 'Within SLA', value: Math.floor(exceptionCount * 0.69), color: COLOR.green },
                  ].map(item => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: item.color,
                          }}
                        />
                        <span style={{ fontSize: 11, color: COLOR.textSecondary }}>
                          {item.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </StatCard>
      </div>

      {/* ── Row 2: Match Rate Trend + Context Health ─────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Match Rate Trend Chart */}
        <ChartCard
          title="Match Rate Trend"
          subtitle="30-day rolling window — business days only"
        >
          <div style={{ height: 240, position: 'relative' }}>
            <Line data={trendData} options={trendOptions} />
          </div>

          {/* Mini stats below chart */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              paddingTop: 12,
              borderTop: `1px solid ${COLOR.border}`,
            }}
          >
            {[
              {
                label: '30d High',
                value: `${Math.max(...trendValues).toFixed(2)}%`,
                color: COLOR.green,
              },
              {
                label: '30d Low',
                value: `${Math.min(...trendValues).toFixed(2)}%`,
                color: COLOR.red,
              },
              {
                label: '30d Avg',
                value: `${(trendValues.reduce((a, b) => a + b, 0) / trendValues.length).toFixed(2)}%`,
                color: COLOR.blue,
              },
              {
                label: 'Trend',
                value:
                  trendValues[trendValues.length - 1] > trendValues[0]
                    ? 'Improving'
                    : 'Declining',
                color:
                  trendValues[trendValues.length - 1] > trendValues[0]
                    ? COLOR.green
                    : COLOR.red,
              },
            ].map(stat => (
              <div key={stat.label}>
                <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Context Health */}
        <ChartCard
          title="Context Health"
          subtitle="Per-context match rate status"
        >
          <ContextHealthRow contexts={contexts} />

          <div
            style={{
              paddingTop: 12,
              borderTop: `1px solid ${COLOR.border}`,
              display: 'flex',
              gap: 16,
            }}
          >
            {(
              [
                { label: 'Healthy', status: 'GREEN', color: COLOR.green },
                { label: 'Watch', status: 'AMBER', color: COLOR.amber },
                { label: 'Critical', status: 'RED', color: COLOR.red },
              ] as const
            ).map(item => {
              const count = contexts.filter(c => c.healthStatus === item.status).length
              return (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: item.color,
                    }}
                  />
                  <span style={{ fontSize: 11, color: COLOR.textSecondary }}>
                    {count} {item.label}
                  </span>
                </div>
              )
            })}
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Aging Buckets + Doughnut + Break Table ────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px 1fr',
          gap: 16,
        }}
      >
        {/* Aging Buckets */}
        <ChartCard
          title="Exception Aging Buckets"
          subtitle="Unresolved breaks by days outstanding"
        >
          <div style={{ height: 220 }}>
            <Bar data={agingData} options={agingOptions} />
          </div>

          {/* Aging value summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 6,
              paddingTop: 12,
              borderTop: `1px solid ${COLOR.border}`,
            }}
          >
            {agingBuckets.map((bucket, i) => (
              <div
                key={bucket.label}
                style={{
                  textAlign: 'center',
                  padding: '6px 4px',
                  borderRadius: 6,
                  background: `${AGING_COLORS[i]}12`,
                  border: `1px solid ${AGING_COLORS[i]}30`,
                }}
              >
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: AGING_COLORS[i] }}>
                  {bucket.label}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 11, fontWeight: 600, color: COLOR.textPrimary }}>
                  {compact.format(bucket.value)}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Value Tier Doughnut */}
        <ChartCard
          title="Value Tier"
          subtitle="Exceptions by size"
        >
          <div style={{ height: 180 }}>
            <Doughnut data={tierData} options={tierOptions} />
          </div>

          <div
            style={{
              paddingTop: 10,
              borderTop: `1px solid ${COLOR.border}`,
            }}
          >
            {valueTiers.map((tier, i) => {
              const total = valueTiers.reduce((s, t) => s + t.count, 0)
              const pct = total > 0 ? ((tier.count / total) * 100).toFixed(0) : '0'
              return (
                <div
                  key={tier.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: TIER_BORDERS[i],
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: COLOR.textSecondary }}>{tier.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: COLOR.textMuted }}>{pct}%</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: COLOR.textPrimary }}>
                      {tier.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>

        {/* Top Break Counterparties */}
        <ChartCard
          title="Top Break Counterparties"
          subtitle="Ranked by open break count"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 110px',
                gap: 8,
                padding: '0 8px 8px',
                borderBottom: `1px solid ${COLOR.border}`,
              }}
            >
              {['Counterparty', 'Breaks', 'Total Value'].map(h => (
                <span
                  key={h}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: COLOR.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    textAlign: h === 'Counterparty' ? 'left' : 'right',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Table Rows */}
            {topBreakCounterparties.map((row, i) => {
              const maxBreaks = topBreakCounterparties[0].breakCount
              const barWidth = (row.breakCount / maxBreaks) * 100
              const rowColor =
                i === 0 ? COLOR.red : i === 1 ? COLOR.amber : COLOR.textSecondary

              return (
                <div
                  key={row.counterparty}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 110px',
                    gap: 8,
                    padding: '10px 8px',
                    borderBottom: `1px solid ${COLOR.border}`,
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  {/* Subtle rank bar background */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${barWidth}%`,
                      background: `${rowColor}08`,
                      borderRadius: 4,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Rank + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: `${rowColor}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        color: rowColor,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: COLOR.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.counterparty}
                    </span>
                  </div>

                  {/* Break count */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: rowColor,
                      textAlign: 'right',
                      zIndex: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {row.breakCount}
                  </span>

                  {/* Total value */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: COLOR.textSecondary,
                      textAlign: 'right',
                      zIndex: 1,
                    }}
                  >
                    {usd.format(row.totalValue)}
                  </span>
                </div>
              )
            })}

            {/* Footer total */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 110px',
                gap: 8,
                padding: '10px 8px 0',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: COLOR.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLOR.textPrimary,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {topBreakCounterparties.reduce((s, r) => s + r.breakCount, 0)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: COLOR.textPrimary,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {usd.format(topBreakCounterparties.reduce((s, r) => s + r.totalValue, 0))}
              </span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Spinner keyframe — injected as a style tag */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
