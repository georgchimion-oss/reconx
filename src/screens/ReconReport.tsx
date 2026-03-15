import { useMemo } from 'react'
import { useReconStore } from '../store/reconStore'
import type { ReconContext, BalancePool, Exception, AuditEvent } from '../data/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'rgba(26, 29, 41, 0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 20,
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
}

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '5px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
}

const LABEL_TEXT: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
}

const VALUE_TEXT: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#f1f5f9',
  fontVariantNumeric: 'tabular-nums',
}

// ─── Proof Status Badge ───────────────────────────────────────────────────────

function ProofBadge({ status }: { status: 'IN_PROOF' | 'OUT_OF_PROOF' | 'PENDING' }) {
  const map = {
    IN_PROOF: { label: 'IN PROOF', color: '#10b981' },
    OUT_OF_PROOF: { label: 'OUT OF PROOF', color: '#ef4444' },
    PENDING: { label: 'PENDING', color: '#f59e0b' },
  }
  const { label, color } = map[status]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}18`,
        border: `1px solid ${color}35`,
        borderRadius: 6,
        padding: '3px 10px',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

// ─── Sign-Off Badge ───────────────────────────────────────────────────────────

function SignOffBadge({ pool }: { pool: BalancePool }) {
  if (pool.signOffStatus === 'APPROVED' && pool.signedOffBy) {
    return (
      <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
        APPROVED by {pool.signedOffBy}
        {pool.signedOffAt ? ` at ${new Date(pool.signedOffAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
      </span>
    )
  }
  if (pool.signOffStatus === 'REJECTED') {
    return <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>REJECTED</span>
  }
  return <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>PENDING sign-off</span>
}

// ─── Context Report Card ─────────────────────────────────────────────────────

interface ContextCardProps {
  context: ReconContext
  pool: BalancePool | undefined
  exceptions: Exception[]
}

function ContextCard({ context, pool, exceptions }: ContextCardProps) {
  const contextExceptions = exceptions.filter(e => e.contextId === context.id)
  const matchRate = context.matchRate
  const totalItems = context.totalItems
  const matchedItems = Math.round(totalItems * matchRate / 100)
  const exceptionCount = context.totalItems - matchedItems

  // Exception breakdown by reason code
  const reasonBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const exc of contextExceptions) {
      counts[exc.reasonCode] = (counts[exc.reasonCode] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [contextExceptions])

  const variance = pool?.variance ?? 0
  const isInProof = pool?.proofStatus === 'IN_PROOF'

  return (
    <div
      style={{
        ...CARD,
        borderLeft: `3px solid ${isInProof ? '#10b981' : '#ef4444'}`,
      }}
    >
      {/* Context header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{context.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {context.type} · {context.currency} · {context.counterparty}
          </div>
        </div>
        <ProofBadge status={pool?.proofStatus ?? 'PENDING'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Summary row */}
        <div>
          <div style={SECTION_LABEL}>Summary</div>
          {[
            { label: 'Total Items', value: totalItems.toLocaleString() },
            { label: 'Matched', value: matchedItems.toLocaleString() },
            { label: 'Exceptions', value: exceptionCount.toLocaleString() },
            { label: 'Match Rate', value: `${matchRate.toFixed(1)}%` },
          ].map(row => (
            <div key={row.label} style={ROW}>
              <span style={LABEL_TEXT}>{row.label}</span>
              <span style={{
                ...VALUE_TEXT,
                color: row.label === 'Match Rate'
                  ? matchRate >= 95 ? '#10b981' : matchRate >= 85 ? '#f59e0b' : '#ef4444'
                  : row.label === 'Exceptions' && exceptionCount > 0
                    ? '#f59e0b'
                    : '#f1f5f9',
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Balance proof */}
        <div>
          <div style={SECTION_LABEL}>Balance Proof</div>
          {pool ? (
            <>
              {[
                { label: 'Opening Balance', value: formatCurrency(pool.openingBalance, context.currency) },
                { label: 'Total Debits', value: formatCurrency(pool.totalDebits, context.currency) },
                { label: 'Total Credits', value: formatCurrency(pool.totalCredits, context.currency) },
                { label: 'Calc. Closing', value: formatCurrency(pool.calculatedClosing, context.currency) },
                { label: 'Stated Closing', value: formatCurrency(pool.statedClosing, context.currency) },
              ].map(row => (
                <div key={row.label} style={ROW}>
                  <span style={LABEL_TEXT}>{row.label}</span>
                  <span style={VALUE_TEXT}>{row.value}</span>
                </div>
              ))}
              <div style={{ ...ROW, borderBottom: 'none', paddingTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Variance</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: variance === 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  {formatCurrency(variance, context.currency)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', paddingTop: 4 }}>
              No balance pool for this context.
            </div>
          )}
        </div>

        {/* Sign-off & exceptions breakdown */}
        <div>
          <div style={SECTION_LABEL}>Sign-Off Status</div>
          <div style={{ marginBottom: 16 }}>
            {pool ? (
              <SignOffBadge pool={pool} />
            ) : (
              <span style={{ fontSize: 12, color: '#64748b' }}>No pool data</span>
            )}
          </div>

          {reasonBreakdown.length > 0 && (
            <>
              <div style={{ ...SECTION_LABEL, marginTop: 12 }}>Exceptions by Reason</div>
              {reasonBreakdown.map(([code, count]) => (
                <div key={code} style={ROW}>
                  <span style={{ ...LABEL_TEXT, fontSize: 11 }}>{code.replace(/_/g, ' ')}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#8b5cf6',
                      background: 'rgba(139,92,246,0.15)',
                      borderRadius: 10,
                      padding: '1px 8px',
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </>
          )}
          {contextExceptions.length === 0 && (
            <div style={{ fontSize: 12, color: '#10b981', fontStyle: 'italic', marginTop: 4 }}>
              No open exceptions
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

function AuditTrail({ events }: { events: AuditEvent[] }) {
  const recent = events.slice(0, 10)

  return (
    <div style={CARD}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 14 }}>
        Audit Trail
        <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>
          Last {recent.length} events
        </span>
      </div>

      {recent.length === 0 ? (
        <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
          No audit events recorded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recent.map(event => (
            <div
              key={event.id}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                padding: '9px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 160,
                }}
              >
                {formatDateTime(event.timestamp)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#3b82f6',
                  whiteSpace: 'nowrap',
                  minWidth: 180,
                }}
              >
                {event.action.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, lineHeight: 1.4 }}>
                {event.detail}
              </span>
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>
                {event.user}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReconReport() {
  const contexts = useReconStore(s => s.contexts)
  const balancePools = useReconStore(s => s.balancePools)
  const exceptions = useReconStore(s => s.exceptions)
  const auditTrail = useReconStore(s => s.auditTrail)

  const generatedAt = useMemo(() => new Date().toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }), [])

  // Overall summary across all contexts
  const overallMatchRate = useMemo(() => {
    if (contexts.length === 0) return 0
    const sum = contexts.reduce((acc, ctx) => acc + ctx.matchRate, 0)
    return sum / contexts.length
  }, [contexts])

  const totalVariance = useMemo(() => {
    return balancePools.reduce((sum, bp) => sum + Math.abs(bp.variance), 0)
  }, [balancePools])

  const poolsInProof = useMemo(
    () => balancePools.filter(bp => bp.proofStatus === 'IN_PROOF').length,
    [balancePools]
  )
  const poolsOutOfProof = useMemo(
    () => balancePools.filter(bp => bp.proofStatus === 'OUT_OF_PROOF').length,
    [balancePools]
  )

  // Helper to get balance pool for a context
  const getPool = (contextId: string): BalancePool | undefined =>
    balancePools.find(bp => bp.contextId === contextId)

  return (
    <div
      style={{
        background: '#0f1117',
        minHeight: '100vh',
        padding: '28px 32px',
        color: '#f1f5f9',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Report Header ── */}
      <div
        style={{
          ...CARD,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderLeft: '3px solid #3b82f6',
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
            Daily Reconciliation Report
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginTop: 4 }}>
            March 15, 2026
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            Generated: {generatedAt}
          </div>
        </div>

        <button
          className="no-print"
          onClick={() => window.print()}
          style={{
            padding: '9px 20px',
            borderRadius: 8,
            border: '1px solid rgba(59,130,246,0.4)',
            background: 'rgba(59,130,246,0.1)',
            color: '#3b82f6',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.03em',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.1)')}
        >
          Export / Print
        </button>
      </div>

      {/* ── Overall Summary ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 28,
        }}
      >
        {[
          {
            label: 'Overall Match Rate',
            value: `${overallMatchRate.toFixed(1)}%`,
            color: overallMatchRate >= 95 ? '#10b981' : overallMatchRate >= 85 ? '#f59e0b' : '#ef4444',
            subtext: `Across ${contexts.length} context${contexts.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Total Variance',
            value: totalVariance === 0 ? '$0.00' : formatCurrency(totalVariance),
            color: totalVariance === 0 ? '#10b981' : '#ef4444',
            subtext: 'Absolute sum of all breaks',
          },
          {
            label: 'Contexts In Proof',
            value: `${poolsInProof} / ${balancePools.length}`,
            color: poolsInProof === balancePools.length ? '#10b981' : '#f59e0b',
            subtext: 'Balance pools reconciled',
          },
          {
            label: 'Out of Proof',
            value: poolsOutOfProof.toString(),
            color: poolsOutOfProof === 0 ? '#10b981' : '#ef4444',
            subtext: poolsOutOfProof === 0 ? 'All pools balanced' : 'Require attention',
          },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(26,29,41,0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{stat.subtext}</div>
          </div>
        ))}
      </div>

      {/* ── Section Header: Context Reports ── */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16, letterSpacing: '0.02em' }}>
        Reconciliation Context Reports
      </div>

      {/* ── Per-Context Cards ── */}
      {contexts.length === 0 ? (
        <div
          style={{
            ...CARD,
            textAlign: 'center',
            color: '#475569',
            fontSize: 13,
            fontStyle: 'italic',
          }}
        >
          No reconciliation contexts loaded. Initialize the store to see data.
        </div>
      ) : (
        contexts.map(ctx => (
          <ContextCard
            key={ctx.id}
            context={ctx}
            pool={getPool(ctx.id)}
            exceptions={exceptions}
          />
        ))
      )}

      {/* ── Audit Trail ── */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16, marginTop: 8, letterSpacing: '0.02em' }}>
        Audit Trail
      </div>
      <AuditTrail events={auditTrail} />

      {/* ── Report Footer ── */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px 0 8px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 11, color: '#374151' }}>
          ReconX — Daily Reconciliation Report — March 15, 2026 — CONFIDENTIAL
        </span>
      </div>
    </div>
  )
}
