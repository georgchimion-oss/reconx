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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
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

// ─── Priority Dot ─────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority]
  const isCritical = priority === 'CRITICAL'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          boxShadow: isCritical ? `0 0 0 2px ${color}40, 0 0 8px ${color}` : 'none',
          animation: isCritical ? 'pulse 1.5s infinite' : 'none',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em' }}>
        {priority}
      </span>
    </div>
  )
}

// ─── SLA Status ───────────────────────────────────────────────────────────────

function SlaBadge({ deadline, slaBreach }: { deadline: string; slaBreach: boolean }) {
  const { label, isBreached, hoursLeft } = getSlaRemaining(deadline)
  const breached = isBreached || slaBreach
  const finalHour = !breached && hoursLeft < 1

  const color = breached
    ? '#ef4444'
    : hoursLeft < 4
      ? '#f59e0b'
      : '#10b981'

  return (
    <span
      className={finalHour ? 'pulse-red' : undefined}
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 6,
        padding: '2px 8px',
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {breached ? 'BREACHED' : label}
    </span>
  )
}

// ─── Expanded Exception Detail ────────────────────────────────────────────────

interface ExpandedExceptionProps {
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

function ExpandedExceptionDetail({
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
}: ExpandedExceptionProps) {
  const { item } = exception
  const [writeOffComments, setWriteOffComments] = useState('')
  const [noteText, setNoteText] = useState('')
  const showWriteOffForm = writeOffFormId === exception.id
  const showEscalatedMsg = escalatedIds.has(exception.id)

  const inputStyle: React.CSSProperties = {
    background: 'rgba(26,29,41,0.9)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 7,
    color: '#f1f5f9',
    padding: '6px 12px',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        background: 'rgba(10,12,20,0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: 20,
        marginTop: 2,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Item Details */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>
            Item Detail
          </div>
          {[
            { label: 'Reference', value: item.reference },
            { label: 'Description', value: item.description },
            { label: 'Counterparty', value: item.counterparty },
            { label: 'Value Date', value: formatDate(item.valueDate) },
            { label: 'Amount', value: formatCurrency(item.amount, item.currency) },
            { label: 'Currency', value: item.currency },
            { label: 'Side', value: item.side },
            { label: 'Age', value: `${item.age} days` },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{row.label}</span>
              <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Exception Details */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>
            Exception Detail
          </div>
          {[
            { label: 'Exception ID', value: exception.id },
            { label: 'Priority', value: exception.priority },
            { label: 'Reason Code', value: reasonCodeLabel(exception.reasonCode) },
            { label: 'Assigned To', value: exception.assignedTo },
            { label: 'Created', value: formatDate(exception.createdAt) },
            { label: 'SLA Deadline', value: formatDateTime(exception.slaDeadline) },
            { label: 'SLA Breached', value: exception.slaBreach ? 'Yes' : 'No' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{row.label}</span>
              <span style={{
                fontSize: 12,
                color: row.label === 'SLA Breached' && exception.slaBreach ? '#ef4444' : '#f1f5f9',
                fontWeight: 500,
              }}>
                {row.value}
              </span>
            </div>
          ))}

          {/* Assign To dropdown */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>
              Assign To
            </div>
            <select
              value={exception.assignedTo}
              onChange={e => onAssign(e.target.value)}
              style={{
                background: 'rgba(26,29,41,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 7,
                color: '#f1f5f9',
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
                width: '100%',
              }}
            >
              {team.map(member => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>
            Notes ({exception.notes.length})
          </div>
          {exception.notes.length === 0 ? (
            <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>No notes on this exception.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {exception.notes.map((note, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12,
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                  }}
                >
                  {note}
                </div>
              ))}
            </div>
          )}

          {/* Add Note input */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
              placeholder="Add investigation note..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={() => {
                if (noteText.trim()) {
                  onAddNote(noteText.trim())
                  setNoteText('')
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 7,
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>
            Actions:
          </span>

          {/* Reason Code dropdown */}
          <select
            defaultValue={exception.reasonCode}
            onChange={e => onAssignReasonCode(e.target.value as ReasonCode)}
            style={{
              background: 'rgba(26,29,41,0.9)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 7,
              color: '#f1f5f9',
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="" disabled>
              Assign Reason Code
            </option>
            {REASON_CODE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Request Write-Off */}
          {Math.abs(item.amount) < 10000 && (
            <button
              onClick={onRequestWriteOff}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                border: '1px solid rgba(139,92,246,0.4)',
                background: 'rgba(139,92,246,0.1)',
                color: '#8b5cf6',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.03em',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.2)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.1)')}
            >
              Request Write-Off
            </button>
          )}

          {/* Escalate */}
          <button
            onClick={onEscalate}
            style={{
              padding: '6px 14px',
              borderRadius: 7,
              border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)')}
          >
            Escalate to Case
          </button>

          {/* Escalated confirmation */}
          {showEscalatedMsg && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#10b981',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 7,
                padding: '4px 12px',
              }}
            >
              Case created
            </span>
          )}

          {/* Resolve — supervisor only */}
          {isSupervisor && (
            <button
              onClick={onResolve}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                border: '1px solid rgba(16,185,129,0.4)',
                background: 'rgba(16,185,129,0.1)',
                color: '#10b981',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.03em',
                marginLeft: 'auto',
              }}
            >
              Mark Resolved
            </button>
          )}
        </div>

        {/* Write-Off inline form */}
        {showWriteOffForm && (
          <div
            style={{
              width: '100%',
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 9,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6' }}>
              Write-Off Request — {item.reference}
            </div>
            <textarea
              value={writeOffComments}
              onChange={e => setWriteOffComments(e.target.value)}
              placeholder="Reason for write-off..."
              rows={3}
              style={{
                background: 'rgba(10,12,20,0.8)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 7,
                color: '#f1f5f9',
                padding: '8px 12px',
                fontSize: 12,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  onSubmitWriteOff(writeOffComments)
                  setWriteOffComments('')
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 7,
                  border: 'none',
                  background: '#8b5cf6',
                  color: '#fff',
                  fontSize: 12,
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
                  padding: '6px 16px',
                  borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: 12,
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
    </div>
  )
}

// ─── Exception Row ─────────────────────────────────────────────────────────────

interface ExceptionRowProps {
  exception: Exception
  index: number
  isExpanded: boolean
  team: { id: string; name: string }[]
  isSupervisor: boolean
  writeOffFormId: string | null
  escalatedIds: Set<string>
  onToggle: () => void
  onAssignReasonCode: (code: ReasonCode) => void
  onRequestWriteOff: () => void
  onCancelWriteOff: () => void
  onSubmitWriteOff: (comments: string) => void
  onEscalate: () => void
  onAddNote: (note: string) => void
  onAssign: (analystName: string) => void
  onResolve: () => void
}

function ExceptionRow({
  exception,
  index,
  isExpanded,
  team,
  isSupervisor,
  writeOffFormId,
  escalatedIds,
  onToggle,
  onAssignReasonCode,
  onRequestWriteOff,
  onCancelWriteOff,
  onSubmitWriteOff,
  onEscalate,
  onAddNote,
  onAssign,
  onResolve,
}: ExceptionRowProps) {
  const { item } = exception
  const isNegative = item.amount < 0

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          background: isExpanded
            ? 'rgba(59,130,246,0.06)'
            : index % 2 === 0
              ? 'transparent'
              : 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
          borderLeft: isExpanded ? '2px solid #3b82f6' : '2px solid transparent',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.05)'
        }}
        onMouseLeave={e => {
          if (!isExpanded) {
            (e.currentTarget as HTMLTableRowElement).style.background =
              index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
          }
        }}
      >
        <td style={{ padding: '12px 14px' }}>
          <PriorityDot priority={exception.priority} />
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#3b82f6', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {item.reference}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.description}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: isNegative ? '#ef4444' : '#f1f5f9' }}>
          {formatCurrency(item.amount, item.currency)}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          {item.currency}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, textAlign: 'center', color: item.age > 5 ? '#f59e0b' : '#94a3b8', fontWeight: item.age > 5 ? 600 : 400 }}>
          {item.age}d
        </td>
        <td style={{ padding: '12px 14px', fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
          {reasonCodeLabel(exception.reasonCode)}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8' }}>
          {exception.assignedTo || '—'}
        </td>
        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
          <SlaBadge deadline={exception.slaDeadline} slaBreach={exception.slaBreach} />
        </td>
        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
          <span
            style={{
              fontSize: 10,
              color: '#64748b',
              display: 'inline-block',
              transform: isExpanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            ▼
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={10} style={{ padding: '0 14px 14px' }}>
            <ExpandedExceptionDetail
              exception={exception}
              team={team}
              isSupervisor={isSupervisor}
              writeOffFormId={writeOffFormId}
              escalatedIds={escalatedIds}
              onAssignReasonCode={onAssignReasonCode}
              onRequestWriteOff={onRequestWriteOff}
              onCancelWriteOff={onCancelWriteOff}
              onSubmitWriteOff={onSubmitWriteOff}
              onEscalate={onEscalate}
              onAddNote={onAddNote}
              onAssign={onAssign}
              onResolve={onResolve}
            />
          </td>
        </tr>
      )}
    </>
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
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(139,92,246,0.07)',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Write-Off Queue</span>
        {pending.length > 0 && (
          <span
            style={{
              background: 'rgba(139,92,246,0.25)',
              color: '#8b5cf6',
              borderRadius: 10,
              padding: '1px 8px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {pending.length} pending
          </span>
        )}
        {!isSupervisor && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
            Supervisor access required to approve
          </span>
        )}
      </div>

      {/* Pending write-offs */}
      {pending.length > 0 && (
        <div style={{ padding: '12px 20px' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>
            Pending Approval
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(wo => (
              <div
                key={wo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 16px',
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  borderRadius: 9,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</div>
                      <div style={{ fontSize: 12, color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>
                        {wo.item?.reference ?? wo.itemId}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div>
                      <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(wo.amount, wo.item?.currency)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</div>
                      <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>
                        {reasonCodeLabel(wo.reasonCode)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requested By</div>
                      <div style={{ fontSize: 12, color: '#f1f5f9' }}>{wo.requestedBy}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requested At</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(wo.requestedAt)}</div>
                    </div>
                    {wo.comments && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{wo.comments}</div>
                      </div>
                    )}
                  </div>
                </div>

                {isSupervisor && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => onReject(wo.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 7,
                        border: '1px solid rgba(239,68,68,0.4)',
                        background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        letterSpacing: '0.03em',
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApprove(wo.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 7,
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        letterSpacing: '0.03em',
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
        <div style={{ padding: '12px 20px', borderTop: pending.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>
            Resolved
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolved.map(wo => {
              const isApproved = wo.status === 'APPROVED'
              const color = isApproved ? '#10b981' : '#ef4444'
              return (
                <div
                  key={wo.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${color}20`,
                    borderRadius: 8,
                    opacity: 0.75,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {wo.item?.reference ?? wo.itemId}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(wo.amount, wo.item?.currency)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>
                    {wo.status}
                  </span>
                  {wo.approvedBy && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>
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
        background: 'rgba(26,29,41,0.7)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(59,130,246,0.07)',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Cases</span>
        <span
          style={{
            background: 'rgba(59,130,246,0.2)',
            color: '#3b82f6',
            borderRadius: 10,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {cases.length}
        </span>
      </div>

      {/* Cases list */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cases.map(c => {
          const statusColor = CASE_STATUS_COLORS[c.status]
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                flexWrap: 'wrap',
              }}
            >
              {/* Case ID */}
              <div style={{ minWidth: 120 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Case ID</div>
                <div style={{ fontSize: 12, color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>{c.id}</div>
              </div>

              {/* Status badge */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Status</div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: statusColor,
                    background: `${statusColor}18`,
                    border: `1px solid ${statusColor}35`,
                    borderRadius: 6,
                    padding: '2px 8px',
                    letterSpacing: '0.03em',
                  }}
                >
                  {c.status.replace('_', ' ')}
                </span>
              </div>

              {/* Assigned To */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Assigned To</div>
                <div style={{ fontSize: 12, color: '#f1f5f9' }}>{c.assignedTo || '—'}</div>
              </div>

              {/* Item Reference */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Item Ref</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{c.item.reference}</div>
              </div>

              {/* Amount */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Amount</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(c.amount, c.item.currency)}
                </div>
              </div>

              {/* Created */}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Created</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(c.createdAt)}</div>
              </div>

              {/* Update Status */}
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Update Status</div>
                <select
                  value={c.status}
                  onChange={e => onUpdateStatus(c.id, e.target.value as CaseStatus)}
                  style={{
                    background: 'rgba(26,29,41,0.9)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 7,
                    color: '#f1f5f9',
                    padding: '5px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {CASE_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
        gap: 12,
        marginBottom: 24,
      }}
    >
      {stats.map(stat => (
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
          <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{stat.subtext}</div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
    // Close write-off form if switching rows
    if (writeOffFormId && writeOffFormId !== id) {
      setWriteOffFormId(null)
    }
  }

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

  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh', padding: '24px 28px', color: '#f1f5f9' }}>
      {/* CSS keyframes for critical priority pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(239,68,68,0.4), 0 0 8px rgba(239,68,68,0.7); }
          50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(239,68,68,0.2), 0 0 14px rgba(239,68,68,0.4); }
        }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Exceptions</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
          Break management, SLA tracking, and write-off approvals
        </p>
      </div>

      {/* Top controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={activeContextId}
          onChange={e => setActiveContext(e.target.value)}
          style={{
            background: 'rgba(26,29,41,0.9)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: '#f1f5f9',
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            minWidth: 260,
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
            padding: '6px 14px',
            borderRadius: 8,
            border: isSupervisor ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
            background: isSupervisor ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isSupervisor ? '#10b981' : '#64748b',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: isSupervisor ? '#10b981' : '#94a3b8' }}>
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
          gap: 4,
          marginBottom: 16,
          background: 'rgba(26,29,41,0.5)',
          borderRadius: 10,
          padding: 4,
          width: 'fit-content',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {PRIORITY_TABS.map(tab => {
          const isActive = priorityFilter === tab.key
          const count = priorityCounts[tab.key] ?? 0
          const priorityColor = tab.key !== 'ALL'
            ? PRIORITY_COLORS[tab.key as Priority]
            : '#64748b'

          return (
            <button
              key={tab.key}
              onClick={() => setPriorityFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: isActive ? '#3b82f6' : '#94a3b8',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.key !== 'ALL' && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: priorityColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {tab.label}
              <span
                style={{
                  background: `${priorityColor}20`,
                  color: priorityColor,
                  padding: '1px 6px',
                  borderRadius: 100,
                  fontSize: 10,
                  fontWeight: 700,
                  marginLeft: 5,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Exception table */}
      <div
        style={{
          background: 'rgba(26,29,41,0.7)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Exception Queue</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {filteredExceptions.length} exception{filteredExceptions.length !== 1 ? 's' : ''}
            {priorityFilter !== 'ALL' ? ` · ${priorityFilter}` : ''}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Reference</th>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>CCY</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Age</th>
                <th style={thStyle}>Reason Code</th>
                <th style={thStyle}>Assigned To</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>SLA Status</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {filteredExceptions.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                    {priorityFilter === 'ALL'
                      ? 'No exceptions found for this context.'
                      : `No ${priorityFilter.toLowerCase()} exceptions.`}
                  </td>
                </tr>
              ) : (
                filteredExceptions.map((exc, idx) => (
                  <ExceptionRow
                    key={exc.id}
                    exception={exc}
                    index={idx}
                    isExpanded={expandedId === exc.id}
                    team={team}
                    isSupervisor={isSupervisor}
                    writeOffFormId={writeOffFormId}
                    escalatedIds={escalatedIds}
                    onToggle={() => handleToggle(exc.id)}
                    onAssignReasonCode={(code) => assignReasonCode(exc.id, code)}
                    onRequestWriteOff={() => handleRequestWriteOff(exc.id)}
                    onCancelWriteOff={handleCancelWriteOff}
                    onSubmitWriteOff={(comments) => handleSubmitWriteOff(exc.id, comments)}
                    onEscalate={() => handleEscalate(exc.id)}
                    onAddNote={(note) => addNote(exc.id, note)}
                    onAssign={(name) => assignException(exc.id, name)}
                    onResolve={() => resolveException(exc.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
