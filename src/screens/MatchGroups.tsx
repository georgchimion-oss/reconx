import { useState, useMemo, useCallback } from 'react'
import { useReconStore } from '../store/reconStore'
import type { MatchGroup, MatchGroupType, MatchGroupStatus, ReconItem } from '../data/types'

// ─── Constants ────────────────────────────────────────────────────────────────

type MatchTypeFilter = 'ALL' | MatchGroupType
type ConfidenceFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
type StatusFilter = 'ALL' | MatchGroupStatus

const MATCH_TYPE_TABS: { key: MatchTypeFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: '1:1', label: '1:1' },
  { key: '1:N', label: '1:N' },
  { key: 'N:1', label: 'N:1' },
  { key: 'N:N', label: 'N:N' },
  { key: 'NET', label: 'NET' },
  { key: 'MANUAL', label: 'MANUAL' },
]

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PENDING_REVIEW', label: 'Pending Review' },
  { key: 'BROKEN', label: 'Broken' },
]

const CONFIDENCE_TABS: { key: ConfidenceFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HIGH', label: 'High >90%' },
  { key: 'MEDIUM', label: 'Med 70–90%' },
  { key: 'LOW', label: 'Low <70%' },
]

const PAGE_SIZE = 20

// ─── Type Badge Colors ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<MatchGroupType, { bg: string; text: string; border: string }> = {
  '1:1': { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  '1:N': { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  'N:1': { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
  'N:N': { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'NET': { bg: 'rgba(6,182,212,0.12)', text: '#06b6d4', border: 'rgba(6,182,212,0.3)' },
  'MANUAL': { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
}

const STATUS_COLORS: Record<MatchGroupStatus, { bg: string; text: string; border: string }> = {
  CONFIRMED: { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.25)' },
  PENDING_REVIEW: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  BROKEN: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD'): string {
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
    hour12: false,
  })
}

function confidenceBand(confidence: number): { color: string; label: string } {
  if (confidence >= 90) return { color: '#10b981', label: 'High' }
  if (confidence >= 70) return { color: '#f59e0b', label: 'Med' }
  return { color: '#ef4444', label: 'Low' }
}

function matchesConfidenceFilter(confidence: number, filter: ConfidenceFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'HIGH') return confidence >= 90
  if (filter === 'MEDIUM') return confidence >= 70 && confidence < 90
  return confidence < 70
}

function matchesSearchFilter(group: MatchGroup, search: string): boolean {
  if (!search.trim()) return true
  const q = search.toLowerCase()
  const searchIn = [
    group.id,
    ...group.internalItems.map(i => i.reference),
    ...group.externalItems.map(i => i.reference),
    group.matchedBy,
    group.ruleUsed,
  ]
  return searchIn.some(s => s.toLowerCase().includes(q))
}

// ─── Shared styles ────────────────────────────────────────────────────────────

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
  height: 28,
}

// ─── Segmented Button Group ───────────────────────────────────────────────────

interface SegmentedGroupProps<T extends string> {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}

function SegmentedGroup<T extends string>({ options, value, onChange }: SegmentedGroupProps<T>) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: 'rgba(15,17,23,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: 2,
      }}
    >
      {options.map(opt => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              color: active ? '#f1f5f9' : '#64748b',
              background: active ? 'rgba(59,130,246,0.22)' : 'transparent',
              border: active ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
              borderRadius: 4,
              padding: '3px 9px',
              cursor: 'pointer',
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: MatchGroupType }) {
  const c = TYPE_COLORS[type]
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {type}
    </span>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MatchGroupStatus }) {
  const c = STATUS_COLORS[status]
  const label = status === 'PENDING_REVIEW' ? 'PENDING' : status
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const { color } = confidenceBand(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 48,
          height: 4,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 2,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value.toFixed(0)}%
      </span>
    </div>
  )
}

// ─── Item Row (in detail panel) ───────────────────────────────────────────────

function ItemRow({ item, highlight }: { item: ReconItem; highlight?: boolean }) {
  const isNeg = item.amount < 0
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: highlight ? 'rgba(245,158,11,0.07)' : 'transparent',
        border: highlight ? '1px solid rgba(245,158,11,0.15)' : '1px solid transparent',
        marginBottom: 2,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#3b82f6',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          minWidth: 120,
          flexShrink: 0,
        }}
      >
        {item.reference}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isNeg ? '#f87171' : '#f1f5f9',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          marginLeft: 'auto',
          flexShrink: 0,
        }}
      >
        {formatCurrency(item.amount, item.currency)}
      </span>
      <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {formatDate(item.valueDate)}
      </span>
    </div>
  )
}

// ─── Match Group Card ─────────────────────────────────────────────────────────

interface MatchGroupCardProps {
  group: MatchGroup
  isSupervisor: boolean
  isSelected: boolean
  onToggleSelect: () => void
  breakGroupId: string | null
  onRequestBreak: () => void
  onCancelBreak: () => void
  onConfirmBreak: (reason: string) => void
  onAddComment: (comment: string) => void
}

function MatchGroupCard({
  group,
  isSupervisor,
  isSelected,
  onToggleSelect,
  breakGroupId,
  onRequestBreak,
  onCancelBreak,
  onConfirmBreak,
  onAddComment,
}: MatchGroupCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [breakReason, setBreakReason] = useState('')
  const [commentText, setCommentText] = useState('')

  const showBreakForm = breakGroupId === group.id
  const isBroken = group.status === 'BROKEN'

  const internalTotal = group.internalTotal
  const externalTotal = group.externalTotal
  const diff = group.netDifference
  const hasDiff = diff > 0.01

  const recentComments = [...group.comments].reverse().slice(0, 3)

  const handleSubmitComment = () => {
    if (!commentText.trim()) return
    onAddComment(commentText.trim())
    setCommentText('')
  }

  const handleSubmitBreak = () => {
    if (!breakReason.trim()) return
    onConfirmBreak(breakReason.trim())
    setBreakReason('')
  }

  const borderColor = isBroken
    ? 'rgba(239,68,68,0.25)'
    : group.status === 'PENDING_REVIEW'
    ? 'rgba(245,158,11,0.2)'
    : 'rgba(255,255,255,0.07)'

  const leftBorderColor = isBroken
    ? '#ef4444'
    : group.status === 'PENDING_REVIEW'
    ? '#f59e0b'
    : TYPE_COLORS[group.type].text

  return (
    <div
      style={{
        background: isSelected ? 'rgba(59,130,246,0.05)' : 'rgba(20,22,32,0.85)',
        border: `1px solid ${isSelected ? 'rgba(59,130,246,0.3)' : borderColor}`,
        borderLeft: `3px solid ${isSelected ? '#3b82f6' : leftBorderColor}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* ── Header row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.05)' : 'none',
          flexWrap: 'wrap',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => { e.stopPropagation(); onToggleSelect() }}
          onClick={e => e.stopPropagation()}
          style={{ width: 13, height: 13, cursor: 'pointer', flexShrink: 0, accentColor: '#3b82f6' }}
          aria-label={`Select group ${group.id}`}
        />

        {/* Group ID */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#3b82f6',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {group.id}
        </span>

        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10, flexShrink: 0 }}>|</span>

        <TypeBadge type={group.type} />

        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10, flexShrink: 0 }}>|</span>

        <ConfidenceBar value={group.confidence} />

        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10, flexShrink: 0 }}>|</span>

        <StatusBadge status={group.status} />

        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10, flexShrink: 0 }}>|</span>

        {/* Pass */}
        <span
          style={{
            fontSize: 10,
            color: '#64748b',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Pass:{' '}
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{group.pass}</span>
        </span>

        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10, flexShrink: 0 }}>|</span>

        {/* Matched by */}
        <span
          style={{
            fontSize: 10,
            color: '#64748b',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          By:{' '}
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{group.matchedBy}</span>
        </span>

        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10, flexShrink: 0 }}>|</span>

        {/* Date */}
        <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatDateTime(group.matchedAt)}
        </span>

        {/* Item count pills */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: '#64748b',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#06B6D4' }}>{group.internalItems.length}i</span>
          {' '}:{' '}
          <span style={{ color: '#a78bfa' }}>{group.externalItems.length}e</span>
        </span>

        {/* Expand chevron */}
        <span
          style={{
            fontSize: 11,
            color: '#475569',
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          ▾
        </span>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div>
          {/* Side-by-side comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 72px 1fr',
              gap: 0,
              padding: '10px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Internal items */}
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#06B6D4',
                  letterSpacing: '0.1em',
                  marginBottom: 6,
                  paddingBottom: 4,
                  borderBottom: '1px solid rgba(6,182,212,0.2)',
                }}
              >
                INTERNAL ({group.internalItems.length})
              </div>
              {group.internalItems.map(item => (
                <ItemRow key={item.id} item={item} />
              ))}
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.06em' }}>TOTAL</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatCurrency(internalTotal)}
                </span>
              </div>
            </div>

            {/* Net difference column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '0 4px',
              }}
            >
              <div
                style={{
                  width: 1,
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                }}
              />
              <div
                style={{
                  background: hasDiff ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${hasDiff ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.25)'}`,
                  borderRadius: 6,
                  padding: '5px 6px',
                  textAlign: 'center',
                  minWidth: 60,
                }}
              >
                <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.06em', marginBottom: 2 }}>
                  NET DIFF
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: hasDiff ? '#f59e0b' : '#10b981',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hasDiff ? formatCurrency(diff) : 'ZERO'}
                </div>
                {group.toleranceApplied != null && group.toleranceApplied > 0 && (
                  <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>
                    tol {formatCurrency(group.toleranceApplied)}
                  </div>
                )}
              </div>
              <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* External items */}
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#a78bfa',
                  letterSpacing: '0.1em',
                  marginBottom: 6,
                  paddingBottom: 4,
                  borderBottom: '1px solid rgba(167,139,250,0.2)',
                }}
              >
                EXTERNAL ({group.externalItems.length})
              </div>
              {group.externalItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  highlight={hasDiff && group.externalItems.length === 1}
                />
              ))}
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.06em' }}>TOTAL</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatCurrency(externalTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Match lineage + fields */}
          <div
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 10, color: '#475569' }}>
              Rule:{' '}
              <span style={{ color: '#64748b', fontStyle: 'italic' }}>{group.ruleUsed}</span>
            </span>
            {group.fieldsMatched.length > 0 && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 10 }}>|</span>
                <span style={{ fontSize: 10, color: '#475569' }}>Fields matched:</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {group.fieldsMatched.map(f => (
                    <span
                      key={f}
                      style={{
                        fontSize: 9,
                        color: '#06B6D4',
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}
            {isBroken && group.brokenBy && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 10 }}>|</span>
                <span style={{ fontSize: 10, color: '#ef4444' }}>
                  Broken by{' '}
                  <span style={{ fontWeight: 600 }}>{group.brokenBy}</span>
                  {group.brokenAt && ` at ${formatDateTime(group.brokenAt)}`}
                  {group.breakReason && (
                    <span style={{ color: '#f87171' }}> — {group.breakReason}</span>
                  )}
                </span>
              </>
            )}
          </div>

          {/* Actions row */}
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              borderBottom:
                recentComments.length > 0 || showBreakForm
                  ? '1px solid rgba(255,255,255,0.05)'
                  : 'none',
            }}
          >
            {/* Break Apart */}
            {isSupervisor && !isBroken && !showBreakForm && (
              <button
                onClick={onRequestBreak}
                aria-label="Break apart match group"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#ef4444',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  letterSpacing: '0.03em',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Break Apart
              </button>
            )}

            {/* Add comment */}
            {!isBroken && (
              <div style={{ display: 'flex', gap: 5, flex: '1 1 220px', minWidth: 0 }}>
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmitComment() }}
                  placeholder="Add comment..."
                  aria-label="Add comment to match group"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'rgba(15,17,23,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 5,
                    color: '#cbd5e1',
                    fontSize: 11,
                    padding: '4px 8px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  aria-label="Submit comment"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: commentText.trim() ? '#3b82f6' : '#334155',
                    background: commentText.trim()
                      ? 'rgba(59,130,246,0.12)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${commentText.trim() ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 5,
                    padding: '4px 10px',
                    cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.12s',
                  }}
                >
                  Post
                </button>
              </div>
            )}
          </div>

          {/* Break reason form */}
          {showBreakForm && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(239,68,68,0.04)',
                borderBottom: '1px solid rgba(239,68,68,0.1)',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Break reason:
              </span>
              <input
                value={breakReason}
                onChange={e => setBreakReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmitBreak() }}
                placeholder="Enter reason for breaking this group..."
                aria-label="Break reason"
                autoFocus
                style={{
                  flex: 1,
                  minWidth: 180,
                  background: 'rgba(15,17,23,0.8)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 5,
                  color: '#cbd5e1',
                  fontSize: 11,
                  padding: '4px 8px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSubmitBreak}
                disabled={!breakReason.trim()}
                aria-label="Confirm break"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: breakReason.trim() ? '#ef4444' : '#475569',
                  background: breakReason.trim()
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${breakReason.trim() ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: breakReason.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.12s',
                }}
              >
                Confirm Break
              </button>
              <button
                onClick={onCancelBreak}
                aria-label="Cancel break"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#64748b',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Comments */}
          {recentComments.length > 0 && (
            <div style={{ padding: '6px 12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span
                style={{
                  fontSize: 9,
                  color: '#475569',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                COMMENTS ({group.comments.length})
              </span>
              {recentComments.map((c, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                  }}
                >
                  {c}
                </div>
              ))}
              {group.comments.length > 3 && (
                <span style={{ fontSize: 9, color: '#475569' }}>
                  +{group.comments.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = '#f1f5f9',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(20,22,32,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '10px 14px',
        flex: '1 1 160px',
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MatchGroups() {
  const {
    matchGroups,
    contexts,
    activeContextId,
    setActiveContext,
    activeRole,
    breakMatchGroup,
    addGroupComment,
  } = useReconStore()

  const isSupervisor = activeRole === 'SUPERVISOR'

  // ── Filter state ──
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('ALL')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBreakReason, setBulkBreakReason] = useState('')
  const [showBulkBreakForm, setShowBulkBreakForm] = useState(false)

  // ── Individual break form state ──
  const [breakGroupId, setBreakGroupId] = useState<string | null>(null)

  // ── Filtered groups ──
  const filtered = useMemo(() => {
    return matchGroups.filter(g => {
      if (g.contextId !== activeContextId) return false
      if (matchTypeFilter !== 'ALL' && g.type !== matchTypeFilter) return false
      if (statusFilter !== 'ALL' && g.status !== statusFilter) return false
      if (!matchesConfidenceFilter(g.confidence, confidenceFilter)) return false
      if (!matchesSearchFilter(g, searchQuery)) return false
      return true
    })
  }, [matchGroups, activeContextId, matchTypeFilter, statusFilter, confidenceFilter, searchQuery])

  // ── Stats ──
  const stats = useMemo(() => {
    const contextGroups = matchGroups.filter(g => g.contextId === activeContextId)
    const total = contextGroups.length
    const typeCounts = {
      '1:1': 0, '1:N': 0, 'N:1': 0, 'N:N': 0, 'NET': 0, 'MANUAL': 0,
    } as Record<MatchGroupType, number>
    let totalConf = 0
    let pendingReview = 0
    for (const g of contextGroups) {
      typeCounts[g.type] = (typeCounts[g.type] ?? 0) + 1
      totalConf += g.confidence
      if (g.status === 'PENDING_REVIEW') pendingReview++
    }
    const avgConf = total > 0 ? totalConf / total : 0
    return { total, typeCounts, avgConf, pendingReview }
  }, [matchGroups, activeContextId])

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset page when filters change
  const handleFilterChange = useCallback(() => setPage(1), [])

  // ── Handlers ──
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginated.map(g => g.id)))
    }
  }

  const handleBulkBreak = () => {
    if (!bulkBreakReason.trim()) return
    for (const id of selectedIds) {
      const g = matchGroups.find(mg => mg.id === id)
      if (g && g.status !== 'BROKEN') {
        breakMatchGroup(id, bulkBreakReason.trim())
      }
    }
    setSelectedIds(new Set())
    setBulkBreakReason('')
    setShowBulkBreakForm(false)
  }

  const breakableSelected = [...selectedIds].filter(id => {
    const g = matchGroups.find(mg => mg.id === id)
    return g && g.status !== 'BROKEN'
  })

  const typeBreakdownStr = (['1:1', '1:N', 'N:1', 'N:N', 'NET', 'MANUAL'] as MatchGroupType[])
    .filter(t => stats.typeCounts[t] > 0)
    .map(t => `${t}: ${stats.typeCounts[t]}`)
    .join(' · ')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 20px',
        minHeight: '100%',
        background: '#0f1117',
      }}
    >
      {/* ── Page title ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#f1f5f9',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Match Groups
          </h1>
          <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0', letterSpacing: '0.03em' }}>
            Reconciliation match group viewer — {filtered.length} groups shown
          </p>
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#475569',
            background: 'rgba(20,22,32,0.85)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 5,
            padding: '3px 9px',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {activeRole}
        </div>
      </div>

      {/* ── Summary Stats Bar ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatCard
          label="TOTAL GROUPS"
          value={stats.total}
          sub={`${filtered.length} shown after filters`}
          color="#3b82f6"
        />
        <StatCard
          label="BY TYPE"
          value={Object.values(stats.typeCounts).filter(Boolean).length > 0 ? stats.typeCounts['1:1'] || 0 : 0}
          sub={typeBreakdownStr || 'No groups'}
          color="#f1f5f9"
        />
        <StatCard
          label="AVG CONFIDENCE"
          value={`${stats.avgConf.toFixed(1)}%`}
          sub={
            stats.avgConf >= 90 ? 'High confidence' :
            stats.avgConf >= 70 ? 'Medium confidence' :
            'Low confidence — review needed'
          }
          color={
            stats.avgConf >= 90 ? '#10b981' :
            stats.avgConf >= 70 ? '#f59e0b' :
            '#ef4444'
          }
        />
        <StatCard
          label="PENDING REVIEW"
          value={stats.pendingReview}
          sub={stats.pendingReview > 0 ? 'Require analyst action' : 'All reviewed'}
          color={stats.pendingReview > 0 ? '#f59e0b' : '#10b981'}
        />
      </div>

      {/* ── Filter Bar ── */}
      <div
        style={{
          background: 'rgba(20,22,32,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Context selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
            CONTEXT
          </span>
          <select
            value={activeContextId}
            onChange={e => {
              setActiveContext(e.target.value)
              setPage(1)
              setSelectedIds(new Set())
            }}
            aria-label="Select reconciliation context"
            style={inlineSelectStyle}
          >
            {contexts.map(ctx => (
              <option key={ctx.id} value={ctx.id}>
                {ctx.name}
              </option>
            ))}
          </select>
        </div>

        <span style={{ color: 'rgba(255,255,255,0.07)', fontSize: 14, flexShrink: 0 }}>|</span>

        {/* Match type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
            TYPE
          </span>
          <SegmentedGroup
            options={MATCH_TYPE_TABS}
            value={matchTypeFilter}
            onChange={v => { setMatchTypeFilter(v); handleFilterChange() }}
          />
        </div>

        <span style={{ color: 'rgba(255,255,255,0.07)', fontSize: 14, flexShrink: 0 }}>|</span>

        {/* Confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
            CONF
          </span>
          <SegmentedGroup
            options={CONFIDENCE_TABS}
            value={confidenceFilter}
            onChange={v => { setConfidenceFilter(v); handleFilterChange() }}
          />
        </div>

        <span style={{ color: 'rgba(255,255,255,0.07)', fontSize: 14, flexShrink: 0 }}>|</span>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
            STATUS
          </span>
          <SegmentedGroup
            options={STATUS_TABS}
            value={statusFilter}
            onChange={v => { setStatusFilter(v); handleFilterChange() }}
          />
        </div>

        <span style={{ color: 'rgba(255,255,255,0.07)', fontSize: 14, flexShrink: 0 }}>|</span>

        {/* Search */}
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); handleFilterChange() }}
          placeholder="Search by ref, group ID, user..."
          aria-label="Search match groups"
          style={{
            flex: '1 1 160px',
            minWidth: 140,
            background: 'rgba(15,17,23,0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5,
            color: '#cbd5e1',
            fontSize: 11,
            padding: '4px 8px',
            outline: 'none',
            fontFamily: 'inherit',
            height: 26,
          }}
        />

        {(matchTypeFilter !== 'ALL' || confidenceFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setMatchTypeFilter('ALL')
              setConfidenceFilter('ALL')
              setStatusFilter('ALL')
              setSearchQuery('')
              setPage(1)
            }}
            aria-label="Clear all filters"
            style={{
              fontSize: 10,
              color: '#64748b',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 5,
              padding: '3px 9px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Bulk Actions Toolbar ── */}
      {selectedIds.size > 0 && (
        <div
          style={{
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 8,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 11, color: '#06B6D4', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {selectedIds.size} selected
          </span>
          <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 10 }}>|</span>
          {isSupervisor && breakableSelected.length > 0 && !showBulkBreakForm && (
            <button
              onClick={() => setShowBulkBreakForm(true)}
              aria-label="Break all selected groups"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#ef4444',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 5,
                padding: '4px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
              }}
            >
              Break All Selected ({breakableSelected.length})
            </button>
          )}
          {showBulkBreakForm && (
            <>
              <input
                value={bulkBreakReason}
                onChange={e => setBulkBreakReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBulkBreak() }}
                placeholder="Reason for bulk break..."
                autoFocus
                aria-label="Bulk break reason"
                style={{
                  flex: '1 1 200px',
                  minWidth: 160,
                  background: 'rgba(15,17,23,0.8)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 5,
                  color: '#cbd5e1',
                  fontSize: 11,
                  padding: '4px 8px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleBulkBreak}
                disabled={!bulkBreakReason.trim()}
                aria-label="Confirm bulk break"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: bulkBreakReason.trim() ? '#ef4444' : '#475569',
                  background: bulkBreakReason.trim()
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${bulkBreakReason.trim() ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: bulkBreakReason.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => { setShowBulkBreakForm(false); setBulkBreakReason('') }}
                aria-label="Cancel bulk break"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#64748b',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => { setSelectedIds(new Set()); setShowBulkBreakForm(false); setBulkBreakReason('') }}
            aria-label="Deselect all"
            style={{
              fontSize: 10,
              color: '#64748b',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 5,
              padding: '3px 9px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              marginLeft: 'auto',
            }}
          >
            Deselect All
          </button>
        </div>
      )}

      {/* ── Table header (sticky-style) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '5px 12px',
          fontSize: 9,
          color: '#475569',
          letterSpacing: '0.08em',
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <input
          type="checkbox"
          checked={paginated.length > 0 && selectedIds.size === paginated.length}
          onChange={handleSelectAll}
          aria-label="Select all visible groups"
          style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#3b82f6' }}
        />
        <span style={{ minWidth: 100 }}>GROUP ID</span>
        <span style={{ minWidth: 48 }}>TYPE</span>
        <span style={{ minWidth: 80 }}>CONFIDENCE</span>
        <span style={{ minWidth: 80 }}>STATUS</span>
        <span style={{ minWidth: 60 }}>PASS</span>
        <span style={{ minWidth: 80 }}>MATCHED BY</span>
        <span style={{ marginLeft: 'auto' }}>ITEMS</span>
      </div>

      {/* ── Group list ── */}
      {paginated.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#475569',
            fontSize: 13,
            background: 'rgba(20,22,32,0.5)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>--</div>
          <div style={{ fontWeight: 600, color: '#64748b' }}>No match groups found</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Adjust your filters or run matching for this context</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {paginated.map(group => (
            <MatchGroupCard
              key={group.id}
              group={group}
              isSupervisor={isSupervisor}
              isSelected={selectedIds.has(group.id)}
              onToggleSelect={() => handleToggleSelect(group.id)}
              breakGroupId={breakGroupId}
              onRequestBreak={() => setBreakGroupId(group.id)}
              onCancelBreak={() => setBreakGroupId(null)}
              onConfirmBreak={reason => {
                breakMatchGroup(group.id, reason)
                setBreakGroupId(null)
              }}
              onAddComment={comment => addGroupComment(group.id, comment)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 0',
          }}
        >
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            aria-label="First page"
            style={pagerBtnStyle(safePage === 1)}
          >
            «
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
            style={pagerBtnStyle(safePage === 1)}
          >
            ‹
          </button>

          {/* Page number buttons */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 7) {
              pageNum = i + 1
            } else if (safePage <= 4) {
              pageNum = i + 1
            } else if (safePage >= totalPages - 3) {
              pageNum = totalPages - 6 + i
            } else {
              pageNum = safePage - 3 + i
            }
            const active = pageNum === safePage
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={active ? 'page' : undefined}
                style={{
                  ...pagerBtnStyle(false),
                  background: active ? 'rgba(59,130,246,0.2)' : undefined,
                  border: active ? '1px solid rgba(59,130,246,0.35)' : undefined,
                  color: active ? '#06B6D4' : undefined,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {pageNum}
              </button>
            )
          })}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            aria-label="Next page"
            style={pagerBtnStyle(safePage === totalPages)}
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            aria-label="Last page"
            style={pagerBtnStyle(safePage === totalPages)}
          >
            »
          </button>

          <span
            style={{
              fontSize: 10,
              color: '#475569',
              marginLeft: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Page {safePage} of {totalPages} — {filtered.length} total
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Pager button style helper ────────────────────────────────────────────────

function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    minWidth: 28,
    height: 28,
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(20,22,32,0.85)',
    color: disabled ? '#334155' : '#94a3b8',
    fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    transition: 'all 0.12s',
    opacity: disabled ? 0.4 : 1,
  }
}
