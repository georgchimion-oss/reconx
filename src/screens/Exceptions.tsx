import { useState, useMemo } from 'react'
import { useReconStore } from '../store/reconStore'
import type { Exception, WriteOffRequest, ReasonCode, Case, CaseStatus } from '../data/types'

// ─── Constants ───────────────────────────────────────────────────────────────

type Priority = Exception['priority']
type PriorityFilter = Priority | 'ALL'

const PRIORITY_TABS: { key: PriorityFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: '#f87171',
  HIGH: '#fb923c',
  MEDIUM: '#fbbf24',
  LOW: '#94a3b8',
}

const REASON_CODE_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'TIMING', label: 'Timing' },
  { value: 'MISSING_TRADE', label: 'Missing Trade' },
  { value: 'RATE_DIFFERENCE', label: 'Rate Difference' },
  { value: 'COUNTERPARTY_ERROR', label: 'Counterparty Error' },
  { value: 'FEE_DIFFERENCE', label: 'Fee Difference' },
  { value: 'DUPLICATE', label: 'Duplicate' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const CASE_STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_EXTERNAL', label: 'Pending External' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  OPEN: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  PENDING_EXTERNAL: '#8b5cf6',
  ESCALATED: '#ef4444',
  RESOLVED: '#10b981',
  CLOSED: '#64748b',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function getSlaRemaining(deadline: string): { label: string; isBreached: boolean; hoursLeft: number } {
  const now = Date.now()
  const end = new Date(deadline).getTime()
  const diffMs = end - now
  const hoursLeft = diffMs / (1000 * 60 * 60)

  if (diffMs <= 0) return { label: 'BREACHED', isBreached: true, hoursLeft }

  const h = Math.floor(Math.abs(hoursLeft))
  const m = Math.floor((Math.abs(hoursLeft) - h) * 60)

  if (h >= 24) {
    return { label: `${Math.floor(h / 24)}d ${h % 24}h`, isBreached: false, hoursLeft }
  }
  return { label: `${h}h ${m}m`, isBreached: false, hoursLeft }
}

function reasonCodeLabel(code: ReasonCode): string {
  return REASON_CODE_OPTIONS.find(o => o.value === code)?.label ?? code
}

// ─── Inline dropdown style ────────────────────────────────────────────────────

const inlineSelectStyle: React.CSSProperties = {
  background: 'rgba(15,17,23,0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  color: '#cbd5e1',
  padding: '3px 6px',
  fontSize: 11,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
}

// ─── SLA Badge ────────────────────────────────────────────────────────────────

function SlaBadge({ deadline, slaBreach }: { deadline: string; slaBreach: boolean }) {
  const { label, isBreached, hoursLeft } = getSlaRemaining(deadline)
  const breached = isBreached || slaBreach
  const urgent = !breached && hoursLeft < 4

  const color = breached ? '#ef4444' : urgent ? '#f59e0b' : '#10b981'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 5,
        padding: '2px 7px',
        letterSpacing: '0.03em',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {breached && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ef4444',
            display: 'inline-block',
            animation: 'sla-pulse 1s infinite',
            flexShrink: 0,
          }}
        />
      )}
      {breached ? 'BREACHED' : label}
    </span>
  )
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority]
  const isCritical = priority === 'CRITICAL'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 5,
        padding: '2px 7px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: 0,
          animation: isCritical ? 'sla-pulse 1.5s infinite' : 'none',
        }}
      />
      {priority}
    </span>
  )
}

// ─── Action Icon Button ───────────────────────────────────────────────────────

interface ActionBtnProps {
  label: string
  icon: string
  color: string
  onClick: () => void
  active?: boolean
}

function ActionBtn({ label, icon, color, onClick, active }: ActionBtnProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      title={label}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 5,
        border: `1px solid ${active || hovered ? color + '60' : 'rgba(255,255,255,0.08)'}`,
        background: active || hovered ? `${color}18` : 'rgba(255,255,255,0.03)',
        color: active || hovered ? color : '#64748b',
        cursor: 'pointer',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.12s',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
  )
}

// ─── Exception Card ───────────────────────────────────────────────────────────

interface ExceptionCardProps {
  exception: Exception
  team: { id: string; name: string }[]
  isSupervisor: boolean
  writeOffFormId: string | null
  escalatedIds: Set<string>
  onAssignReasonCode: (code: ReasonCode) => void
  onRequestWriteOff: () => void
  onCancelWriteOff: () => void
  onSubmitWriteOff: (comments: string) => void
  onEscalate: () => void
  onAddNote: (note: string) => void
  onAssign: (analystName: string) => void
  onResolve: () => void
}

function ExceptionCard({
  exception,
  team,
  isSupervisor,
  writeOffFormId,
  escalatedIds,
  onAssignReasonCode,
  onRequestWriteOff,
  onCancelWriteOff,
  onSubmitWriteOff,
  onEscalate,
  onAddNote,
  onAssign,
  onResolve,
}: ExceptionCardProps) {
  const { item } = exception
  const [noteText, setNoteText] = useState('')
  const [writeOffComments, setWriteOffComments] = useState('')

  const showWriteOffForm = writeOffFormId === exception.id
  const showEscalatedMsg = escalatedIds.has(exception.id)
  const isNegative = item.amount < 0

  // Show the last 3 notes, most recent first
  const recentNotes = [...exception.notes].reverse().slice(0, 3)

  const priorityColor = PRIORITY_COLORS[exception.priority]
  const isCritical = exception.priority === 'CRITICAL'

  return (
    <div
      style={{
        background: 'rgba(20,22,32,0.85)',
        border: `1px solid ${isCritical ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.07)'}`,
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      {/* ── Row 1: Reference | Amount | Priority | SLA | Age ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap',
        }}
      >
        {/* Reference */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#3b82f6',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}
        >
          {item.reference}
        </span>

        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>|</span>

        {/* Description (truncated) */}
        <span
          style={{
            fontSize: 11,
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {item.description}
        </span>

        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>|</span>

        {/* Amount */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: isNegative ? '#f87171' : '#f1f5f9',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {formatCurrency(item.amount, item.currency)}
        </span>

        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>|</span>

        {/* Priority badge */}
        <PriorityBadge priority={exception.priority} />

        {/* SLA badge */}
        <SlaBadge deadline={exception.slaDeadline} slaBreach={exception.slaBreach} />

        {/* Age */}
        <span
          style={{
            fontSize: 10,
            color: item.age > 5 ? '#f59e0b' : '#475569',
            fontWeight: item.age > 5 ? 700 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {item.age}d old
        </span>

        {/* Escalated confirmation pill */}
        {showEscalatedMsg && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#10b981',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 5,
              padding: '2px 8px',
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            Case created
          </span>
        )}
      </div>

      {/* ── Row 2: Reason Code | Assigned To ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>Reason:</span>
        <select
          value={exception.reasonCode}
          onChange={e => onAssignReasonCode(e.target.value as ReasonCode)}
          style={inlineSelectStyle}
        >
          {REASON_CODE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 10 }}>|</span>

        <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>Assigned:</span>
        <select
          value={exception.assignedTo}
          onChange={e => onAssign(e.target.value)}
          style={inlineSelectStyle}
        >
          {team.map(member => (
            <option key={member.id} value={member.name}>{member.name}</option>
          ))}
        </select>

        {/* Action buttons — always visible, pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ActionBtn
            label="Write-Off Request"
            icon="$"
            color="#8b5cf6"
            onClick={onRequestWriteOff}
            active={showWriteOffForm}
          />
          <ActionBtn
            label="Escalate to Case"
            icon="↑"
            color="#ef4444"
            onClick={onEscalate}
          />
          {isSupervisor && (
            <ActionBtn
              label="Mark Resolved"
              icon="✓"
              color="#10b981"
              onClick={onResolve}
            />
          )}
        </div>
      </div>

      {/* ── Row 3: Notes always visible + Add note input ── */}
      <div
        style={{
          padding: '7px 12px 8px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        {/* Notes column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Label */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 5,
            }}
          >
            Notes
            {exception.notes.length > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  background: 'rgba(59,130,246,0.15)',
                  color: '#3b82f6',
                  borderRadius: 10,
                  padding: '0px 5px',
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {exception.notes.length}
              </span>
            )}
          </div>

          {/* Recent notes list */}
          {recentNotes.length === 0 ? (
            <div style={{ fontSize: 11, color: '#334155', fontStyle: 'italic', marginBottom: 5 }}>
              No notes yet — add one below.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 5 }}>
              {recentNotes.map((note, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    lineHeight: 1.4,
                  }}
                >
                  {note}
                </div>
              ))}
              {exception.notes.length > 3 && (
                <div style={{ fontSize: 10, color: '#334155', padding: '1px 8px' }}>
                  +{exception.notes.length - 3} more note{exception.notes.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Add note — always visible input */}
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && noteText.trim()) {
                  onAddNote(noteText.trim())
                  setNoteText('')
                }
              }}
              placeholder="Add note... (Enter to save)"
              style={{
                flex: 1,
                background: 'rgba(15,17,23,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5,
                color: '#f1f5f9',
                padding: '4px 8px',
                fontSize: 11,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => {
                if (noteText.trim()) {
                  onAddNote(noteText.trim())
                  setNoteText('')
                }
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Write-Off inline form (below card, when open) ── */}
      {showWriteOffForm && (
        <div
          style={{
            borderTop: '1px solid rgba(139,92,246,0.2)',
            background: 'rgba(139,92,246,0.05)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>
            Write-Off Request — {item.reference} ({formatCurrency(item.amount, item.currency)})
          </div>
          <textarea
            value={writeOffComments}
            onChange={e => setWriteOffComments(e.target.value)}
            placeholder="Reason for write-off..."
            rows={2}
            style={{
              background: 'rgba(10,12,20,0.8)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 5,
              color: '#f1f5f9',
              padding: '6px 8px',
              fontSize: 11,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                onSubmitWriteOff(writeOffComments)
                setWriteOffComments('')
              }}
              style={{
                padding: '4px 14px',
                borderRadius: 5,
                border: 'none',
                background: '#8b5cf6',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Submit
            </button>
            <button
              onClick={() => {
                onCancelWriteOff()
                setWriteOffComments('')
              }}
              style={{
                padding: '4px 14px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#64748b',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Write-Off Queue ──────────────────────────────────────────────────────────

function WriteOffQueue({
  writeOffs,
  isSupervisor,
  onApprove,
  onReject,
}: {
  writeOffs: WriteOffRequest[]
  isSupervisor: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  if (writeOffs.length === 0) return null

  const pending = writeOffs.filter(wo => wo.status === 'PENDING')
  const resolved = writeOffs.filter(wo => wo.status !== 'PENDING')

  return (
    <div
      style={{
        background: 'rgba(26,29,41,0.7)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(139,92,246,0.06)',
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Write-Off Queue</span>
        {pending.length > 0 && (
          <span
            style={{
              background: 'rgba(139,92,246,0.25)',
              color: '#8b5cf6',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {pending.length} pending
          </span>
        )}
        {!isSupervisor && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569', fontStyle: 'italic' }}>
            Supervisor access required to approve
          </span>
        )}
      </div>

      {/* Pending write-offs */}
      {pending.length > 0 && (
        <div style={{ padding: '10px 16px' }}>
          <div
            style={{
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Pending Approval
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(wo => (
              <div
                key={wo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '9px 12px',
                  background: 'rgba(139,92,246,0.05)',
                  border: '1px solid rgba(139,92,246,0.14)',
                  borderRadius: 7,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</div>
                    <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>
                      {wo.item?.reference ?? wo.itemId}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div>
                    <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(wo.amount, wo.item?.currency)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</div>
                    <div style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
                      {reasonCodeLabel(wo.reasonCode)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requested By</div>
                    <div style={{ fontSize: 11, color: '#f1f5f9' }}>{wo.requestedBy}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(wo.requestedAt)}</div>
                  </div>
                  {wo.comments && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{wo.comments}</div>
                    </div>
                  )}
                </div>

                {isSupervisor && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => onReject(wo.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 5,
                        border: '1px solid rgba(239,68,68,0.35)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#ef4444',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApprove(wo.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 5,
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved write-offs */}
      {resolved.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: pending.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Resolved
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {resolved.map(wo => {
              const isApproved = wo.status === 'APPROVED'
              const color = isApproved ? '#10b981' : '#ef4444'
              return (
                <div
                  key={wo.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '7px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${color}18`,
                    borderRadius: 6,
                    opacity: 0.75,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {wo.item?.reference ?? wo.itemId}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(wo.amount, wo.item?.currency)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color }}>{wo.status}</span>
                  {wo.approvedBy && (
                    <span style={{ fontSize: 10, color: '#475569' }}>
                      by {wo.approvedBy}
                      {wo.approvedAt ? ` · ${formatDate(wo.approvedAt)}` : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cases Section ────────────────────────────────────────────────────────────

function CasesSection({
  cases,
  onUpdateStatus,
}: {
  cases: Case[]
  onUpdateStatus: (caseId: string, status: CaseStatus) => void
}) {
  if (cases.length === 0) return null

  return (
    <div
      style={{
        marginTop: 20,
      }}
    >
      {/* Divider with label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'rgba(59,130,246,0.2)' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 12px',
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 20,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>Cases</span>
          <span
            style={{
              background: 'rgba(59,130,246,0.2)',
              color: '#3b82f6',
              borderRadius: 10,
              padding: '0 5px',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {cases.length}
          </span>
        </div>
        <div style={{ flex: 1, height: 1, background: 'rgba(59,130,246,0.2)' }} />
      </div>

      {/* Cases list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cases.map(c => {
          const statusColor = CASE_STATUS_COLORS[c.status]
          const priorityColor = PRIORITY_COLORS[c.priority as Priority]
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                background: 'rgba(20,22,32,0.85)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: `3px solid ${statusColor}`,
                borderRadius: 7,
                flexWrap: 'wrap',
              }}
            >
              {/* Case ID */}
              <div style={{ minWidth: 110 }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Case ID</div>
                <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace', fontWeight: 700 }}>{c.id}</div>
              </div>

              {/* Status dropdown */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Status</div>
                <select
                  value={c.status}
                  onChange={e => onUpdateStatus(c.id, e.target.value as CaseStatus)}
                  style={{
                    ...inlineSelectStyle,
                    color: statusColor,
                    borderColor: `${statusColor}30`,
                    background: `${statusColor}0d`,
                  }}
                >
                  {CASE_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Priority</div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: priorityColor,
                    background: `${priorityColor}15`,
                    border: `1px solid ${priorityColor}25`,
                    borderRadius: 4,
                    padding: '1px 6px',
                  }}
                >
                  {c.priority}
                </span>
              </div>

              {/* Item Reference */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Item Ref</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{c.item.reference}</div>
              </div>

              {/* Amount */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Amount</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(c.amount, c.item.currency)}
                </div>
              </div>

              {/* Created */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Created</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(c.createdAt)}</div>
              </div>

              {/* Assigned To */}
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Assigned</div>
                <div style={{ fontSize: 11, color: '#f1f5f9' }}>{c.assignedTo || '—'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function ExceptionSummary({ exceptions, writeOffs }: { exceptions: Exception[]; writeOffs: WriteOffRequest[] }) {
  const total = exceptions.length
  const breached = exceptions.filter(e => e.slaBreach).length
  const avgAge = total > 0
    ? (exceptions.reduce((sum, e) => sum + e.item.age, 0) / total).toFixed(1)
    : '—'
  const wosPending = writeOffs.filter(w => w.status === 'PENDING').length

  const stats = [
    {
      label: 'Total Exceptions',
      value: total.toString(),
      color: total > 0 ? '#f59e0b' : '#10b981',
      subtext: `${exceptions.filter(e => e.priority === 'CRITICAL').length} critical`,
    },
    {
      label: 'Breached SLAs',
      value: breached.toString(),
      color: breached > 0 ? '#ef4444' : '#10b981',
      subtext: breached > 0 ? 'Immediate action required' : 'All within SLA',
    },
    {
      label: 'Avg Item Age',
      value: `${avgAge}d`,
      color: parseFloat(avgAge) > 5 ? '#f59e0b' : '#10b981',
      subtext: 'Days outstanding',
    },
    {
      label: 'Write-Offs Pending',
      value: wosPending.toString(),
      color: wosPending > 0 ? '#8b5cf6' : '#64748b',
      subtext: 'Awaiting supervisor',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 18,
      }}
    >
      {stats.map(stat => (
        <div
          key={stat.label}
          style={{
            background: 'rgba(26,29,41,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 9,
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            {stat.label}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: stat.color,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {stat.value}
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 5 }}>{stat.subtext}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Exceptions() {
  const contexts = useReconStore(s => s.contexts)
  const exceptions = useReconStore(s => s.exceptions)
  const writeOffs = useReconStore(s => s.writeOffs)
  const cases = useReconStore(s => s.cases)
  const team = useReconStore(s => s.team)
  const activeContextId = useReconStore(s => s.activeContextId)
  const activeRole = useReconStore(s => s.activeRole)
  const setActiveContext = useReconStore(s => s.setActiveContext)
  const assignReasonCode = useReconStore(s => s.assignReasonCode)
  const approveWriteOff = useReconStore(s => s.approveWriteOff)
  const rejectWriteOff = useReconStore(s => s.rejectWriteOff)
  const createWriteOffRequest = useReconStore(s => s.createWriteOffRequest)
  const escalateToCase = useReconStore(s => s.escalateToCase)
  const addNote = useReconStore(s => s.addNote)
  const assignException = useReconStore(s => s.assignException)
  const resolveException = useReconStore(s => s.resolveException)
  const updateCaseStatus = useReconStore(s => s.updateCaseStatus)

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL')
  // Track which exception has the write-off form open
  const [writeOffFormId, setWriteOffFormId] = useState<string | null>(null)
  // Track which exceptions just had a case created (for 2-second confirmation)
  const [escalatedIds, setEscalatedIds] = useState<Set<string>>(new Set())

  const isSupervisor = activeRole === 'SUPERVISOR'

  const contextExceptions = useMemo(
    () => exceptions.filter(e => e.contextId === activeContextId),
    [exceptions, activeContextId]
  )

  const contextWriteOffs = useMemo(
    () => writeOffs.filter(w => w.contextId === activeContextId),
    [writeOffs, activeContextId]
  )

  const contextCases = useMemo(
    () => cases.filter(c => c.contextId === activeContextId),
    [cases, activeContextId]
  )

  const filteredExceptions = useMemo(() => {
    const base =
      priorityFilter === 'ALL'
        ? contextExceptions
        : contextExceptions.filter(e => e.priority === priorityFilter)

    const priorityOrder: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return [...base].sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      if (a.slaBreach !== b.slaBreach) return a.slaBreach ? -1 : 1
      return b.item.age - a.item.age
    })
  }, [contextExceptions, priorityFilter])

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: contextExceptions.length }
    for (const e of contextExceptions) {
      counts[e.priority] = (counts[e.priority] ?? 0) + 1
    }
    return counts
  }, [contextExceptions])

  const handleRequestWriteOff = (excId: string) => {
    setWriteOffFormId(prev => (prev === excId ? null : excId))
  }

  const handleCancelWriteOff = () => {
    setWriteOffFormId(null)
  }

  const handleSubmitWriteOff = (excId: string, comments: string) => {
    createWriteOffRequest(excId, comments)
    setWriteOffFormId(null)
  }

  const handleEscalate = (excId: string) => {
    escalateToCase(excId)
    setEscalatedIds(prev => new Set(prev).add(excId))
    setTimeout(() => {
      setEscalatedIds(prev => {
        const next = new Set(prev)
        next.delete(excId)
        return next
      })
    }, 2000)
  }

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh', padding: '20px 24px', color: '#f1f5f9' }}>
      {/* CSS keyframes */}
      <style>{`
        @keyframes sla-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>

      {/* Top controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={activeContextId}
          onChange={e => setActiveContext(e.target.value)}
          style={{
            background: 'rgba(26,29,41,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7,
            color: '#f1f5f9',
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            minWidth: 240,
          }}
        >
          {contexts.map(ctx => (
            <option key={ctx.id} value={ctx.id}>
              {ctx.name}
            </option>
          ))}
        </select>

        {/* Role indicator */}
        <div
          style={{
            padding: '5px 12px',
            borderRadius: 7,
            border: isSupervisor ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
            background: isSupervisor ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isSupervisor ? '#10b981' : '#64748b',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: isSupervisor ? '#10b981' : '#94a3b8' }}>
            {isSupervisor ? 'Supervisor' : 'Analyst'} role
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <ExceptionSummary exceptions={contextExceptions} writeOffs={contextWriteOffs} />

      {/* Priority filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 3,
          marginBottom: 14,
          background: 'rgba(26,29,41,0.5)',
          borderRadius: 8,
          padding: 3,
          width: 'fit-content',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {PRIORITY_TABS.map(tab => {
          const isActive = priorityFilter === tab.key
          const count = priorityCounts[tab.key] ?? 0
          const priorityColor = tab.key !== 'ALL' ? PRIORITY_COLORS[tab.key as Priority] : '#64748b'

          return (
            <button
              key={tab.key}
              onClick={() => setPriorityFilter(tab.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                background: isActive ? 'rgba(59,130,246,0.14)' : 'transparent',
                color: isActive ? '#3b82f6' : '#64748b',
                transition: 'all 0.12s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {tab.key !== 'ALL' && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: priorityColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {tab.label}
              <span
                style={{
                  background: `${priorityColor}1a`,
                  color: priorityColor,
                  padding: '0 5px',
                  borderRadius: 100,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Exception Queue header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Exception Queue
        </span>
        <span style={{ fontSize: 11, color: '#334155' }}>
          {filteredExceptions.length} exception{filteredExceptions.length !== 1 ? 's' : ''}
          {priorityFilter !== 'ALL' ? ` · ${priorityFilter}` : ''}
        </span>
      </div>

      {/* Exception cards */}
      {filteredExceptions.length === 0 ? (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            color: '#334155',
            fontSize: 12,
            background: 'rgba(26,29,41,0.4)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {priorityFilter === 'ALL'
            ? 'No exceptions found for this context.'
            : `No ${priorityFilter.toLowerCase()} exceptions.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredExceptions.map(exc => (
            <ExceptionCard
              key={exc.id}
              exception={exc}
              team={team}
              isSupervisor={isSupervisor}
              writeOffFormId={writeOffFormId}
              escalatedIds={escalatedIds}
              onAssignReasonCode={(code) => assignReasonCode(exc.id, code)}
              onRequestWriteOff={() => handleRequestWriteOff(exc.id)}
              onCancelWriteOff={handleCancelWriteOff}
              onSubmitWriteOff={(comments) => handleSubmitWriteOff(exc.id, comments)}
              onEscalate={() => handleEscalate(exc.id)}
              onAddNote={(note) => addNote(exc.id, note)}
              onAssign={(name) => assignException(exc.id, name)}
              onResolve={() => resolveException(exc.id)}
            />
          ))}
        </div>
      )}

      {/* Write-Off Queue */}
      <WriteOffQueue
        writeOffs={contextWriteOffs}
        isSupervisor={isSupervisor}
        onApprove={approveWriteOff}
        onReject={rejectWriteOff}
      />

      {/* Cases Section */}
      <CasesSection
        cases={contextCases}
        onUpdateStatus={updateCaseStatus}
      />
    </div>
  )
}
