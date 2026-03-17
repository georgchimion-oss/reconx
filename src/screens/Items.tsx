import { useState, useMemo, useCallback } from 'react'
import { useReconStore } from '../store/reconStore'
import type {
  ReconItem,
  ItemStatus,
  ItemSide,
  MatchPassType,
  ReasonCode,
  MatchGroup,
  AuditEvent,
  Exception,
} from '../data/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const STATUS_TABS: { key: ItemStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'UNMATCHED', label: 'Unmatched' },
  { key: 'BREAK', label: 'Break' },
  { key: 'PROPOSED', label: 'Proposed' },
  { key: 'WRITE_OFF', label: 'Write-off' },
]

const STATUS_COLORS: Record<ItemStatus, string> = {
  MATCHED: '#10b981',
  UNMATCHED: '#f59e0b',
  BREAK: '#ef4444',
  PROPOSED: '#8b5cf6',
  WRITE_OFF: '#94a3b8',
}

const STATUS_ROW_TINT: Record<ItemStatus, string> = {
  MATCHED: 'rgba(16,185,129,0.04)',
  UNMATCHED: 'transparent',
  BREAK: 'rgba(239,68,68,0.05)',
  PROPOSED: 'rgba(139,92,246,0.05)',
  WRITE_OFF: 'rgba(148,163,184,0.04)',
}

const MATCH_PASS_OPTIONS: { value: MatchPassType; label: string }[] = [
  { value: 'EXACT', label: 'Exact' },
  { value: 'TOLERANCE', label: 'Tolerance' },
  { value: 'FUZZY', label: 'Fuzzy' },
  { value: 'AI_SUGGESTED', label: 'AI' },
  { value: 'MANUAL', label: 'Manual' },
]

const REASON_CODE_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'TIMING', label: 'Timing' },
  { value: 'MISSING_TRADE', label: 'Missing Trade' },
  { value: 'RATE_DIFFERENCE', label: 'Rate Difference' },
  { value: 'COUNTERPARTY_ERROR', label: 'Counterparty Error' },
  { value: 'FEE_DIFFERENCE', label: 'Fee Difference' },
  { value: 'DUPLICATE', label: 'Duplicate' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

type SortField =
  | 'valueDate'
  | 'reference'
  | 'description'
  | 'amount'
  | 'currency'
  | 'status'
  | 'matchGroupId'
  | 'age'
  | 'assignedTo'
  | 'side'

interface SortState {
  field: SortField | null
  dir: 'asc' | 'desc'
}

interface FilterState {
  status: ItemStatus | 'ALL'
  side: ItemSide | 'BOTH'
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  matchTypes: Set<MatchPassType>
  refSearch: string
  assignedTo: string
  carryForwardOnly: boolean
}

function defaultFilters(): FilterState {
  return {
    status: 'ALL',
    side: 'BOTH',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    matchTypes: new Set(),
    refSearch: '',
    assignedTo: '',
    carryForwardOnly: false,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.status !== 'ALL') n++
  if (f.side !== 'BOTH') n++
  if (f.dateFrom) n++
  if (f.dateTo) n++
  if (f.amountMin) n++
  if (f.amountMax) n++
  if (f.matchTypes.size > 0) n++
  if (f.refSearch) n++
  if (f.assignedTo) n++
  if (f.carryForwardOnly) n++
  return n
}

function sortItems(items: ReconItem[], sort: SortState): ReconItem[] {
  if (!sort.field) return items
  return [...items].sort((a, b) => {
    let cmp = 0
    switch (sort.field) {
      case 'valueDate':
        cmp = a.valueDate.localeCompare(b.valueDate)
        break
      case 'reference':
        cmp = a.reference.localeCompare(b.reference)
        break
      case 'description':
        cmp = a.description.localeCompare(b.description)
        break
      case 'amount':
        cmp = a.amount - b.amount
        break
      case 'currency':
        cmp = a.currency.localeCompare(b.currency)
        break
      case 'status':
        cmp = a.status.localeCompare(b.status)
        break
      case 'matchGroupId':
        cmp = (a.matchGroupId ?? '').localeCompare(b.matchGroupId ?? '')
        break
      case 'age':
        cmp = a.age - b.age
        break
      case 'assignedTo':
        cmp = (a.assignedTo ?? '').localeCompare(b.assignedTo ?? '')
        break
      case 'side':
        cmp = a.side.localeCompare(b.side)
        break
    }
    return sort.dir === 'asc' ? cmp : -cmp
  })
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(15,17,23,0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  color: '#cbd5e1',
  padding: '3px 7px',
  fontSize: 11,
  outline: 'none',
  fontFamily: 'inherit',
  height: 24,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  paddingRight: 20,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#475569',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 3,
  display: 'block',
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ItemStatus }) {
  const color = STATUS_COLORS[status]
  const label =
    status === 'WRITE_OFF' ? 'W/O'
    : status === 'PROPOSED' ? 'PROP'
    : status === 'UNMATCHED' ? 'UNMTCH'
    : status === 'MATCHED' ? 'MTCH'
    : 'BRK'
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: 4,
        padding: '1px 5px',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label}
    </span>
  )
}

// ─── CF Badge ─────────────────────────────────────────────────────────────────

function CfBadge({ days }: { days: number }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: '#f59e0b',
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 4,
        padding: '1px 5px',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      CF+{days}d
    </span>
  )
}

// ─── Sort Header Cell ─────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string
  field: SortField
  sort: SortState
  onSort: (field: SortField) => void
  style?: React.CSSProperties
}

function SortHeader({ label, field, sort, onSort, style }: SortHeaderProps) {
  const active = sort.field === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: active ? '#94a3b8' : '#475569',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        padding: '6px 8px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        textAlign: 'left',
        background: 'rgba(15,17,23,0.6)',
        ...style,
      }}
    >
      {label}
      {active && (
        <span style={{ marginLeft: 4, opacity: 0.7 }}>
          {sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      )}
      {!active && (
        <span style={{ marginLeft: 4, opacity: 0.2 }}>↕</span>
      )}
    </th>
  )
}

// ─── Item Detail Drawer ───────────────────────────────────────────────────────

interface DrawerProps {
  item: ReconItem
  matchGroup: MatchGroup | null
  auditEvents: AuditEvent[]
  exception: Exception | null
  onClose: () => void
  onAssignReasonCode: (itemId: string, code: ReasonCode) => void
  onAddNote: (exceptionId: string, note: string) => void
  onCreateWriteOff: (exceptionId: string, comment: string) => void
}

function ItemDetailDrawer({
  item,
  matchGroup,
  auditEvents,
  exception,
  onClose,
  onAssignReasonCode,
  onAddNote,
  onCreateWriteOff,
}: DrawerProps) {
  const [noteText, setNoteText] = useState('')
  const [woComment, setWoComment] = useState('')
  const [showWoForm, setShowWoForm] = useState(false)

  const itemAudit = auditEvents.filter(e => e.itemId === item.id)
  const isNegative = item.amount < 0

  return (
    <div
      style={{
        width: 300,
        minWidth: 300,
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(13,15,22,0.98)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#3b82f6',
              fontFamily: 'monospace',
            }}
          >
            {item.reference}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
            {item.side} · {item.currency}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close drawer"
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5,
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 14,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* Core fields */}
        <Section title="Item Fields">
          <Field label="Amount">
            <span
              style={{
                color: isNegative ? '#f87171' : '#f1f5f9',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCurrency(item.amount, item.currency)}
            </span>
          </Field>
          <Field label="Value Date">{formatDate(item.valueDate)}</Field>
          <Field label="Description">
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{item.description}</span>
          </Field>
          <Field label="Counterparty">
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{item.counterparty}</span>
          </Field>
          <Field label="Status">
            <StatusBadge status={item.status} />
          </Field>
          <Field label="Age">
            <span
              style={{
                color: item.age > 5 ? '#f87171' : item.age > 2 ? '#f59e0b' : '#94a3b8',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 11,
              }}
            >
              {item.age}d
            </span>
          </Field>
          {item.isCarryForward && (
            <Field label="Carry Forward">
              <CfBadge days={item.carryForwardDays} />
            </Field>
          )}
          <Field label="Assigned To">
            {item.assignedTo ?? <span style={{ color: '#475569' }}>—</span>}
          </Field>
          <Field label="Reason Code">
            {item.reasonCode ? (
              <span style={{ color: '#f59e0b', fontSize: 11 }}>
                {REASON_CODE_OPTIONS.find(r => r.value === item.reasonCode)?.label ?? item.reasonCode}
              </span>
            ) : (
              <span style={{ color: '#475569' }}>—</span>
            )}
          </Field>
          {item.matchPass && (
            <Field label="Match Pass">
              <span style={{ color: '#8b5cf6', fontSize: 11 }}>
                {MATCH_PASS_OPTIONS.find(m => m.value === item.matchPass)?.label ?? item.matchPass}
              </span>
            </Field>
          )}
        </Section>

        {/* Match group info */}
        {matchGroup && (
          <Section title={`Match Group · ${matchGroup.type}`}>
            <Field label="Group ID">
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#7c3aed' }}>
                {matchGroup.id}
              </span>
            </Field>
            <Field label="Confidence">
              <ConfidenceBar value={matchGroup.confidence} />
            </Field>
            <Field label="Status">
              <span
                style={{
                  fontSize: 10,
                  color:
                    matchGroup.status === 'CONFIRMED' ? '#10b981'
                    : matchGroup.status === 'BROKEN' ? '#ef4444'
                    : '#f59e0b',
                }}
              >
                {matchGroup.status}
              </span>
            </Field>
            <Field label="Net Diff">
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: matchGroup.netDifference === 0 ? '#10b981' : '#f59e0b',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(matchGroup.netDifference, 'USD')}
              </span>
            </Field>
            <Field label="Matched By">{matchGroup.matchedBy}</Field>
            <Field label="Matched At">
              {formatDateTime(matchGroup.matchedAt)}
            </Field>
            {matchGroup.internalItems.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ ...labelStyle }}>Internal ({matchGroup.internalItems.length})</div>
                {matchGroup.internalItems.map(i => (
                  <div
                    key={i.id}
                    style={{
                      fontSize: 10,
                      color: '#64748b',
                      fontFamily: 'monospace',
                      padding: '2px 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ color: '#3b82f6' }}>{i.reference}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(i.amount, i.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {matchGroup.externalItems.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ ...labelStyle }}>External ({matchGroup.externalItems.length})</div>
                {matchGroup.externalItems.map(i => (
                  <div
                    key={i.id}
                    style={{
                      fontSize: 10,
                      color: '#64748b',
                      fontFamily: 'monospace',
                      padding: '2px 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ color: '#06b6d4' }}>{i.reference}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(i.amount, i.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {matchGroup.comments.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ ...labelStyle }}>Comments</div>
                {matchGroup.comments.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: '#64748b',
                      padding: '2px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Exception info */}
        {exception && (
          <Section title="Exception">
            <Field label="Priority">
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color:
                    exception.priority === 'CRITICAL' ? '#ef4444'
                    : exception.priority === 'HIGH' ? '#f97316'
                    : exception.priority === 'MEDIUM' ? '#f59e0b'
                    : '#94a3b8',
                }}
              >
                {exception.priority}
              </span>
            </Field>
            <Field label="SLA Deadline">
              {formatDateTime(exception.slaDeadline)}
            </Field>
            <Field label="SLA Breach">
              <span style={{ color: exception.slaBreach ? '#ef4444' : '#10b981', fontSize: 11 }}>
                {exception.slaBreach ? 'Yes' : 'No'}
              </span>
            </Field>
            {exception.notes.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ ...labelStyle }}>Notes</div>
                {exception.notes.slice(-3).map((n, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: '#64748b',
                      padding: '3px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Quick actions */}
        <Section title="Quick Actions">
          {/* Assign reason code */}
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Assign Reason Code</label>
            <select
              value={item.reasonCode ?? ''}
              onChange={e => {
                if (e.target.value) onAssignReasonCode(item.id, e.target.value as ReasonCode)
              }}
              style={{ ...selectStyle, width: '100%' }}
            >
              <option value="">— Select —</option>
              {REASON_CODE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Add note (only if exception) */}
          {exception && (
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Add Note</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Type note..."
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && noteText.trim()) {
                      onAddNote(exception.id, noteText.trim())
                      setNoteText('')
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (noteText.trim()) {
                      onAddNote(exception.id, noteText.trim())
                      setNoteText('')
                    }
                  }}
                  style={{
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 5,
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '3px 8px',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Write-off */}
          {exception && !showWoForm && (
            <button
              onClick={() => setShowWoForm(true)}
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 5,
                color: '#f87171',
                cursor: 'pointer',
                fontSize: 11,
                padding: '5px 10px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              Request Write-off
            </button>
          )}
          {exception && showWoForm && (
            <div>
              <label style={labelStyle}>Write-off Comment</label>
              <textarea
                value={woComment}
                onChange={e => setWoComment(e.target.value)}
                rows={3}
                placeholder="Justification..."
                style={{
                  ...inputStyle,
                  width: '100%',
                  resize: 'vertical',
                  height: 'auto',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button
                  onClick={() => {
                    if (woComment.trim()) {
                      onCreateWriteOff(exception.id, woComment.trim())
                      setShowWoForm(false)
                      setWoComment('')
                    }
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 5,
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '4px 8px',
                    flex: 1,
                  }}
                >
                  Submit
                </button>
                <button
                  onClick={() => setShowWoForm(false)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5,
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '4px 8px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Audit history */}
        {itemAudit.length > 0 && (
          <Section title={`Audit History (${itemAudit.length})`}>
            {itemAudit.slice(0, 8).map(e => (
              <div
                key={e.id}
                style={{
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#3b82f6',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {e.action}
                  </span>
                  <span style={{ fontSize: 9, color: '#334155' }}>
                    {formatDateTime(e.timestamp)}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
                  {e.detail}
                </div>
                <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>
                  {e.user}
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── Section / Field helpers ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#334155',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 4,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 0',
        minHeight: 20,
      }}
    >
      <span style={{ fontSize: 10, color: '#475569', flexShrink: 0, marginRight: 8 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 90 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div
        style={{
          width: 60,
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
          }}
        />
      </div>
      <span style={{ fontSize: 10, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}%
      </span>
    </div>
  )
}

// ─── Manual Match Panel ───────────────────────────────────────────────────────

interface ManualMatchPanelProps {
  internalItems: ReconItem[]
  externalItems: ReconItem[]
  selectedInternal: Set<string>
  selectedExternal: Set<string>
  suggestedExternalIds: Set<string>
  onToggleInternal: (id: string) => void
  onToggleExternal: (id: string) => void
  onCreateMatch: (comment: string) => void
  onClose: () => void
}

function ManualMatchPanel({
  internalItems,
  externalItems,
  selectedInternal,
  selectedExternal,
  suggestedExternalIds,
  onToggleInternal,
  onToggleExternal,
  onCreateMatch,
  onClose,
}: ManualMatchPanelProps) {
  const [comment, setComment] = useState('')
  const canMatch = selectedInternal.size > 0 && selectedExternal.size > 0

  const matchLabel =
    selectedInternal.size > 0 && selectedExternal.size > 0
      ? `Match ${selectedInternal.size} internal \u2194 ${selectedExternal.size} external`
      : 'Select items to match'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          background: 'rgba(139,92,246,0.06)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#a78bfa',
            letterSpacing: '0.03em',
          }}
        >
          Manual Match Mode
        </span>
        <span style={{ color: '#334155', fontSize: 11 }}>{matchLabel}</span>
        <div style={{ flex: 1 }} />
        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Justification (required)..."
          style={{ ...inputStyle, width: 220 }}
        />
        <button
          disabled={!canMatch || !comment.trim()}
          onClick={() => {
            if (canMatch && comment.trim()) onCreateMatch(comment.trim())
          }}
          style={{
            background: canMatch && comment.trim() ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canMatch && comment.trim() ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 5,
            color: canMatch && comment.trim() ? '#a78bfa' : '#334155',
            cursor: canMatch && comment.trim() ? 'pointer' : 'not-allowed',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          Create Match
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5,
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 11,
            padding: '4px 10px',
          }}
        >
          Cancel
        </button>
      </div>

      {/* Split view */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Internal */}
        <ManualSideList
          title="Internal"
          items={internalItems}
          selected={selectedInternal}
          highlighted={new Set()}
          onToggle={onToggleInternal}
          sideColor="#3b82f6"
          sideIcon="↓"
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
        {/* External */}
        <ManualSideList
          title="External"
          items={externalItems}
          selected={selectedExternal}
          highlighted={suggestedExternalIds}
          onToggle={onToggleExternal}
          sideColor="#06b6d4"
          sideIcon="↑"
        />
      </div>
    </div>
  )
}

interface ManualSideListProps {
  title: string
  items: ReconItem[]
  selected: Set<string>
  highlighted: Set<string>
  onToggle: (id: string) => void
  sideColor: string
  sideIcon: string
}

function ManualSideList({
  title,
  items,
  selected,
  highlighted,
  onToggle,
  sideColor,
  sideIcon,
}: ManualSideListProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          padding: '5px 10px',
          fontSize: 10,
          fontWeight: 700,
          color: sideColor,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        {sideIcon} {title} — {items.length} items
        {selected.size > 0 && (
          <span
            style={{
              marginLeft: 8,
              background: sideColor + '20',
              border: `1px solid ${sideColor}40`,
              borderRadius: 4,
              padding: '0 5px',
              color: sideColor,
            }}
          >
            {selected.size} selected
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['', 'Reference', 'Amount', 'Date', 'Age'].map(h => (
                <th
                  key={h}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: '#334155',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '4px 6px',
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(15,17,23,0.5)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isSelected = selected.has(item.id)
              const isSuggested = highlighted.has(item.id)
              return (
                <tr
                  key={item.id}
                  onClick={() => onToggle(item.id)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected
                      ? `${sideColor}15`
                      : isSuggested
                      ? 'rgba(245,158,11,0.07)'
                      : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.1s',
                  }}
                >
                  <td style={{ padding: '4px 6px', width: 20 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        border: `1.5px solid ${isSelected ? sideColor : 'rgba(255,255,255,0.15)'}`,
                        background: isSelected ? sideColor : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <span style={{ color: '#0f1117', fontSize: 8, fontWeight: 900 }}>✓</span>
                      )}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: isSelected ? sideColor : isSuggested ? '#f59e0b' : '#64748b',
                    }}
                  >
                    {item.reference}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontVariantNumeric: 'tabular-nums',
                      color: item.amount < 0 ? '#f87171' : '#f1f5f9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrency(item.amount, item.currency)}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      fontSize: 10,
                      color: '#475569',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(item.valueDate)}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      fontSize: 10,
                      fontVariantNumeric: 'tabular-nums',
                      color: item.age > 5 ? '#f87171' : '#475569',
                    }}
                  >
                    {item.age}d
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: '20px 10px',
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#334155',
                  }}
                >
                  No unmatched items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: FilterState
  counts: Record<ItemStatus | 'ALL', number>
  team: { id: string; name: string }[]
  onChange: (f: FilterState) => void
  onClear: () => void
}

function FilterPanel({ filters, counts, team, onChange, onClear }: FilterPanelProps) {
  const activeCount = countActiveFilters(filters)

  function toggleMatchType(pass: MatchPassType) {
    const next = new Set(filters.matchTypes)
    if (next.has(pass)) next.delete(pass)
    else next.add(pass)
    onChange({ ...filters, matchTypes: next })
  }

  return (
    <div
      style={{
        background: 'rgba(15,17,23,0.7)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '8px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}
    >
      {/* Row 1: Status tabs + Side toggle + Clear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {STATUS_TABS.map(tab => {
            const active = filters.status === tab.key
            const color =
              tab.key === 'ALL' ? '#94a3b8'
              : STATUS_COLORS[tab.key as ItemStatus]
            return (
              <button
                key={tab.key}
                onClick={() => onChange({ ...filters, status: tab.key })}
                style={{
                  background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 5,
                  color: active ? color : '#475569',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  padding: '3px 9px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.1s',
                }}
              >
                {tab.label}
                <span
                  style={{
                    marginLeft: 5,
                    background: active ? `${color}25` : 'rgba(255,255,255,0.06)',
                    borderRadius: 3,
                    padding: '0 4px',
                    fontSize: 9,
                    fontVariantNumeric: 'tabular-nums',
                    color: active ? color : '#334155',
                  }}
                >
                  {counts[tab.key]}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

        {/* Side toggle */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['BOTH', 'INTERNAL', 'EXTERNAL'] as const).map(s => {
            const active = filters.side === s
            return (
              <button
                key={s}
                onClick={() => onChange({ ...filters, side: s })}
                style={{
                  background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 5,
                  color: active ? '#06B6D4' : '#475569',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  padding: '3px 9px',
                  transition: 'all 0.1s',
                }}
              >
                {s === 'BOTH' ? 'Both' : s === 'INTERNAL' ? '↓ Int' : '↑ Ext'}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Filter count badge + clear */}
        {activeCount > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 5,
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 10,
              padding: '3px 9px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: 3,
                padding: '0 4px',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {activeCount}
            </span>
            Clear All
          </button>
        )}
      </div>

      {/* Row 2: Inputs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Date range */}
        <div>
          <label style={labelStyle}>From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            style={{ ...inputStyle, width: 110 }}
          />
        </div>
        <div>
          <label style={labelStyle}>To Date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            style={{ ...inputStyle, width: 110 }}
          />
        </div>

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.06)' }} />

        {/* Amount range */}
        <div>
          <label style={labelStyle}>Amount Min</label>
          <input
            type="number"
            value={filters.amountMin}
            onChange={e => onChange({ ...filters, amountMin: e.target.value })}
            placeholder="0"
            style={{ ...inputStyle, width: 90, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <div>
          <label style={labelStyle}>Amount Max</label>
          <input
            type="number"
            value={filters.amountMax}
            onChange={e => onChange({ ...filters, amountMax: e.target.value })}
            placeholder="Any"
            style={{ ...inputStyle, width: 90, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.06)' }} />

        {/* Reference search */}
        <div>
          <label style={labelStyle}>Reference / Description</label>
          <input
            value={filters.refSearch}
            onChange={e => onChange({ ...filters, refSearch: e.target.value })}
            placeholder="Search..."
            style={{ ...inputStyle, width: 160 }}
          />
        </div>

        {/* Assigned to */}
        <div>
          <label style={labelStyle}>Assigned To</label>
          <select
            value={filters.assignedTo}
            onChange={e => onChange({ ...filters, assignedTo: e.target.value })}
            style={{ ...selectStyle, width: 130 }}
          >
            <option value="">Any</option>
            {team.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.06)' }} />

        {/* Match types */}
        <div>
          <label style={labelStyle}>Match Type</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MATCH_PASS_OPTIONS.map(opt => {
              const active = filters.matchTypes.has(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleMatchType(opt.value)}
                  style={{
                    background: active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 4,
                    color: active ? '#a78bfa' : '#475569',
                    cursor: 'pointer',
                    fontSize: 9,
                    fontWeight: active ? 700 : 400,
                    padding: '2px 7px',
                    letterSpacing: '0.04em',
                    transition: 'all 0.1s',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.06)' }} />

        {/* CF toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={labelStyle}>Carry Fwd</label>
          <button
            onClick={() => onChange({ ...filters, carryForwardOnly: !filters.carryForwardOnly })}
            style={{
              background: filters.carryForwardOnly
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filters.carryForwardOnly ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 5,
              color: filters.carryForwardOnly ? '#fbbf24' : '#475569',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: filters.carryForwardOnly ? 700 : 400,
              padding: '3px 9px',
              height: 24,
              transition: 'all 0.1s',
            }}
          >
            CF Only
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Items Screen ────────────────────────────────────────────────────────

export default function Items() {
  const {
    items,
    contexts,
    activeContextId,
    exceptions,
    matchGroups,
    team,
    auditTrail,
    createManualMatch,
    createMultiMatch,
    assignReasonCode,
    addNote,
    createWriteOffRequest,
  } = useReconStore()

  // Filter state
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [filterOpen, setFilterOpen] = useState(true)

  // Sort state
  const [sort, setSort] = useState<SortState>({ field: 'valueDate', dir: 'desc' })

  // Pagination
  const [page, setPage] = useState(0)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Detail drawer
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null)

  // Manual match mode
  const [manualMode, setManualMode] = useState(false)
  const [selectedInternal, setSelectedInternal] = useState<Set<string>>(new Set())
  const [selectedExternal, setSelectedExternal] = useState<Set<string>>(new Set())

  // Bulk assign
  const [bulkAssignTo, setBulkAssignTo] = useState('')

  // Context items
  const contextItems = useMemo(
    () => items.filter(i => i.contextId === activeContextId),
    [items, activeContextId]
  )

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts: Record<ItemStatus | 'ALL', number> = {
      ALL: contextItems.length,
      MATCHED: 0,
      UNMATCHED: 0,
      BREAK: 0,
      PROPOSED: 0,
      WRITE_OFF: 0,
    }
    for (const item of contextItems) counts[item.status]++
    return counts
  }, [contextItems])

  // Summary stats
  const stats = useMemo(() => {
    const matched = contextItems.filter(i => i.status === 'MATCHED').length
    const unmatched = contextItems.filter(i => i.status === 'UNMATCHED').length
    const breaks = contextItems.filter(i => i.status === 'BREAK').length
    const cfItems = contextItems.filter(i => i.isCarryForward).length
    return { total: contextItems.length, matched, unmatched, breaks, cfItems }
  }, [contextItems])

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = contextItems

    if (filters.status !== 'ALL') {
      result = result.filter(i => i.status === filters.status)
    }
    if (filters.side !== 'BOTH') {
      result = result.filter(i => i.side === filters.side)
    }
    if (filters.dateFrom) {
      result = result.filter(i => i.valueDate >= filters.dateFrom)
    }
    if (filters.dateTo) {
      result = result.filter(i => i.valueDate <= filters.dateTo)
    }
    if (filters.amountMin !== '') {
      const min = parseFloat(filters.amountMin)
      if (!isNaN(min)) result = result.filter(i => Math.abs(i.amount) >= min)
    }
    if (filters.amountMax !== '') {
      const max = parseFloat(filters.amountMax)
      if (!isNaN(max)) result = result.filter(i => Math.abs(i.amount) <= max)
    }
    if (filters.matchTypes.size > 0) {
      result = result.filter(i => i.matchPass && filters.matchTypes.has(i.matchPass))
    }
    if (filters.refSearch) {
      const q = filters.refSearch.toLowerCase()
      result = result.filter(
        i =>
          i.reference.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      )
    }
    if (filters.assignedTo) {
      result = result.filter(i => i.assignedTo === filters.assignedTo)
    }
    if (filters.carryForwardOnly) {
      result = result.filter(i => i.isCarryForward)
    }

    return sortItems(result, sort)
  }, [contextItems, filters, sort])

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE)
  const pageItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Manual match auto-suggest: highlight external items with similar amount / same date to first selected internal
  const suggestedExternalIds = useMemo(() => {
    if (!manualMode || selectedInternal.size === 0) return new Set<string>()
    const firstId = [...selectedInternal][0]
    const ref = contextItems.find(i => i.id === firstId)
    if (!ref) return new Set<string>()
    const result = new Set<string>()
    for (const item of contextItems) {
      if (item.side !== 'EXTERNAL') continue
      if (item.status !== 'UNMATCHED') continue
      const amtClose = Math.abs(Math.abs(item.amount) - Math.abs(ref.amount)) / Math.max(Math.abs(ref.amount), 0.01) < 0.01
      const dateMatch = item.valueDate === ref.valueDate
      if (amtClose || dateMatch) result.add(item.id)
    }
    return result
  }, [manualMode, selectedInternal, contextItems])

  // Split items for manual mode
  const unmatchedInternal = useMemo(
    () => contextItems.filter(i => i.side === 'INTERNAL' && i.status === 'UNMATCHED'),
    [contextItems]
  )
  const unmatchedExternal = useMemo(
    () => contextItems.filter(i => i.side === 'EXTERNAL' && i.status === 'UNMATCHED'),
    [contextItems]
  )

  // Drawer item
  const drawerItem = drawerItemId ? items.find(i => i.id === drawerItemId) ?? null : null
  const drawerMatchGroup = drawerItem?.matchGroupId
    ? matchGroups.find(mg => mg.id === drawerItem.matchGroupId) ?? null
    : null
  const drawerException = drawerItem
    ? exceptions.find(e => e.itemId === drawerItem.id) ?? null
    : null

  // Handlers
  const handleSort = useCallback(
    (field: SortField) => {
      setSort(prev =>
        prev.field === field
          ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
          : { field, dir: 'asc' }
      )
      setPage(0)
    },
    []
  )

  const handleFilterChange = useCallback((f: FilterState) => {
    setFilters(f)
    setPage(0)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === pageItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pageItems.map(i => i.id)))
    }
  }, [selectedIds.size, pageItems])

  const handleCreateMatch = useCallback(
    (comment: string) => {
      const intIds = [...selectedInternal]
      const extIds = [...selectedExternal]
      if (intIds.length === 1 && extIds.length === 1) {
        createManualMatch(intIds[0], extIds[0], comment)
      } else {
        createMultiMatch(intIds, extIds, comment)
      }
      setSelectedInternal(new Set())
      setSelectedExternal(new Set())
      setManualMode(false)
    },
    [selectedInternal, selectedExternal, createManualMatch, createMultiMatch]
  )

  const handleAssignReasonCode = useCallback(
    (itemId: string, code: ReasonCode) => {
      const exc = exceptions.find(e => e.itemId === itemId)
      if (exc) assignReasonCode(exc.id, code)
    },
    [exceptions, assignReasonCode]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#0d0f16',
      }}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          background: 'rgba(13,15,22,0.95)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '0.02em',
            }}
          >
            Items
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>
            {contexts.find(c => c.id === activeContextId)?.name ?? activeContextId}
          </div>
        </div>

        {/* Summary stats */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6,
            overflow: 'hidden',
            marginLeft: 8,
          }}
        >
          {[
            { label: 'Total', value: stats.total, color: '#94a3b8' },
            { label: 'Matched', value: stats.matched, color: '#10b981' },
            { label: 'Unmatched', value: stats.unmatched, color: '#f59e0b' },
            { label: 'Breaks', value: stats.breaks, color: '#ef4444' },
            { label: 'CF Items', value: stats.cfItems, color: '#f59e0b' },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: '4px 12px',
                borderRight:
                  i < 4 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: s.color,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 9, color: '#334155', letterSpacing: '0.05em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Manual match toggle */}
        <button
          onClick={() => {
            setManualMode(m => !m)
            setSelectedInternal(new Set())
            setSelectedExternal(new Set())
            setDrawerItemId(null)
          }}
          style={{
            background: manualMode ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${manualMode ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 5,
            color: manualMode ? '#a78bfa' : '#64748b',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: manualMode ? 700 : 400,
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.12s',
          }}
        >
          <span style={{ fontSize: 12 }}>⟺</span>
          Manual Match
        </button>

        {/* Filter toggle */}
        <button
          onClick={() => setFilterOpen(o => !o)}
          style={{
            background: filterOpen ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${filterOpen ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 5,
            color: filterOpen ? '#06B6D4' : '#64748b',
            cursor: 'pointer',
            fontSize: 11,
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.12s',
          }}
        >
          <span style={{ fontSize: 12 }}>⊟</span>
          Filters
          {countActiveFilters(filters) > 0 && (
            <span
              style={{
                background: '#3b82f6',
                color: '#fff',
                borderRadius: 3,
                padding: '0 4px',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {countActiveFilters(filters)}
            </span>
          )}
        </button>
      </div>

      {/* Bulk actions bar (when items selected) */}
      {selectedIds.size > 0 && !manualMode && (
        <div
          style={{
            padding: '5px 14px',
            background: 'rgba(59,130,246,0.07)',
            borderBottom: '1px solid rgba(59,130,246,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#06B6D4',
            }}
          >
            {selectedIds.size} selected
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 10, color: '#475569' }}>Assign To:</span>
          <select
            value={bulkAssignTo}
            onChange={e => setBulkAssignTo(e.target.value)}
            style={{ ...selectStyle, width: 140 }}
          >
            <option value="">— Select —</option>
            {team.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
          <span style={{ fontSize: 10, color: '#475569' }}>Reason Code:</span>
          <select
            style={{ ...selectStyle, width: 140 }}
            defaultValue=""
            onChange={() => {}}
          >
            <option value="">— Select —</option>
            {REASON_CODE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 5,
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 10,
              padding: '3px 10px',
            }}
          >
            Request Write-off
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              cursor: 'pointer',
              fontSize: 10,
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Filter panel */}
      {filterOpen && !manualMode && (
        <FilterPanel
          filters={filters}
          counts={statusCounts}
          team={team}
          onChange={handleFilterChange}
          onClear={() => {
            setFilters(defaultFilters())
            setPage(0)
          }}
        />
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {manualMode ? (
          <ManualMatchPanel
            internalItems={unmatchedInternal}
            externalItems={unmatchedExternal}
            selectedInternal={selectedInternal}
            selectedExternal={selectedExternal}
            suggestedExternalIds={suggestedExternalIds}
            onToggleInternal={id => {
              setSelectedInternal(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onToggleExternal={id => {
              setSelectedExternal(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onCreateMatch={handleCreateMatch}
            onClose={() => {
              setManualMode(false)
              setSelectedInternal(new Set())
              setSelectedExternal(new Set())
            }}
          />
        ) : (
          <>
            {/* Table area */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: 900,
                    tableLayout: 'fixed',
                  }}
                >
                  <colgroup>
                    <col style={{ width: 32 }} />
                    <col style={{ width: 30 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 46 }} />
                    <col style={{ width: 84 }} />
                    <col style={{ width: 68 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 36 }} />
                    <col style={{ width: 56 }} />
                    <col style={{ width: 100 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {/* Checkbox */}
                      <th
                        style={{
                          padding: '6px 8px',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          background: 'rgba(15,17,23,0.6)',
                        }}
                      >
                        <div
                          onClick={toggleSelectAll}
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: 3,
                            border: `1.5px solid ${
                              selectedIds.size === pageItems.length && pageItems.length > 0
                                ? '#3b82f6'
                                : 'rgba(255,255,255,0.2)'
                            }`,
                            background:
                              selectedIds.size === pageItems.length && pageItems.length > 0
                                ? '#3b82f6'
                                : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {selectedIds.size === pageItems.length && pageItems.length > 0 && (
                            <span style={{ fontSize: 8, color: '#0f1117', fontWeight: 900 }}>
                              ✓
                            </span>
                          )}
                        </div>
                      </th>
                      {/* Side */}
                      <SortHeader label="S" field="side" sort={sort} onSort={handleSort} />
                      <SortHeader label="Reference" field="reference" sort={sort} onSort={handleSort} />
                      <SortHeader label="Description" field="description" sort={sort} onSort={handleSort} />
                      <SortHeader label="Amount" field="amount" sort={sort} onSort={handleSort} style={{ textAlign: 'right' }} />
                      <SortHeader label="CCY" field="currency" sort={sort} onSort={handleSort} />
                      <SortHeader label="Date" field="valueDate" sort={sort} onSort={handleSort} />
                      <SortHeader label="Status" field="status" sort={sort} onSort={handleSort} />
                      <SortHeader label="Match Group" field="matchGroupId" sort={sort} onSort={handleSort} />
                      <SortHeader label="Age" field="age" sort={sort} onSort={handleSort} />
                      <th
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '6px 8px',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          background: 'rgba(15,17,23,0.6)',
                        }}
                      >
                        CF
                      </th>
                      <SortHeader label="Assigned" field="assignedTo" sort={sort} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map(item => {
                      const isSelected = selectedIds.has(item.id)
                      const isActive = drawerItemId === item.id
                      const rowBg = isActive
                        ? 'rgba(59,130,246,0.08)'
                        : isSelected
                        ? 'rgba(59,130,246,0.05)'
                        : STATUS_ROW_TINT[item.status]

                      return (
                        <tr
                          key={item.id}
                          onClick={() =>
                            setDrawerItemId(prev => (prev === item.id ? null : item.id))
                          }
                          style={{
                            background: rowBg,
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => {
                            if (!isActive && !isSelected) {
                              ;(e.currentTarget as HTMLElement).style.background =
                                'rgba(255,255,255,0.025)'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive && !isSelected) {
                              ;(e.currentTarget as HTMLElement).style.background = rowBg
                            }
                          }}
                        >
                          {/* Checkbox */}
                          <td
                            style={{ padding: '4px 8px' }}
                            onClick={e => {
                              e.stopPropagation()
                              toggleSelect(item.id)
                            }}
                          >
                            <div
                              style={{
                                width: 13,
                                height: 13,
                                borderRadius: 3,
                                border: `1.5px solid ${
                                  isSelected ? '#3b82f6' : 'rgba(255,255,255,0.15)'
                                }`,
                                background: isSelected ? '#3b82f6' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isSelected && (
                                <span style={{ fontSize: 8, color: '#0f1117', fontWeight: 900 }}>
                                  ✓
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Side icon */}
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <span
                              title={item.side}
                              style={{
                                fontSize: 11,
                                color:
                                  item.side === 'INTERNAL' ? '#3b82f6' : '#06b6d4',
                                fontWeight: 700,
                              }}
                            >
                              {item.side === 'INTERNAL' ? '↓' : '↑'}
                            </span>
                          </td>

                          {/* Reference */}
                          <td style={{ padding: '4px 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: '#3b82f6',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block',
                              }}
                            >
                              {item.reference}
                            </span>
                          </td>

                          {/* Description */}
                          <td style={{ padding: '4px 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                color: '#64748b',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                              }}
                            >
                              {item.description}
                            </span>
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                fontVariantNumeric: 'tabular-nums',
                                color: item.amount < 0 ? '#f87171' : '#f1f5f9',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatCurrency(item.amount, item.currency)}
                            </span>
                          </td>

                          {/* Currency */}
                          <td style={{ padding: '4px 8px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                color: '#475569',
                                fontFamily: 'monospace',
                              }}
                            >
                              {item.currency}
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ padding: '4px 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                color: '#64748b',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDate(item.valueDate)}
                            </span>
                          </td>

                          {/* Status badge */}
                          <td style={{ padding: '4px 8px' }}>
                            <StatusBadge status={item.status} />
                          </td>

                          {/* Match Group ID */}
                          <td style={{ padding: '4px 8px' }}>
                            {item.matchGroupId ? (
                              <span
                                onClick={e => {
                                  e.stopPropagation()
                                  setDrawerItemId(item.id)
                                }}
                                title={item.matchGroupId}
                                style={{
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                  color: '#7c3aed',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'block',
                                  textDecoration: 'underline',
                                  textDecorationColor: 'rgba(124,58,237,0.3)',
                                }}
                              >
                                {item.matchGroupId.slice(0, 14)}…
                              </span>
                            ) : (
                              <span style={{ color: '#1e293b', fontSize: 10 }}>—</span>
                            )}
                          </td>

                          {/* Age */}
                          <td style={{ padding: '4px 8px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontVariantNumeric: 'tabular-nums',
                                color:
                                  item.age > 5
                                    ? '#f87171'
                                    : item.age > 2
                                    ? '#f59e0b'
                                    : '#475569',
                              }}
                            >
                              {item.age}d
                            </span>
                          </td>

                          {/* CF badge */}
                          <td style={{ padding: '4px 6px' }}>
                            {item.isCarryForward && (
                              <CfBadge days={item.carryForwardDays} />
                            )}
                          </td>

                          {/* Assigned */}
                          <td style={{ padding: '4px 8px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                color: item.assignedTo ? '#94a3b8' : '#1e293b',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                              }}
                            >
                              {item.assignedTo ?? '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {pageItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={12}
                          style={{
                            padding: '40px 20px',
                            textAlign: 'center',
                            fontSize: 12,
                            color: '#334155',
                          }}
                        >
                          No items match current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    padding: '6px 14px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                    background: 'rgba(13,15,22,0.8)',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#334155' }}>
                    {filteredItems.length} items · Page {page + 1} of {totalPages} ·{' '}
                    showing {page * PAGE_SIZE + 1}–
                    {Math.min((page + 1) * PAGE_SIZE, filteredItems.length)}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(0)}
                    style={pagerBtn(page === 0)}
                  >
                    «
                  </button>
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    style={pagerBtn(page === 0)}
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p =
                      totalPages <= 7
                        ? i
                        : page < 4
                        ? i
                        : page > totalPages - 4
                        ? totalPages - 7 + i
                        : page - 3 + i
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{
                          ...pagerBtn(false),
                          background:
                            p === page
                              ? 'rgba(59,130,246,0.2)'
                              : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${
                            p === page
                              ? 'rgba(59,130,246,0.4)'
                              : 'rgba(255,255,255,0.08)'
                          }`,
                          color: p === page ? '#06B6D4' : '#475569',
                          fontWeight: p === page ? 700 : 400,
                        }}
                      >
                        {p + 1}
                      </button>
                    )
                  })}
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    style={pagerBtn(page >= totalPages - 1)}
                  >
                    ›
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(totalPages - 1)}
                    style={pagerBtn(page >= totalPages - 1)}
                  >
                    »
                  </button>
                </div>
              )}
            </div>

            {/* Detail drawer */}
            {drawerItem && (
              <ItemDetailDrawer
                item={drawerItem}
                matchGroup={drawerMatchGroup}
                auditEvents={auditTrail}
                exception={drawerException}
                onClose={() => setDrawerItemId(null)}
                onAssignReasonCode={handleAssignReasonCode}
                onAddNote={addNote}
                onCreateWriteOff={createWriteOffRequest}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Pager button style helper ────────────────────────────────────────────────

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: disabled ? '#1e293b' : '#475569',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 11,
    padding: '2px 7px',
    minWidth: 26,
    height: 22,
    opacity: disabled ? 0.5 : 1,
  }
}
