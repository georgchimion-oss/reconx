import { useMemo, useState } from 'react'
import { useReconStore } from '../store/reconStore'
import type { BalancePool, ProofStatus, SignOffStatus } from '../data/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function matchRatePct(pool: BalancePool): number {
  if (!pool.totalItems) return 0
  return Math.round((pool.matchedItems / pool.totalItems) * 1000) / 10
}

// ─── Waterfall Bar ───────────────────────────────────────────────────────────

function WaterfallBar({ pool }: { pool: BalancePool }) {
  const total = Math.abs(pool.openingBalance) + Math.abs(pool.totalCredits) + Math.abs(pool.totalDebits)
  if (total === 0) return null

  const openPct = (Math.abs(pool.openingBalance) / total) * 100
  const creditPct = (Math.abs(pool.totalCredits) / total) * 100
  const debitPct = (Math.abs(pool.totalDebits) / total) * 100

  const segments = [
    { label: 'Opening', pct: openPct, color: '#3b82f6' },
    { label: '+ Credits', pct: creditPct, color: '#10b981' },
    { label: '- Debits', pct: debitPct, color: '#ef4444' },
  ]

  return (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>
        Balance Flow
      </div>
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {segments.map(seg => (
          <div
            key={seg.label}
            title={seg.label}
            style={{
              width: `${seg.pct}%`,
              background: seg.color,
              opacity: 0.85,
              transition: 'width 0.5s ease',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
            <span style={{ fontSize: 10, color: '#64748b' }}>{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Proof Badge ─────────────────────────────────────────────────────────────

function ProofBadge({ status, variance }: { status: ProofStatus; variance: number }) {
  const isInProof = status === 'IN_PROOF'
  const isPending = status === 'PENDING'

  const color = isInProof ? '#10b981' : isPending ? '#f59e0b' : '#ef4444'
  const bg = isInProof ? 'rgba(16,185,129,0.12)' : isPending ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
  const label = isInProof ? 'IN PROOF' : isPending ? 'PENDING' : 'OUT OF PROOF'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 8,
        background: bg,
        border: `1px solid ${color}40`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: isInProof ? `0 0 6px ${color}` : 'none',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: '0.06em' }}>{label}</span>
      {!isInProof && variance !== 0 && (
        <span style={{ fontSize: 12, color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(Math.abs(variance))}
        </span>
      )}
    </div>
  )
}

// ─── Sign-off Badge ──────────────────────────────────────────────────────────

function SignOffChip({ status }: { status: SignOffStatus }) {
  const map: Record<SignOffStatus, { color: string; label: string }> = {
    PENDING: { color: '#f59e0b', label: 'Pending Approval' },
    APPROVED: { color: '#10b981', label: 'Approved' },
    REJECTED: { color: '#ef4444', label: 'Rejected' },
  }
  const { color, label } = map[status]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}18`,
        border: `1px solid ${color}35`,
        borderRadius: 6,
        padding: '2px 8px',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

// ─── Balance Row ──────────────────────────────────────────────────────────────

function BalanceRow({
  label,
  value,
  currency,
  isTotal,
  isDivider,
  count,
  color,
  isClosing,
}: {
  label: string
  value?: number
  currency?: string
  isTotal?: boolean
  isDivider?: boolean
  count?: number
  color?: string
  isClosing?: boolean
}) {
  if (isDivider) {
    return (
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 0' }} />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isTotal ? '8px 0' : '4px 0',
      }}
    >
      <span
        style={{
          fontSize: isTotal ? 13 : 12,
          fontWeight: isTotal ? 700 : 400,
          color: isTotal ? '#f1f5f9' : '#94a3b8',
        }}
      >
        {label}
        {count !== undefined && (
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>({count})</span>
        )}
      </span>
      {value !== undefined && (
        <span
          style={{
            fontSize: isTotal ? 14 : 13,
            fontWeight: isTotal ? 700 : 500,
            fontVariantNumeric: 'tabular-nums',
            color: color ?? (value < 0 ? '#ef4444' : isTotal ? '#f1f5f9' : '#cbd5e1'),
            ...(isClosing ? { borderBottom: '3px double rgba(255,255,255,0.2)', paddingBottom: 4 } : {}),
          }}
        >
          {value > 0 && !isTotal ? '+' : ''}{formatCurrency(value, currency)}
        </span>
      )}
    </div>
  )
}

// ─── Workflow Stepper ─────────────────────────────────────────────────────────

function WorkflowStepper({ proofStatus, signOffStatus }: { proofStatus: string; signOffStatus: string }) {
  const steps = [
    { label: 'Reconciled', done: true },
    { label: 'In Proof', done: proofStatus === 'IN_PROOF', active: proofStatus !== 'IN_PROOF' },
    { label: 'Signed Off', done: signOffStatus === 'APPROVED', active: signOffStatus === 'PENDING' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0 16px' }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: step.done ? '#34d399' : step.active ? '#818cf8' : '#334155',
              boxShadow: step.done ? '0 0 6px rgba(52,211,153,0.4)' : step.active ? '0 0 6px rgba(129,140,248,0.4)' : 'none',
              transition: 'all 0.3s',
            }} />
            <span style={{ fontSize: 9, color: step.done ? '#34d399' : step.active ? '#818cf8' : '#475569', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 1, background: step.done ? '#34d399' : 'rgba(255,255,255,0.08)', margin: '0 6px', marginBottom: 16, transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Pool Card ────────────────────────────────────────────────────────────────

interface PoolCardProps {
  pool: BalancePool
  contextName: string
  currency: string
  onApprove: () => void
  onReject: () => void
  canSignOff: boolean
}

function PoolCard({ pool, contextName, currency, onApprove, onReject, canSignOff }: PoolCardProps) {
  const isPending = pool.signOffStatus === 'PENDING'
  const isApproved = pool.signOffStatus === 'APPROVED'
  const matchPct = matchRatePct(pool)
  const [confirmAction, setConfirmAction] = useState<'APPROVE' | 'REJECT' | null>(null)

  const statusColor = pool.proofStatus === 'IN_PROOF'
    ? '#34d399'
    : pool.proofStatus === 'OUT_OF_PROOF'
      ? '#f87171'
      : '#fbbf24'

  return (
    <div
      style={{
        background: 'rgba(26,29,41,0.7)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
        transition: 'border-color 0.3s',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
            {contextName}
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {formatDate(pool.reconDate)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <ProofBadge status={pool.proofStatus} variance={pool.variance} />
          <SignOffChip status={pool.signOffStatus} />
        </div>
      </div>

      {/* Balance waterfall */}
      <div
        style={{
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 16,
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <BalanceRow label="Opening Balance" value={pool.openingBalance} currency={currency} />
        <BalanceRow label="" isDivider />
        <BalanceRow label="Credits" value={pool.totalCredits} currency={currency} color="#10b981" />
        <BalanceRow label="Debits" value={pool.totalDebits} currency={currency} color="#ef4444" />
        <BalanceRow label="" isDivider />
        <BalanceRow label="Calculated Closing" value={pool.calculatedClosing} currency={currency} isTotal />
        <BalanceRow label="Stated Closing" value={pool.statedClosing} currency={currency} isTotal isClosing />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0 4px',
            marginTop: 4,
            borderTop: '2px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Variance</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: pool.variance === 0 ? '#10b981' : '#ef4444',
            }}
          >
            {formatCurrency(pool.variance, currency)}
            {pool.variance === 0 && (
              <span style={{ marginLeft: 8, fontSize: 12 }}>&#10003;</span>
            )}
          </span>
        </div>
      </div>

      {/* Waterfall visual */}
      <WaterfallBar pool={pool} />

      {/* Match stats */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '14px 0',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          marginTop: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Match Rate
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: matchPct >= 95 ? '#10b981' : matchPct >= 80 ? '#f59e0b' : '#ef4444' }}>
            {matchPct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Matched
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
            {pool.matchedItems.toLocaleString()}
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginLeft: 4 }}>
              / {pool.totalItems.toLocaleString()}
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Exceptions
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: pool.exceptionItems > 0 ? '#f59e0b' : '#10b981' }}>
            {pool.exceptionItems.toLocaleString()}
          </div>
        </div>

        {/* Match rate progress bar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Coverage</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{matchPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${matchPct}%`,
                background: matchPct >= 95 ? '#10b981' : matchPct >= 80 ? '#f59e0b' : '#ef4444',
                borderRadius: 3,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Workflow stepper */}
      <WorkflowStepper proofStatus={pool.proofStatus} signOffStatus={pool.signOffStatus} />

      {/* Sign-off section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          marginTop: 4,
        }}
      >
        {isApproved && pool.signedOffBy && pool.signedOffAt ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.2)',
                border: '1px solid rgba(16,185,129,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: '#10b981',
                fontWeight: 700,
              }}
            >
              {pool.signedOffBy.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                Approved by {pool.signedOffBy}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {formatDateTime(pool.signedOffAt)}
              </div>
            </div>
          </div>
        ) : pool.signOffStatus === 'REJECTED' ? (
          <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            Pool rejected — requires review
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Awaiting supervisor sign-off
          </div>
        )}

        {isPending && canSignOff && (
          confirmAction ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: confirmAction === 'APPROVE' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', borderRadius: 6, border: `1px solid ${confirmAction === 'APPROVE' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                {confirmAction === 'APPROVE' ? 'Approve this pool?' : 'Reject this pool?'}
              </span>
              <button onClick={() => { confirmAction === 'APPROVE' ? onApprove() : onReject(); setConfirmAction(null) }} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: confirmAction === 'APPROVE' ? '#34d399' : '#f87171', color: '#0f1117', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Confirm
              </button>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmAction('REJECT')}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#ef4444',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)')}
              >
                Reject
              </button>
              <button
                onClick={() => setConfirmAction('APPROVE')}
                disabled={pool.proofStatus === 'OUT_OF_PROOF'}
                title={pool.proofStatus === 'OUT_OF_PROOF' ? 'Cannot approve — pool is out of proof' : undefined}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: pool.proofStatus === 'OUT_OF_PROOF' ? '#374151' : '#10b981',
                  color: pool.proofStatus === 'OUT_OF_PROOF' ? '#6b7280' : '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: pool.proofStatus === 'OUT_OF_PROOF' ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => {
                  if (pool.proofStatus !== 'OUT_OF_PROOF') (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1'
                }}
              >
                Approve
              </button>
            </div>
          )
        )}

        {isPending && !canSignOff && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 8,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#f59e0b',
              }}
            />
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
              Awaiting supervisor approval
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────

function SummaryStats({ pools }: { pools: BalancePool[] }) {
  const totalPools = pools.length
  const inProof = pools.filter(p => p.proofStatus === 'IN_PROOF').length
  const outOfProof = pools.filter(p => p.proofStatus === 'OUT_OF_PROOF').length
  const approved = pools.filter(p => p.signOffStatus === 'APPROVED').length
  const totalVariance = pools.reduce((sum, p) => sum + Math.abs(p.variance), 0)

  const stats = [
    { label: 'Total Pools', value: totalPools.toString(), color: '#f1f5f9' },
    { label: 'In Proof', value: inProof.toString(), color: '#10b981' },
    { label: 'Out of Proof', value: outOfProof.toString(), color: outOfProof > 0 ? '#ef4444' : '#64748b' },
    { label: 'Approved', value: `${approved}/${totalPools}`, color: '#3b82f6' },
    {
      label: 'Total Variance',
      value: totalVariance === 0 ? '$0.00' : formatCurrency(totalVariance),
      color: totalVariance === 0 ? '#10b981' : '#ef4444',
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: 1,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{
            flex: 1,
            padding: '14px 20px',
            background: 'rgba(26,29,41,0.7)',
            borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            {stat.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BalancePools() {
  const contexts = useReconStore(s => s.contexts)
  const balancePools = useReconStore(s => s.balancePools)
  const activeContextId = useReconStore(s => s.activeContextId)
  const activeRole = useReconStore(s => s.activeRole)
  const setActiveContext = useReconStore(s => s.setActiveContext)
  const approveBalancePool = useReconStore(s => s.approveBalancePool)
  const rejectBalancePool = useReconStore(s => s.rejectBalancePool)

  const canSignOff = activeRole === 'SUPERVISOR'

  const activeContext = useMemo(
    () => contexts.find(c => c.id === activeContextId),
    [contexts, activeContextId]
  )

  const contextPools = useMemo(
    () => balancePools.filter(p => p.contextId === activeContextId),
    [balancePools, activeContextId]
  )

  // Sort: most recent recon date first
  const sortedPools = useMemo(
    () => [...contextPools].sort((a, b) => b.reconDate.localeCompare(a.reconDate)),
    [contextPools]
  )

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh', padding: '24px 28px', color: '#f1f5f9' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Balance Pools</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
          Daily reconciliation sign-off — proof status and supervisor approvals
        </p>
      </div>

      {/* Context selector */}
      <div style={{ marginBottom: 24 }}>
        <select
          value={activeContextId}
          onChange={e => setActiveContext(e.target.value)}
          style={{
            background: 'rgba(26,29,41,0.9)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: '#f1f5f9',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            minWidth: 300,
          }}
        >
          {contexts.map(ctx => (
            <option key={ctx.id} value={ctx.id}>
              {ctx.name}
            </option>
          ))}
        </select>
        {activeContext && (
          <span style={{ marginLeft: 14, fontSize: 13, color: '#64748b' }}>
            {activeContext.type} &mdash; {activeContext.currency} &mdash; Match rate:{' '}
            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{activeContext.matchRate.toFixed(1)}%</span>
          </span>
        )}
      </div>

      {/* Summary stats */}
      {sortedPools.length > 0 && <SummaryStats pools={sortedPools} />}

      {/* Pool cards */}
      {sortedPools.length === 0 ? (
        <div
          style={{
            background: 'rgba(26,29,41,0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            color: '#475569',
            fontSize: 14,
          }}
        >
          No balance pools found for this context.
        </div>
      ) : (
        sortedPools.map(pool => (
          <PoolCard
            key={pool.id}
            pool={pool}
            contextName={pool.name}
            currency={activeContext?.currency ?? 'USD'}
            onApprove={() => approveBalancePool(pool.id)}
            onReject={() => rejectBalancePool(pool.id)}
            canSignOff={canSignOff}
          />
        ))
      )}
    </div>
  )
}
