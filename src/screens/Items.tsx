import { useState, useMemo } from 'react'
import { useReconStore } from '../store/reconStore'
import type { ReconItem, ItemStatus } from '../data/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_TABS: { key: ItemStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'UNMATCHED', label: 'Unmatched' },
  { key: 'PROPOSED', label: 'Proposed' },
  { key: 'BREAK', label: 'Breaks' },
  { key: 'WRITE_OFF', label: 'Write-offs' },
]

const STATUS_COLORS: Record<ItemStatus, string> = {
  MATCHED: '#10b981',
  UNMATCHED: '#f59e0b',
  BREAK: '#ef4444',
  PROPOSED: '#8b5cf6',
  WRITE_OFF: '#94a3b8',
}

const STATUS_BG: Record<ItemStatus, string> = {
  MATCHED: 'rgba(16,185,129,0.15)',
  UNMATCHED: 'rgba(245,158,11,0.15)',
  BREAK: 'rgba(239,68,68,0.15)',
  PROPOSED: 'rgba(139,92,246,0.15)',
  WRITE_OFF: 'rgba(148,163,184,0.15)',
}

type SortField = 'valueDate' | 'reference' | 'amount' | 'age'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function sortItems(items: ReconItem[], field: SortField | null, dir: 'asc' | 'desc'): ReconItem[] {
  if (!field) return items
  return [...items].sort((a, b) => {
    let cmp = 0
    if (field === 'valueDate') {
      cmp = a.valueDate.localeCompare(b.valueDate)
    } else if (field === 'reference') {
      cmp = a.reference.localeCompare(b.reference)
    } else if (field === 'amount') {
      cmp = a.amount - b.amount
    } else if (field === 'age') {
      cmp = a.age - b.age
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ItemStatus }) {
  const label = status === 'WRITE_OFF' ? 'Write-off' : status.charAt(0) + status.slice(1).toLowerCase()
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: STATUS_COLORS[status],
        background: STATUS_BG[status],
        border: `1px solid ${STATUS_COLORS[status]}30`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: STATUS_COLORS[status],
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}

function DiffPill({
  label,
  value,
  highlighted,
}: {
  label: string
  value: string
  highlighted: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: highlighted ? '#f97316' : '#f1f5f9',
          background: highlighted ? 'rgba(249,115,22,0.12)' : 'transparent',
          borderRadius: 4,
          padding: highlighted ? '2px 6px' : '2px 0',
          border: highlighted ? '1px solid rgba(249,115,22,0.3)' : 'none',
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface ExpandedDetailProps {
  internalItem: ReconItem
  externalItem: ReconItem
  onAccept?: () => void
  onReject?: () => void
  isProposed: boolean
}

function ExpandedMatchDetail({
  internalItem,
  externalItem,
  onAccept,
  onReject,
  isProposed,
}: ExpandedDetailProps) {
  const amountDiff = Math.abs(internalItem.amount - externalItem.amount)
  const dateDiff =
    Math.abs(
      new Date(internalItem.valueDate).getTime() - new Date(externalItem.valueDate).getTime()
    ) /
    (1000 * 60 * 60 * 24)
  const refDiff = internalItem.reference !== externalItem.reference

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: 'rgba(15,17,23,0.95)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 10,
        padding: 20,
        marginTop: 2,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Match Detail — Side-by-Side Comparison
        </span>
        {isProposed && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onAccept}
              style={{
                padding: '6px 16px',
                borderRadius: 7,
                border: 'none',
                background: '#10b981',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              Accept Match
            </button>
            <button
              onClick={onReject}
              style={{
                padding: '6px 16px',
                borderRadius: 7,
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Internal Ledger
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Bank Statement
        </div>
      </div>

      {/* Comparison rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Reference */}
        <DiffPill label="Reference" value={internalItem.reference} highlighted={refDiff} />
        <DiffPill label="Reference" value={externalItem.reference} highlighted={refDiff} />

        {/* Value Date */}
        <DiffPill label="Value Date" value={formatDate(internalItem.valueDate)} highlighted={dateDiff > 0} />
        <DiffPill label="Value Date" value={formatDate(externalItem.valueDate)} highlighted={dateDiff > 0} />

        {/* Amount */}
        <DiffPill
          label="Amount"
          value={formatCurrency(internalItem.amount, internalItem.currency)}
          highlighted={amountDiff > 0}
        />
        <DiffPill
          label="Amount"
          value={formatCurrency(externalItem.amount, externalItem.currency)}
          highlighted={amountDiff > 0}
        />

        {/* Description */}
        <DiffPill label="Description" value={internalItem.description} highlighted={false} />
        <DiffPill label="Description" value={externalItem.description} highlighted={false} />

        {/* Counterparty */}
        <DiffPill label="Counterparty" value={internalItem.counterparty} highlighted={internalItem.counterparty !== externalItem.counterparty} />
        <DiffPill label="Counterparty" value={externalItem.counterparty} highlighted={internalItem.counterparty !== externalItem.counterparty} />
      </div>

      {/* Diff summary */}
      {(amountDiff > 0 || dateDiff > 0 || refDiff) && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 8,
            display: 'flex',
            gap: 20,
          }}
        >
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>DIFFERENCES:</span>
          {amountDiff > 0 && (
            <span style={{ fontSize: 11, color: '#f97316' }}>
              Amount delta: {formatCurrency(amountDiff, internalItem.currency)}
            </span>
          )}
          {dateDiff > 0 && (
            <span style={{ fontSize: 11, color: '#f97316' }}>
              Date delta: {dateDiff.toFixed(0)}d
            </span>
          )}
          {refDiff && (
            <span style={{ fontSize: 11, color: '#f97316' }}>Reference mismatch</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Manual Match Comparison Panel ───────────────────────────────────────────

interface ManualMatchPanelProps {
  internalItem: ReconItem
  externalItem: ReconItem
  comment: string
  onCommentChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function ManualMatchPanel({
  internalItem,
  externalItem,
  comment,
  onCommentChange,
  onConfirm,
  onCancel,
}: ManualMatchPanelProps) {
  const fields: { label: string; internalVal: string; externalVal: string }[] = [
    {
      label: 'Reference',
      internalVal: internalItem.reference,
      externalVal: externalItem.reference,
    },
    {
      label: 'Value Date',
      internalVal: formatDate(internalItem.valueDate),
      externalVal: formatDate(externalItem.valueDate),
    },
    {
      label: 'Amount',
      internalVal: formatCurrency(internalItem.amount, internalItem.currency),
      externalVal: formatCurrency(externalItem.amount, externalItem.currency),
    },
    {
      label: 'Currency',
      internalVal: internalItem.currency,
      externalVal: externalItem.currency,
    },
    {
      label: 'Counterparty',
      internalVal: internalItem.counterparty,
      externalVal: externalItem.counterparty,
    },
  ]

  return (
    <div
      style={{
        marginTop: 16,
        background: 'rgba(15,17,23,0.97)',
        border: '1px solid rgba(129,140,248,0.4)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#818cf8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Manual Match — Confirm Pairing
        </span>
        <span
          style={{
            fontSize: 11,
            color: '#64748b',
            marginLeft: 4,
          }}
        >
          Review the differences before confirming
        </span>
      </div>

      {/* Column labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 1fr',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Internal Ledger
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Bank Statement
        </div>
      </div>

      {/* Field rows */}
      {fields.map(f => {
        const isDiff = f.internalVal !== f.externalVal
        return (
          <div
            key={f.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 1fr',
              gap: 8,
              marginBottom: 8,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {f.label}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: isDiff ? '#f59e0b' : '#f1f5f9',
                background: isDiff ? 'rgba(245,158,11,0.1)' : 'transparent',
                border: isDiff ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                borderRadius: 5,
                padding: '3px 8px',
              }}
            >
              {f.internalVal}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: isDiff ? '#f59e0b' : '#f1f5f9',
                background: isDiff ? 'rgba(245,158,11,0.1)' : 'transparent',
                border: isDiff ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                borderRadius: 5,
                padding: '3px 8px',
              }}
            >
              {f.externalVal}
            </span>
          </div>
        )
      })}

      {/* Comment / justification */}
      <div style={{ marginTop: 14 }}>
        <textarea
          value={comment}
          onChange={e => onCommentChange(e.target.value)}
          placeholder="Match justification..."
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(26,29,41,0.9)',
            border: '1px solid rgba(129,140,248,0.3)',
            borderRadius: 8,
            color: '#f1f5f9',
            fontSize: 13,
            padding: '10px 12px',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#818cf8',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Create Match
        </button>
      </div>
    </div>
  )
}

// ─── Item Row ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ReconItem
  index: number
  isExpanded: boolean
  matchedPartner: ReconItem | null
  onToggle: () => void
  onAccept: () => void
  onReject: () => void
  // Manual match mode props
  manualMatchMode: boolean
  isSelected: boolean
  onManualSelect: () => void
}

function ItemRow({
  item,
  index,
  isExpanded,
  matchedPartner,
  onToggle,
  onAccept: _onAccept,
  onReject: _onReject,
  manualMatchMode,
  isSelected,
  onManualSelect,
}: ItemRowProps) {
  const isNegative = item.amount < 0
  const canExpand = !!matchedPartner && !manualMatchMode
  const isSelectableInMode = manualMatchMode && item.status === 'UNMATCHED'

  const handleClick = () => {
    if (manualMatchMode) {
      if (isSelectableInMode) onManualSelect()
    } else if (canExpand) {
      onToggle()
    }
  }

  const baseBg = isSelected
    ? 'rgba(129, 140, 248, 0.08)'
    : index % 2 === 0
    ? 'transparent'
    : 'rgba(255,255,255,0.02)'

  const borderStyle = isSelected ? '2px solid #818cf8' : undefined

  return (
    <tr
      onClick={handleClick}
      style={{
        background: baseBg,
        cursor: isSelectableInMode || canExpand ? 'pointer' : 'default',
        transition: 'background 0.15s',
        outline: borderStyle,
        outlineOffset: -2,
        opacity: manualMatchMode && item.status !== 'UNMATCHED' ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        if (isSelectableInMode || canExpand)
          (e.currentTarget as HTMLTableRowElement).style.background = isSelected
            ? 'rgba(129,140,248,0.14)'
            : 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLTableRowElement).style.background = baseBg
      }}
    >
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        {formatDate(item.valueDate)}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#3b82f6', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {item.reference}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#cbd5e1', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.description}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
        {item.currency}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap', color: isNegative ? '#ef4444' : '#f1f5f9' }}>
        {formatCurrency(item.amount, item.currency)}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
        <StatusBadge status={item.status} />
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: item.age > 5 ? '#f59e0b' : '#94a3b8', textAlign: 'center', fontWeight: item.age > 5 ? 600 : 400 }}>
        {item.age}d
      </td>
      {canExpand && (
        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: '#64748b', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </td>
      )}
    </tr>
  )
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

interface SortableThProps {
  label: string
  field: SortField
  currentField: SortField | null
  currentDir: 'asc' | 'desc'
  onSort: (field: SortField) => void
  style?: React.CSSProperties
}

function SortableTh({ label, field, currentField, currentDir, onSort, style }: SortableThProps) {
  const isActive = currentField === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 700,
        color: isActive ? '#818cf8' : '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        ...style,
      }}
    >
      {label}
      {isActive && (
        <span style={{ marginLeft: 4, fontSize: 10 }}>
          {currentDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </th>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Items() {
  const contexts = useReconStore(s => s.contexts)
  const items = useReconStore(s => s.items)
  const activeContextId = useReconStore(s => s.activeContextId)
  const setActiveContext = useReconStore(s => s.setActiveContext)
  const acceptProposedMatch = useReconStore(s => s.acceptProposedMatch)
  const rejectProposedMatch = useReconStore(s => s.rejectProposedMatch)
  const createManualMatch = useReconStore(s => s.createManualMatch)

  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)

  // Manual match state
  const [manualMatchMode, setManualMatchMode] = useState(false)
  const [selectedInternal, setSelectedInternal] = useState<string | null>(null)
  const [selectedExternal, setSelectedExternal] = useState<string | null>(null)
  const [matchComment, setMatchComment] = useState('')

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const contextItems = useMemo(
    () => items.filter(i => i.contextId === activeContextId),
    [items, activeContextId]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return contextItems.filter(item => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchesSearch =
        !q ||
        item.reference.toLowerCase().includes(q) ||
        item.counterparty.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [contextItems, statusFilter, searchQuery])

  const internalItems = useMemo(
    () => sortItems(filtered.filter(i => i.side === 'INTERNAL'), sortField, sortDir),
    [filtered, sortField, sortDir]
  )

  const externalItems = useMemo(
    () => sortItems(filtered.filter(i => i.side === 'EXTERNAL'), sortField, sortDir),
    [filtered, sortField, sortDir]
  )

  // Build matchId -> partner lookup (internal side as primary key)
  const matchPartnerMap = useMemo(() => {
    const map = new Map<string, { internal: ReconItem; external: ReconItem }>()
    const externalByMatchId = new Map<string, ReconItem>()
    for (const item of items) {
      if (item.side === 'EXTERNAL' && item.matchId) externalByMatchId.set(item.matchId, item)
    }
    for (const item of internalItems) {
      if (item.matchId && externalByMatchId.has(item.matchId)) {
        map.set(item.matchId, { internal: item, external: externalByMatchId.get(item.matchId)! })
      }
    }
    return map
  }, [items, internalItems])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: contextItems.length }
    for (const item of contextItems) {
      counts[item.status] = (counts[item.status] ?? 0) + 1
    }
    return counts
  }, [contextItems])

  // Lookup items by id for the match panel
  const allItemsById = useMemo(() => {
    const map = new Map<string, ReconItem>()
    for (const item of items) map.set(item.id, item)
    return map
  }, [items])

  const selectedInternalItem = selectedInternal ? allItemsById.get(selectedInternal) ?? null : null
  const selectedExternalItem = selectedExternal ? allItemsById.get(selectedExternal) ?? null : null
  const bothSelected = !!selectedInternalItem && !!selectedExternalItem

  const handleToggleExpand = (matchId: string) => {
    setExpandedMatchId(prev => (prev === matchId ? null : matchId))
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        // third click clears sort
        setSortField(null)
        setSortDir('asc')
      }
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleToggleManualMode = () => {
    setManualMatchMode(prev => !prev)
    setSelectedInternal(null)
    setSelectedExternal(null)
    setMatchComment('')
    setExpandedMatchId(null)
  }

  const handleSelectInternal = (id: string) => {
    setSelectedInternal(prev => (prev === id ? null : id))
  }

  const handleSelectExternal = (id: string) => {
    setSelectedExternal(prev => (prev === id ? null : id))
  }

  const handleConfirmMatch = () => {
    if (!selectedInternal || !selectedExternal) return
    createManualMatch(selectedInternal, selectedExternal, matchComment)
    setSelectedInternal(null)
    setSelectedExternal(null)
    setMatchComment('')
    setManualMatchMode(false)
  }

  const handleCancelMatch = () => {
    setSelectedInternal(null)
    setSelectedExternal(null)
    setMatchComment('')
  }

  const tableHeaderStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    whiteSpace: 'nowrap',
  }

  const sortProps = { currentField: sortField, currentDir: sortDir, onSort: handleSort }

  return (
    <div style={{ background: '#0f1117', minHeight: '100vh', padding: '24px 28px', color: '#f1f5f9' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Reconciliation Items</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
          Internal ledger vs bank statement — line-by-line matching
        </p>
      </div>

      {/* Top controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Context selector */}
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

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 14 }}>
            &#9906;
          </span>
          <input
            type="text"
            placeholder="Search reference, counterparty, description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(26,29,41,0.9)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#f1f5f9',
              padding: '8px 14px 8px 36px',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Manual Match toggle */}
        <button
          onClick={handleToggleManualMode}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: manualMatchMode ? 'none' : '1px solid rgba(129,140,248,0.4)',
            background: manualMatchMode ? '#818cf8' : 'transparent',
            color: manualMatchMode ? 'white' : '#818cf8',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'all 0.15s',
          }}
        >
          {manualMatchMode ? 'Exit Manual Match' : 'Manual Match'}
        </button>

        {/* Item count */}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{filtered.length}</span> items displayed
        </div>
      </div>

      {/* Manual match mode banner */}
      {manualMatchMode && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            background: 'rgba(129,140,248,0.08)',
            border: '1px solid rgba(129,140,248,0.3)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 13,
            color: '#a5b4fc',
          }}
        >
          <span style={{ fontSize: 16 }}>&#9654;</span>
          <span>
            <strong>Manual Match Mode active.</strong> Click an unmatched item on each side to select it. Matched, proposed, and break items are dimmed and not selectable.
          </span>
          {selectedInternal && (
            <span style={{ marginLeft: 8, color: '#3b82f6', fontWeight: 600 }}>
              Internal selected: {allItemsById.get(selectedInternal)?.reference}
            </span>
          )}
          {selectedExternal && (
            <span style={{ marginLeft: 8, color: '#10b981', fontWeight: 600 }}>
              External selected: {allItemsById.get(selectedExternal)?.reference}
            </span>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          background: 'rgba(26,29,41,0.5)',
          borderRadius: 10,
          padding: 4,
          width: 'fit-content',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {STATUS_TABS.map(tab => {
          const isActive = statusFilter === tab.key
          const count = statusCounts[tab.key] ?? 0
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: isActive ? '#3b82f6' : '#94a3b8',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.label}
              <span
                style={{
                  background: isActive ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#93c5fd' : '#64748b',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Dual-pane layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* ── Internal Ledger ── */}
        <div
          style={{
            background: 'rgba(26,29,41,0.7)',
            border: manualMatchMode ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(59,130,246,0.07)',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#3b82f6',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Internal Ledger</span>
            {manualMatchMode && (
              <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                — select one unmatched item
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
              {internalItems.length} items
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <SortableTh label="Date" field="valueDate" {...sortProps} />
                  <SortableTh label="Reference" field="reference" {...sortProps} />
                  <th style={tableHeaderStyle}>Description</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>CCY</th>
                  <SortableTh label="Amount" field="amount" {...sortProps} style={{ textAlign: 'right' }} />
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Status</th>
                  <SortableTh label="Age" field="age" {...sortProps} style={{ textAlign: 'center' }} />
                </tr>
              </thead>
              <tbody>
                {internalItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                      No items match the current filter
                    </td>
                  </tr>
                ) : (
                  internalItems.map((item, idx) => {
                    const pair = item.matchId ? matchPartnerMap.get(item.matchId) : null
                    const isExpanded = expandedMatchId === item.matchId

                    return (
                      <>
                        <ItemRow
                          key={item.id}
                          item={item}
                          index={idx}
                          isExpanded={isExpanded}
                          matchedPartner={pair?.external ?? null}
                          onToggle={() => handleToggleExpand(item.matchId!)}
                          onAccept={() => acceptProposedMatch(item.matchId!)}
                          onReject={() => rejectProposedMatch(item.matchId!)}
                          manualMatchMode={manualMatchMode}
                          isSelected={selectedInternal === item.id}
                          onManualSelect={() => handleSelectInternal(item.id)}
                        />
                        {isExpanded && pair && (
                          <tr key={`${item.id}-detail`}>
                            <td colSpan={8} style={{ padding: '0 12px 12px' }}>
                              <ExpandedMatchDetail
                                internalItem={pair.internal}
                                externalItem={pair.external}
                                isProposed={item.status === 'PROPOSED'}
                                onAccept={() => acceptProposedMatch(item.matchId!)}
                                onReject={() => rejectProposedMatch(item.matchId!)}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bank Statement ── */}
        <div
          style={{
            background: 'rgba(26,29,41,0.7)',
            border: manualMatchMode ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(16,185,129,0.07)',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Bank Statement</span>
            {manualMatchMode && (
              <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                — select one unmatched item
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
              {externalItems.length} items
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <SortableTh label="Date" field="valueDate" {...sortProps} />
                  <SortableTh label="Reference" field="reference" {...sortProps} />
                  <th style={tableHeaderStyle}>Description</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>CCY</th>
                  <SortableTh label="Amount" field="amount" {...sortProps} style={{ textAlign: 'right' }} />
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Status</th>
                  <SortableTh label="Age" field="age" {...sortProps} style={{ textAlign: 'center' }} />
                </tr>
              </thead>
              <tbody>
                {externalItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                      No items match the current filter
                    </td>
                  </tr>
                ) : (
                  externalItems.map((item, idx) => {
                    const pair = item.matchId ? matchPartnerMap.get(item.matchId) : null
                    const isExpanded = expandedMatchId === item.matchId

                    return (
                      <>
                        <ItemRow
                          key={item.id}
                          item={item}
                          index={idx}
                          isExpanded={isExpanded}
                          matchedPartner={pair?.internal ?? null}
                          onToggle={() => handleToggleExpand(item.matchId!)}
                          onAccept={() => acceptProposedMatch(item.matchId!)}
                          onReject={() => rejectProposedMatch(item.matchId!)}
                          manualMatchMode={manualMatchMode}
                          isSelected={selectedExternal === item.id}
                          onManualSelect={() => handleSelectExternal(item.id)}
                        />
                        {isExpanded && pair && (
                          <tr key={`${item.id}-detail`}>
                            <td colSpan={8} style={{ padding: '0 12px 12px' }}>
                              <ExpandedMatchDetail
                                internalItem={pair.internal}
                                externalItem={pair.external}
                                isProposed={item.status === 'PROPOSED'}
                                onAccept={() => acceptProposedMatch(item.matchId!)}
                                onReject={() => rejectProposedMatch(item.matchId!)}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Match Panel — shown below tables when both sides are selected */}
      {manualMatchMode && bothSelected && selectedInternalItem && selectedExternalItem && (
        <ManualMatchPanel
          internalItem={selectedInternalItem}
          externalItem={selectedExternalItem}
          comment={matchComment}
          onCommentChange={setMatchComment}
          onConfirm={handleConfirmMatch}
          onCancel={handleCancelMatch}
        />
      )}
    </div>
  )
}
