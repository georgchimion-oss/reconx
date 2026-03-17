import { useState, useMemo } from 'react'
import { useReconStore } from '../store/reconStore'
import type { AuditEvent } from '../data/types'

// ─── Constants ───────────────────────────────────────────────────────────────

type ActionType =
  | 'ALL'
  | 'MANUAL_MATCH'
  | 'MULTI_MATCH'
  | 'WRITE_OFF_REQUESTED'
  | 'CASE_ESCALATED'
  | 'NOTE_ADDED'
  | 'EXCEPTION_ASSIGNED'
  | 'EXCEPTION_RESOLVED'
  | 'CASE_STATUS_UPDATED'
  | 'MATCH_GROUP_BROKEN'

type DateRange = 'TODAY' | 'LAST_7D' | 'LAST_30D' | 'ALL'

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'MANUAL_MATCH', label: 'Manual Match' },
  { value: 'MULTI_MATCH', label: 'Multi Match' },
  { value: 'WRITE_OFF_REQUESTED', label: 'Write-Off Requested' },
  { value: 'CASE_ESCALATED', label: 'Case Escalated' },
  { value: 'NOTE_ADDED', label: 'Note Added' },
  { value: 'EXCEPTION_ASSIGNED', label: 'Exception Assigned' },
  { value: 'EXCEPTION_RESOLVED', label: 'Exception Resolved' },
  { value: 'CASE_STATUS_UPDATED', label: 'Case Status Updated' },
  { value: 'MATCH_GROUP_BROKEN', label: 'Match Group Broken' },
]

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_7D', label: 'Last 7d' },
  { value: 'LAST_30D', label: 'Last 30d' },
  { value: 'ALL', label: 'All Time' },
]

// Action color categories
function getActionColor(action: string): string {
  if (action === 'MANUAL_MATCH' || action === 'MULTI_MATCH' || action === 'EXCEPTION_RESOLVED') return '#10b981'
  if (action === 'WRITE_OFF_REQUESTED') return '#8b5cf6'
  if (action === 'MATCH_GROUP_BROKEN' || action === 'CASE_ESCALATED') return '#ef4444'
  if (action === 'EXCEPTION_ASSIGNED' || action === 'NOTE_ADDED' || action === 'CASE_STATUS_UPDATED') return '#f59e0b'
  return '#64748b'
}

function getActionLabel(action: string): string {
  return ACTION_OPTIONS.find(o => o.value === action)?.label ?? action.replace(/_/g, ' ')
}

// Role-based dot color
function getRoleDotColor(user: string): string {
  if (user === 'Thomas Mueller' || user === 'Evan Richards') return '#3b82f6'   // Supervisor
  if (user === 'Maria Santos' || user === 'David Kim' || user === 'Priya Patel') return '#10b981' // Analyst
  if (user === 'James Auditor' || user === 'Laura Compliance') return '#f59e0b' // Auditor
  if (user === 'AUTO') return '#64748b'
  return '#8b5cf6'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDateGroup(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function isoDateKey(iso: string): string {
  return iso.substring(0, 10)
}

function isToday(iso: string): boolean {
  return isoDateKey(iso) === isoDateKey(new Date().toISOString())
}

function isWithinDays(iso: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(iso).getTime() >= cutoff
}

function getLastNBusinessDays(n: number): string[] {
  const days: string[] = []
  let d = new Date()
  while (days.length < n) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().substring(0, 10))
    }
    d.setDate(d.getDate() - 1)
  }
  return days
}

// ─── Seed Events ─────────────────────────────────────────────────────────────

function buildSeedEvents(): AuditEvent[] {
  const now = new Date('2026-03-15T09:42:00Z')
  const ms = (h: number, m = 0, s = 0) => new Date(now.getTime() - h * 3600000 - m * 60000 - s * 1000).toISOString()

  return [
    {
      id: 'seed-001',
      timestamp: ms(0, 5),
      user: 'Thomas Mueller',
      action: 'EXCEPTION_RESOLVED',
      detail: 'Exception exc-014 marked as resolved — Rate difference reconciled with counterparty confirmation',
      contextId: 'ctx-1',
      itemId: 'item-091',
    },
    {
      id: 'seed-002',
      timestamp: ms(0, 18),
      user: 'Sarah Chen',
      action: 'NOTE_ADDED',
      detail: 'Counterparty JPMorgan confirmed timing difference on SWIFT ref TXN-20260315-0042. Awaiting settlement.',
      contextId: 'ctx-2',
    },
    {
      id: 'seed-003',
      timestamp: ms(0, 42),
      user: 'Thomas Mueller',
      action: 'WRITE_OFF_REQUESTED',
      detail: 'Write-off requested for TXN-20260315-0018 ($1,250.00) — Fee difference below materiality threshold',
      contextId: 'ctx-1',
      itemId: 'item-018',
    },
    {
      id: 'seed-004',
      timestamp: ms(1, 10),
      user: 'Maria Santos',
      action: 'MANUAL_MATCH',
      detail: 'Manual match created: item-055 ↔ item-121 — Timing difference confirmed by ops',
      contextId: 'ctx-2',
      itemId: 'item-055',
      matchGroupId: 'mg-manual-001',
    },
    {
      id: 'seed-005',
      timestamp: ms(1, 33),
      user: 'David Kim',
      action: 'EXCEPTION_ASSIGNED',
      detail: 'Exception reassigned to Maria Santos — High priority break on USD Nostro',
      contextId: 'ctx-1',
    },
    {
      id: 'seed-006',
      timestamp: ms(2, 5),
      user: 'Thomas Mueller',
      action: 'CASE_ESCALATED',
      detail: 'Exception exc-009 escalated to case case-007 — Counterparty error unresolved for 3 days',
      contextId: 'ctx-3',
    },
    {
      id: 'seed-007',
      timestamp: ms(2, 47),
      user: 'Maria Santos',
      action: 'MULTI_MATCH',
      detail: '1:N match created: 1 internal ↔ 3 external — JPMorgan settlement split confirmed',
      contextId: 'ctx-1',
      matchGroupId: 'mg-multi-002',
    },
    {
      id: 'seed-008',
      timestamp: ms(3, 15),
      user: 'Evan Richards',
      action: 'WRITE_OFF_REQUESTED',
      detail: 'Write-off requested for TXN-20260315-0033 ($425.50) — Duplicate fee charge waived by counterparty',
      contextId: 'ctx-2',
      itemId: 'item-033',
    },
    {
      id: 'seed-009',
      timestamp: ms(3, 55),
      user: 'Priya Patel',
      action: 'EXCEPTION_ASSIGNED',
      detail: 'Exception reassigned to David Kim — SLA breach imminent, reassigning to senior analyst',
      contextId: 'ctx-4',
    },
    {
      id: 'seed-010',
      timestamp: ms(4, 22),
      user: 'Thomas Mueller',
      action: 'CASE_STATUS_UPDATED',
      detail: 'Case case-003 status changed to IN_PROGRESS — External team engaged, resolution expected EOD',
      contextId: 'ctx-1',
    },
    {
      id: 'seed-011',
      timestamp: ms(5, 0),
      user: 'David Kim',
      action: 'NOTE_ADDED',
      detail: 'Spoke with Deutsche Bank ops team — they confirmed missing MT940 for 2026-03-14. Resend expected within 2h.',
      contextId: 'ctx-3',
    },
    {
      id: 'seed-012',
      timestamp: ms(5, 38),
      user: 'Maria Santos',
      action: 'MATCH_GROUP_BROKEN',
      detail: 'Match group mg-auto-044 (EXACT) broken apart — Reason: Amount mismatch identified post-confirmation',
      contextId: 'ctx-2',
      matchGroupId: 'mg-auto-044',
    },
    {
      id: 'seed-013',
      timestamp: ms(6, 12),
      user: 'Evan Richards',
      action: 'MANUAL_MATCH',
      detail: 'Manual match created: item-072 ↔ item-188 — Back-value dated entry confirmed with treasury',
      contextId: 'ctx-1',
      itemId: 'item-072',
      matchGroupId: 'mg-manual-003',
    },
    {
      id: 'seed-014',
      timestamp: ms(6, 50),
      user: 'Thomas Mueller',
      action: 'EXCEPTION_RESOLVED',
      detail: 'Exception exc-022 marked as resolved — Missing trade booked by counterparty, items now matched',
      contextId: 'ctx-4',
    },
    {
      id: 'seed-015',
      timestamp: ms(7, 5),
      user: 'Priya Patel',
      action: 'NOTE_ADDED',
      detail: 'FX rate discrepancy on EUR/USD leg — Bloomberg mid-rate 1.0847 vs booked 1.0839. Escalating to treasury.',
      contextId: 'ctx-2',
    },
    // Previous day events (yesterday)
    {
      id: 'seed-016',
      timestamp: ms(20, 30),
      user: 'Thomas Mueller',
      action: 'WRITE_OFF_REQUESTED',
      detail: 'Write-off requested for TXN-20260314-0099 ($875.00) — Stale break from prior period, below threshold',
      contextId: 'ctx-3',
      itemId: 'item-099',
    },
    {
      id: 'seed-017',
      timestamp: ms(21, 15),
      user: 'James Auditor',
      action: 'EXCEPTION_RESOLVED',
      detail: 'Exception exc-007 marked as resolved — Audit sign-off complete for USD Nostro 2026-03-14',
      contextId: 'ctx-1',
    },
    {
      id: 'seed-018',
      timestamp: ms(22, 0),
      user: 'Maria Santos',
      action: 'MULTI_MATCH',
      detail: 'N:N match created: 2 internal ↔ 2 external — Netting arrangement confirmed with Goldman Sachs',
      contextId: 'ctx-4',
      matchGroupId: 'mg-multi-005',
    },
    {
      id: 'seed-019',
      timestamp: ms(23, 45),
      user: 'Evan Richards',
      action: 'CASE_STATUS_UPDATED',
      detail: 'Case case-002 status changed to PENDING_EXTERNAL — Awaiting SWIFT gpi trace from Citibank',
      contextId: 'ctx-2',
    },
    {
      id: 'seed-020',
      timestamp: ms(25, 10),
      user: 'David Kim',
      action: 'CASE_ESCALATED',
      detail: 'Exception exc-031 escalated to case case-012 — Counterparty dispute requires senior review',
      contextId: 'ctx-1',
    },
    {
      id: 'seed-021',
      timestamp: ms(26, 20),
      user: 'Priya Patel',
      action: 'EXCEPTION_ASSIGNED',
      detail: 'Exception reassigned to Evan Richards — Rate difference on GBP Nostro requires FX expertise',
      contextId: 'ctx-3',
    },
    {
      id: 'seed-022',
      timestamp: ms(27, 55),
      user: 'Thomas Mueller',
      action: 'MATCH_GROUP_BROKEN',
      detail: 'Match group mg-auto-031 (TOLERANCE) broken apart — Reason: Tolerance limit exceeded on revaluation',
      contextId: 'ctx-2',
      matchGroupId: 'mg-auto-031',
    },
    // 3 days ago
    {
      id: 'seed-023',
      timestamp: ms(52, 0),
      user: 'Laura Compliance',
      action: 'NOTE_ADDED',
      detail: 'Compliance review completed for write-off batch WO-2026-03-13. All items within policy limits.',
      contextId: 'ctx-1',
    },
    {
      id: 'seed-024',
      timestamp: ms(54, 30),
      user: 'Evan Richards',
      action: 'WRITE_OFF_REQUESTED',
      detail: 'Write-off requested for TXN-20260313-0007 ($2,100.00) — Fee discrepancy confirmed uncollectable',
      contextId: 'ctx-4',
      itemId: 'item-007',
    },
    {
      id: 'seed-025',
      timestamp: ms(56, 15),
      user: 'Thomas Mueller',
      action: 'MANUAL_MATCH',
      detail: 'Manual match created: item-033 ↔ item-199 — Prior period item matched to late booking',
      contextId: 'ctx-3',
      itemId: 'item-033',
      matchGroupId: 'mg-manual-008',
    },
    {
      id: 'seed-026',
      timestamp: ms(58, 45),
      user: 'Maria Santos',
      action: 'EXCEPTION_RESOLVED',
      detail: 'Exception exc-045 marked as resolved — Duplicate payment recovered and reversed by counterparty',
      contextId: 'ctx-2',
    },
    {
      id: 'seed-027',
      timestamp: ms(60, 10),
      user: 'David Kim',
      action: 'CASE_STATUS_UPDATED',
      detail: 'Case case-008 status changed to RESOLVED — Counterparty confirmed error and issued corrected statement',
      contextId: 'ctx-1',
    },
    // 5 days ago
    {
      id: 'seed-028',
      timestamp: ms(110, 0),
      user: 'James Auditor',
      action: 'NOTE_ADDED',
      detail: 'Weekly SoD review: all write-off approvals verified. Requester/approver segregation maintained. No exceptions.',
      contextId: 'ctx-1',
    },
    {
      id: 'seed-029',
      timestamp: ms(113, 30),
      user: 'Evan Richards',
      action: 'MULTI_MATCH',
      detail: 'N:1 match created: 3 internal ↔ 1 external — Aggregated settlement from Deutsche Bank confirmed',
      contextId: 'ctx-3',
      matchGroupId: 'mg-multi-009',
    },
    {
      id: 'seed-030',
      timestamp: ms(116, 45),
      user: 'Thomas Mueller',
      action: 'EXCEPTION_ASSIGNED',
      detail: 'Exception reassigned to Priya Patel — Timing difference on JPY Nostro, Japan desk review needed',
      contextId: 'ctx-4',
    },
  ]
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const inlineSelectStyle: React.CSSProperties = {
  background: 'rgba(15,17,23,0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  color: '#cbd5e1',
  padding: '4px 8px',
  fontSize: 11,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

function StatCard({ label, value, sub, accent = '#3b82f6' }: StatCardProps) {
  return (
    <div
      style={{
        background: 'rgba(20,22,32,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '14px 18px',
        flex: 1,
        minWidth: 140,
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', lineHeight: 1, marginBottom: 3 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Action Badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const color = getActionColor(action)
  const label = getActionLabel(action)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.05em',
        color,
        background: `${color}18`,
        border: `1px solid ${color}35`,
        borderRadius: 4,
        padding: '2px 6px',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  )
}

// ─── User Badge ───────────────────────────────────────────────────────────────

function UserBadge({ user }: { user: string }) {
  const dotColor = getRoleDotColor(user)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        color: '#94a3b8',
        whiteSpace: 'nowrap',
        minWidth: 120,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: `0 0 4px ${dotColor}80`,
        }}
      />
      {user}
    </span>
  )
}

// ─── Context Pill ─────────────────────────────────────────────────────────────

function ContextPill({ id }: { id: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: 'monospace',
        color: '#64748b',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 4,
        padding: '1px 5px',
        whiteSpace: 'nowrap',
      }}
    >
      {id}
    </span>
  )
}

// ─── Timeline Event Row ───────────────────────────────────────────────────────

interface TimelineRowProps {
  event: AuditEvent
  isLast: boolean
}

function TimelineRow({ event, isLast }: TimelineRowProps) {
  const color = getActionColor(event.action)

  return (
    <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
      {/* Left timeline track */}
      <div
        style={{
          width: 32,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            border: `2px solid #0f1117`,
            boxShadow: `0 0 6px ${color}60`,
            marginTop: 10,
            flexShrink: 0,
            zIndex: 1,
          }}
        />
        {/* connecting line */}
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 2,
              background: 'rgba(255,255,255,0.06)',
              marginTop: 2,
              minHeight: 16,
            }}
          />
        )}
      </div>

      {/* Event content */}
      <div
        style={{
          flex: 1,
          padding: '8px 10px 8px 4px',
          borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
        }}
      >
        {/* Row 1: timestamp + user + action + context */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: '#475569',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}
          >
            {formatTimestamp(event.timestamp)}
          </span>
          <UserBadge user={event.user} />
          <ActionBadge action={event.action} />
          {event.contextId && <ContextPill id={event.contextId} />}
          {event.matchGroupId && <ContextPill id={event.matchGroupId} />}
          {event.itemId && <ContextPill id={event.itemId} />}
        </div>

        {/* Row 2: detail text */}
        <div
          style={{
            fontSize: 11,
            color: '#94a3b8',
            lineHeight: 1.5,
          }}
        >
          {event.detail}
        </div>
      </div>
    </div>
  )
}

// ─── SOX Section ─────────────────────────────────────────────────────────────

interface SoxSectionProps {
  writeOffs: ReturnType<typeof useReconStore.getState>['writeOffs']
  balancePools: ReturnType<typeof useReconStore.getState>['balancePools']
  contexts: ReturnType<typeof useReconStore.getState>['contexts']
}

function SoxSection({ writeOffs, balancePools, contexts }: SoxSectionProps) {
  const lastFiveBizDays = useMemo(() => getLastNBusinessDays(5), [])

  // Segregation of Duties — check write-offs where requester === approver
  const sodViolations = useMemo(
    () => writeOffs.filter(wo => wo.approvedBy && wo.requestedBy === wo.approvedBy),
    [writeOffs]
  )

  // Pending write-offs (no approver yet)
  const pendingWriteOffs = writeOffs.filter(wo => wo.status === 'PENDING')

  // Sign-off status per context per business day
  const signOffGrid = useMemo(() => {
    return contexts.map(ctx => {
      const days = lastFiveBizDays.map(date => {
        const pool = balancePools.find(bp => bp.contextId === ctx.id && bp.reconDate === date)
        return {
          date,
          status: pool?.signOffStatus ?? null,
          signedBy: pool?.signedOffBy ?? null,
        }
      })
      return { context: ctx, days }
    })
  }, [contexts, balancePools, lastFiveBizDays])

  // Missing sign-offs count
  const missingSigoffs = signOffGrid.reduce((acc, row) => {
    return acc + row.days.filter(d => !d.status || d.status === 'PENDING').length
  }, 0)

  const signOffStatusColor = (status: string | null) => {
    if (status === 'APPROVED') return '#10b981'
    if (status === 'REJECTED') return '#ef4444'
    return '#f59e0b'
  }

  const signOffStatusLabel = (status: string | null) => {
    if (status === 'APPROVED') return 'SIGNED'
    if (status === 'REJECTED') return 'REJECTED'
    return 'MISSING'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
      {/* SOX Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>
            SOX Compliance
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>
            Segregation of duties, sign-off status, write-off approval chains
          </div>
        </div>
        {missingSigoffs > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#ef4444',
              background: '#ef444418',
              border: '1px solid #ef444440',
              borderRadius: 5,
              padding: '3px 10px',
            }}
          >
            {missingSigoffs} missing sign-offs
          </span>
        )}
        {missingSigoffs === 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#10b981',
              background: '#10b98118',
              border: '1px solid #10b98140',
              borderRadius: 5,
              padding: '3px 10px',
            }}
          >
            All contexts signed
          </span>
        )}
      </div>

      {/* SoD Check */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '14px 16px',
          borderLeft: `3px solid ${sodViolations.length > 0 ? '#ef4444' : '#10b981'}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
          Segregation of Duties Check
        </div>
        {sodViolations.length === 0 ? (
          <div style={{ fontSize: 10, color: '#10b981' }}>
            No violations — all write-off requesters and approvers are distinct.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sodViolations.map(wo => (
              <div
                key={wo.id}
                style={{
                  fontSize: 10,
                  color: '#fca5a5',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#ef4444', fontWeight: 700 }}>VIOLATION</span>
                <span>{wo.id}</span>
                <span style={{ color: '#64748b' }}>—</span>
                <span>
                  {wo.requestedBy} requested and approved the same write-off (${wo.amount.toLocaleString()})
                </span>
              </div>
            ))}
          </div>
        )}
        {pendingWriteOffs.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#f59e0b' }}>
            {pendingWriteOffs.length} write-off{pendingWriteOffs.length !== 1 ? 's' : ''} pending approval
          </div>
        )}
      </div>

      {/* Sign-Off Grid */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '14px 16px',
          overflowX: 'auto',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 12 }}>
          Sign-Off Status — Last 5 Business Days
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  fontSize: 9,
                  color: '#475569',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 8px 8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                Context
              </th>
              {lastFiveBizDays.map(d => (
                <th
                  key={d}
                  style={{
                    textAlign: 'center',
                    fontSize: 9,
                    color: '#475569',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '4px 8px 8px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signOffGrid.map(row => (
              <tr key={row.context.id}>
                <td
                  style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    padding: '6px 8px 6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    whiteSpace: 'nowrap',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.context.name}
                </td>
                {row.days.map(day => {
                  const color = signOffStatusColor(day.status)
                  const label = signOffStatusLabel(day.status)
                  return (
                    <td
                      key={day.date}
                      style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <span
                        title={day.signedBy ? `Signed by ${day.signedBy}` : 'Not signed off'}
                        style={{
                          display: 'inline-block',
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color,
                          background: `${color}18`,
                          border: `1px solid ${color}35`,
                          borderRadius: 3,
                          padding: '2px 5px',
                        }}
                      >
                        {label}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            {signOffGrid.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#475569', fontSize: 10, padding: 16 }}>
                  No contexts loaded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Write-Off Approval Chain */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '14px 16px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 12 }}>
          Write-Off Approval Chain
        </div>

        {writeOffs.length === 0 && (
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', padding: '8px 0' }}>
            No write-off requests in system
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {writeOffs.map(wo => {
            const statusColor =
              wo.status === 'APPROVED' ? '#10b981' :
              wo.status === 'REJECTED' ? '#ef4444' :
              '#f59e0b'
            const isSodRisk = wo.approvedBy && wo.requestedBy === wo.approvedBy
            return (
              <div
                key={wo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  background: isSodRisk ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isSodRisk ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 5,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#475569', minWidth: 90 }}>
                  {wo.id}
                </span>
                <span style={{ fontSize: 10, color: '#8b5cf6' }}>
                  ${wo.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  Requested by
                </span>
                <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500 }}>
                  {wo.requestedBy}
                </span>
                <span style={{ fontSize: 14, color: '#334155' }}>→</span>
                {wo.approvedBy ? (
                  <>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Approved by</span>
                    <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500 }}>
                      {wo.approvedBy}
                    </span>
                    {isSodRisk && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#ef4444',
                          background: '#ef444418',
                          border: '1px solid #ef444440',
                          borderRadius: 3,
                          padding: '1px 5px',
                        }}
                      >
                        SoD VIOLATION
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: '#f59e0b' }}>Pending approval</span>
                )}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    fontWeight: 700,
                    color: statusColor,
                    background: `${statusColor}15`,
                    border: `1px solid ${statusColor}30`,
                    borderRadius: 3,
                    padding: '1px 6px',
                  }}
                >
                  {wo.status}
                </span>
              </div>
            )
          })}
        </div>

        {/* Seed write-offs if none loaded — show sample chain */}
        {writeOffs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {[
              { id: 'wo-seed-001', amount: 1250, requestedBy: 'Sarah Chen', approvedBy: 'Thomas Mueller', status: 'APPROVED' },
              { id: 'wo-seed-002', amount: 425.5, requestedBy: 'Evan Richards', approvedBy: null, status: 'PENDING' },
              { id: 'wo-seed-003', amount: 875, requestedBy: 'Maria Santos', approvedBy: 'Thomas Mueller', status: 'APPROVED' },
              { id: 'wo-seed-004', amount: 2100, requestedBy: 'David Kim', approvedBy: 'Evan Richards', status: 'APPROVED' },
            ].map(wo => (
              <div
                key={wo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 5,
                }}
              >
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#475569', minWidth: 90 }}>{wo.id}</span>
                <span style={{ fontSize: 10, color: '#8b5cf6' }}>${wo.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>Requested by</span>
                <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500 }}>{wo.requestedBy}</span>
                <span style={{ fontSize: 14, color: '#334155' }}>→</span>
                {wo.approvedBy ? (
                  <>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Approved by</span>
                    <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 500 }}>{wo.approvedBy}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: '#f59e0b' }}>Pending approval</span>
                )}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    fontWeight: 700,
                    color: wo.status === 'APPROVED' ? '#10b981' : '#f59e0b',
                    background: wo.status === 'APPROVED' ? '#10b98115' : '#f59e0b15',
                    border: `1px solid ${wo.status === 'APPROVED' ? '#10b98130' : '#f59e0b30'}`,
                    borderRadius: 3,
                    padding: '1px 6px',
                  }}
                >
                  {wo.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AuditTrail() {
  const { auditTrail, contexts, balancePools, writeOffs, activeRole } = useReconStore()

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<ActionType>('ALL')
  const [userFilter, setUserFilter] = useState('ALL')
  const [dateRange, setDateRange] = useState<DateRange>('ALL')

  // Merge store events with seed events if store is sparse
  const allEvents = useMemo<AuditEvent[]>(() => {
    const seed = buildSeedEvents()
    if (auditTrail.length === 0) return seed
    // Deduplicate by id — prefer store events
    const merged = new Map<string, AuditEvent>()
    seed.forEach(e => merged.set(e.id, e))
    auditTrail.forEach(e => merged.set(e.id, e))
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [auditTrail])

  // All distinct users
  const allUsers = useMemo(() => {
    const s = new Set<string>()
    allEvents.forEach(e => s.add(e.user))
    return Array.from(s).sort()
  }, [allEvents])

  // Header stats
  const stats = useMemo(() => {
    const total = allEvents.length
    const today = allEvents.filter(e => isToday(e.timestamp)).length
    const uniqueUsers = new Set(allEvents.map(e => e.user)).size
    const actionCounts = new Map<string, number>()
    allEvents.forEach(e => actionCounts.set(e.action, (actionCounts.get(e.action) ?? 0) + 1))
    let topAction = ''
    let topCount = 0
    actionCounts.forEach((count, action) => {
      if (count > topCount) { topAction = action; topCount = count }
    })
    return { total, today, uniqueUsers, topAction: getActionLabel(topAction), topCount }
  }, [allEvents])

  // Filtered events
  const filteredEvents = useMemo(() => {
    let result = allEvents

    // Date range filter
    if (dateRange === 'TODAY') result = result.filter(e => isToday(e.timestamp))
    else if (dateRange === 'LAST_7D') result = result.filter(e => isWithinDays(e.timestamp, 7))
    else if (dateRange === 'LAST_30D') result = result.filter(e => isWithinDays(e.timestamp, 30))

    // Action filter
    if (actionFilter !== 'ALL') result = result.filter(e => e.action === actionFilter)

    // User filter
    if (userFilter !== 'ALL') result = result.filter(e => e.user === userFilter)

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        e =>
          e.action.toLowerCase().includes(q) ||
          e.detail.toLowerCase().includes(q) ||
          e.user.toLowerCase().includes(q) ||
          (e.contextId?.toLowerCase().includes(q) ?? false) ||
          (e.itemId?.toLowerCase().includes(q) ?? false) ||
          (e.matchGroupId?.toLowerCase().includes(q) ?? false)
      )
    }

    return result
  }, [allEvents, dateRange, actionFilter, userFilter, search])

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, AuditEvent[]>()
    filteredEvents.forEach(e => {
      const key = isoDateKey(e.timestamp)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    })
    // Return as sorted array of [dateKey, events[]]
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredEvents])

  return (
    <div
      style={{
        background: '#0f1117',
        minHeight: '100vh',
        padding: '20px 24px 48px',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#f1f5f9',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1 }}>
            Audit Trail &amp; Compliance
          </h1>
          <p style={{ fontSize: 10, color: '#475569', margin: '6px 0 0' }}>
            Complete event log — every action taken in the reconciliation system
            &nbsp;&nbsp;
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: activeRole === 'AUDITOR' ? '#f59e0b' : activeRole === 'SUPERVISOR' ? '#3b82f6' : '#10b981',
                background: activeRole === 'AUDITOR' ? '#f59e0b15' : activeRole === 'SUPERVISOR' ? '#3b82f615' : '#10b98115',
                border: `1px solid ${activeRole === 'AUDITOR' ? '#f59e0b30' : activeRole === 'SUPERVISOR' ? '#3b82f630' : '#10b98130'}`,
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {activeRole}
            </span>
          </p>
        </div>

        <button
          onClick={() => window.print()}
          aria-label="Export audit trail"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 6,
            color: '#06B6D4',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.03em',
          }}
        >
          <span>&#x1F4C4;</span>
          Export / Print
        </button>
      </div>

      {/* Header Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Events"
          value={stats.total.toLocaleString()}
          sub="all time in system"
          accent="#3b82f6"
        />
        <StatCard
          label="Events Today"
          value={stats.today.toLocaleString()}
          sub={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          accent="#10b981"
        />
        <StatCard
          label="Unique Users"
          value={stats.uniqueUsers}
          sub="distinct actors"
          accent="#8b5cf6"
        />
        <StatCard
          label="Most Common Action"
          value={stats.topAction}
          sub={`${stats.topCount} occurrences`}
          accent="#f59e0b"
        />
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search action, detail, user, ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search audit events"
          style={{
            ...inlineSelectStyle,
            flex: '1 1 220px',
            minWidth: 180,
            padding: '5px 10px',
          }}
        />

        {/* Action type */}
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value as ActionType)}
          aria-label="Filter by action type"
          style={{ ...inlineSelectStyle, minWidth: 160 }}
        >
          {ACTION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* User */}
        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          aria-label="Filter by user"
          style={{ ...inlineSelectStyle, minWidth: 140 }}
        >
          <option value="ALL">All Users</option>
          {allUsers.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', gap: 4 }}>
          {DATE_RANGE_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setDateRange(o.value)}
              aria-pressed={dateRange === o.value}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: `1px solid ${dateRange === o.value ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: dateRange === o.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: dateRange === o.value ? '#06B6D4' : '#64748b',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.1s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Result count */}
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Event Timeline */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '16px 16px 8px',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 14 }}>
          Event Timeline
        </div>

        {filteredEvents.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#475569',
              fontSize: 11,
              padding: '32px 0',
            }}
          >
            No events match current filters
          </div>
        )}

        {groupedEvents.map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            {/* Date divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '12px 0 8px',
              }}
            >
              <div style={{ height: 1, flex: 0, width: 32 }} />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#334155',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  background: 'rgba(20,22,32,0.85)',
                  padding: '0 6px',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {formatDateGroup(dateKey + 'T12:00:00Z')}
                {isToday(dateKey + 'T12:00:00Z') && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 8,
                      color: '#10b981',
                      background: '#10b98118',
                      border: '1px solid #10b98130',
                      borderRadius: 3,
                      padding: '0 4px',
                    }}
                  >
                    TODAY
                  </span>
                )}
                &nbsp;
                <span style={{ color: '#1e293b' }}>
                  ({dayEvents.length})
                </span>
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(255,255,255,0.05)',
                }}
              />
            </div>

            {/* Events for this day */}
            {dayEvents.map((event, idx) => (
              <TimelineRow
                key={event.id}
                event={event}
                isLast={idx === dayEvents.length - 1}
              />
            ))}
          </div>
        ))}
      </div>

      {/* SOX Compliance Section */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '16px',
        }}
      >
        <SoxSection
          writeOffs={writeOffs}
          balancePools={balancePools}
          contexts={contexts}
        />
      </div>
    </div>
  )
}
