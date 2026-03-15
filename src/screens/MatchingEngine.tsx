import { useState, useCallback, type ReactNode } from 'react'
import { useReconStore } from '../store/reconStore'
import type { MatchingPassResult, MatchResult, MatchRule } from '../data/types'

// ─── Constants ───────────────────────────────────────────────

const COLORS = {
  bg: '#0f1117',
  card: 'rgba(26, 29, 41, 0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
  radius: '12px',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  accent: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#a855f7',
}

const PASS_COLORS: Record<string, string> = {
  EXACT: COLORS.success,
  TOLERANCE: '#3b82f6',
  FUZZY: COLORS.warning,
  AI_SUGGESTED: COLORS.purple,
}

const PASS_LABELS: Record<string, string> = {
  EXACT: 'Exact Match',
  TOLERANCE: 'Tolerance Match',
  FUZZY: 'Fuzzy Match',
  AI_SUGGESTED: 'AI-Suggested',
}

const PASS_BG: Record<string, string> = {
  EXACT: 'rgba(16, 185, 129, 0.08)',
  TOLERANCE: 'rgba(59, 130, 246, 0.08)',
  FUZZY: 'rgba(245, 158, 11, 0.08)',
  AI_SUGGESTED: 'rgba(168, 85, 247, 0.08)',
}

// ─── Helpers ─────────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms'
  return `${ms}ms`
}

// ─── Sub-components ──────────────────────────────────────────

interface BadgeProps {
  label: string
  color: string
  bg: string
}

function Badge({ label, color, bg }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background: bg,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  )
}

interface ProgressBarProps {
  value: number
  color: string
  height?: number
  animated?: boolean
}

function ProgressBar({ value, color, height = 8, animated = false }: ProgressBarProps) {
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: '100%',
          borderRadius: 999,
          background: color,
          transition: animated ? 'width 0.6s cubic-bezier(0.4,0,0.2,1)' : 'none',
          boxShadow: `0 0 12px ${color}60`,
        }}
      />
    </div>
  )
}

// ─── Rule Card ───────────────────────────────────────────────

interface RuleCardProps {
  rule: MatchRule
  isSuggested?: boolean
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}

function RuleCard({ rule, isSuggested = false, onAccept, onReject }: RuleCardProps) {
  const passColor = PASS_COLORS[rule.type] ?? COLORS.accent
  const passBg = PASS_BG[rule.type] ?? 'rgba(99, 102, 241, 0.08)'

  return (
    <div
      style={{
        background: isSuggested ? 'rgba(245,158,11,0.04)' : COLORS.card,
        border: isSuggested ? '1px solid rgba(245,158,11,0.25)' : COLORS.border,
        borderRadius: COLORS.radius,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      {/* Pass number circle */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: passBg,
          border: `1.5px solid ${passColor}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: passColor,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        P{rule.pass}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ color: COLORS.textPrimary, fontWeight: 600, fontSize: 13 }}>
            {PASS_LABELS[rule.type] ?? rule.type}
          </span>
          {isSuggested ? (
            <Badge label="AI Suggested" color={COLORS.warning} bg="rgba(245,158,11,0.12)" />
          ) : (
            <Badge label="Active" color={COLORS.success} bg="rgba(16,185,129,0.12)" />
          )}
        </div>
        <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
          {rule.description}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rule.fields.map(f => (
            <span
              key={f}
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#a5b4fc',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {f}
            </span>
          ))}
          {rule.tolerance != null && (
            <span
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: COLORS.warning,
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              tol: ±{rule.tolerance}
            </span>
          )}
          {rule.dateRange != null && (
            <span
              style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#a5b4fc',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              ±{rule.dateRange}d
            </span>
          )}
        </div>
      </div>

      {/* Action buttons for suggested rules */}
      {isSuggested && onAccept && onReject && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onAccept(rule.id)}
            style={{
              padding: '5px 14px',
              borderRadius: 7,
              border: `1px solid ${COLORS.success}50`,
              background: 'rgba(16,185,129,0.12)',
              color: COLORS.success,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Accept
          </button>
          <button
            onClick={() => onReject(rule.id)}
            style={{
              padding: '5px 14px',
              borderRadius: 7,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)',
              color: COLORS.danger,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Pass Result Card ─────────────────────────────────────────

interface PassResultCardProps {
  passResult: MatchingPassResult
  totalItems: number
  onMatchClick: (match: MatchResult) => void
}

function PassResultCard({ passResult, totalItems, onMatchClick }: PassResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const color = PASS_COLORS[passResult.pass] ?? COLORS.accent
  const pct = totalItems > 0 ? (passResult.matchesFound * 2 / totalItems) * 100 : 0
  const passLabel = PASS_LABELS[passResult.pass] ?? passResult.pass

  return (
    <div
      style={{
        background: COLORS.card,
        border: COLORS.border,
        borderRadius: COLORS.radius,
        overflow: 'hidden',
      }}
    >
      {/* Pass header */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
          cursor: passResult.matchesFound > 0 ? 'pointer' : 'default',
        }}
        onClick={() => passResult.matchesFound > 0 && setExpanded(e => !e)}
      >
        {/* Pass badge */}
        <div
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `${color}15`,
            border: `2px solid ${color}40`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>PASS</span>
          <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{passResult.passNumber}</span>
        </div>

        {/* Pass info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{passLabel}</span>
            <span style={{ color, fontWeight: 700, fontSize: 20 }}>{passResult.matchesFound}</span>
            <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>
              pairs matched ({pct.toFixed(1)}% of total)
            </span>
          </div>
          <ProgressBar value={pct} color={color} height={6} animated />
        </div>

        {/* Meta */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ color: COLORS.textSecondary, fontSize: 11, marginBottom: 3 }}>
            {formatDuration(passResult.duration)}
          </div>
          {passResult.matchesFound > 0 && (
            <div style={{ color: color, fontSize: 11, fontWeight: 600 }}>
              {expanded ? 'Hide matches' : 'View matches'}
            </div>
          )}
        </div>
      </div>

      {/* Rule used */}
      <div style={{ padding: '8px 20px 12px', borderBottom: expanded && passResult.matchesFound > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>Rule: </span>
        <span style={{ color: '#a5b4fc', fontSize: 11, fontFamily: 'monospace' }}>
          {passResult.matches[0]?.ruleUsed ?? '—'}
        </span>
      </div>

      {/* Match rows */}
      {expanded && passResult.matchesFound > 0 && (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {passResult.matches.slice(0, 50).map((match, i) => (
            <div
              key={match.id}
              onClick={() => onMatchClick(match)}
              style={{
                padding: '10px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: 12,
                alignItems: 'center',
                borderBottom: i < passResult.matches.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Internal */}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: COLORS.textPrimary, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {match.internalItem.reference}
                </div>
                <div style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                  {match.internalItem.valueDate} · {formatAmount(match.internalItem.amount, match.internalItem.currency)}
                </div>
              </div>

              {/* External */}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: COLORS.textPrimary, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {match.externalItem.reference}
                </div>
                <div style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                  {match.externalItem.valueDate} · {formatAmount(match.externalItem.amount, match.externalItem.currency)}
                </div>
              </div>

              {/* Confidence */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: match.confidence >= 90 ? COLORS.success : match.confidence >= 70 ? COLORS.warning : COLORS.danger,
                  }}
                >
                  {match.confidence}%
                </span>
                {match.pass === 'AI_SUGGESTED' && (
                  <div style={{ color: COLORS.purple, fontSize: 10, fontWeight: 600 }}>AI</div>
                )}
              </div>
            </div>
          ))}
          {passResult.matchesFound > 50 && (
            <div style={{ padding: '10px 20px', color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' }}>
              + {passResult.matchesFound - 50} more matches
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Match Detail Panel ───────────────────────────────────────

interface MatchDetailPanelProps {
  match: MatchResult
  onClose: () => void
  onAccept: (matchId: string) => void
  onReject: (matchId: string) => void
}

function MatchDetailPanel({ match, onClose, onAccept, onReject }: MatchDetailPanelProps) {
  const int = match.internalItem
  const ext = match.externalItem
  const isAI = match.pass === 'AI_SUGGESTED'
  const color = PASS_COLORS[match.pass] ?? COLORS.accent

  const amountDiff = Math.abs(int.amount - ext.amount)
  const dateDiff = Math.abs(
    new Date(int.valueDate).getTime() - new Date(ext.valueDate).getTime()
  ) / 86400000
  const hasAmountDiff = amountDiff > 0
  const hasDateDiff = dateDiff > 0
  const hasRefDiff = int.reference !== ext.reference

  function DiffHighlight({ children, hasDiff }: { children: ReactNode; hasDiff: boolean }) {
    return (
      <span
        style={{
          background: hasDiff ? 'rgba(245,158,11,0.18)' : 'transparent',
          borderRadius: 4,
          padding: hasDiff ? '1px 4px' : '0',
          color: hasDiff ? COLORS.warning : COLORS.textPrimary,
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        {children}
      </span>
    )
  }

  function FieldRow({ label, intVal, extVal, hasDiff }: { label: string; intVal: string; extVal: string; hasDiff: boolean }) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {label}
          </div>
          <DiffHighlight hasDiff={hasDiff}>{intVal}</DiffHighlight>
        </div>
        <div>
          <div style={{ color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {label}
          </div>
          <DiffHighlight hasDiff={hasDiff}>{extVal}</DiffHighlight>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          pointerEvents: 'auto',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: 560,
          height: '100vh',
          background: '#13161f',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                  display: 'inline-block',
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
              <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 16 }}>
                Match Detail
              </span>
              <Badge label={PASS_LABELS[match.pass] ?? match.pass} color={color} bg={`${color}18`} />
            </div>
            {isAI && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 8,
                  background: 'rgba(168,85,247,0.12)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  color: COLORS.purple,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 14 }}>&#9670;</span>
                Proposed Match — {match.confidence}% confidence
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: COLORS.border,
              borderRadius: 8,
              color: COLORS.textSecondary,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Column labels */}
        <div
          style={{
            padding: '12px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Internal Ledger
          </div>
          <div style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            External (Bank)
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: '0 24px', flex: 1 }}>
          <FieldRow
            label="Reference"
            intVal={int.reference}
            extVal={ext.reference}
            hasDiff={hasRefDiff}
          />
          <FieldRow
            label="Value Date"
            intVal={int.valueDate}
            extVal={ext.valueDate}
            hasDiff={hasDateDiff}
          />
          <FieldRow
            label="Amount"
            intVal={formatAmount(int.amount, int.currency)}
            extVal={formatAmount(ext.amount, ext.currency)}
            hasDiff={hasAmountDiff}
          />
          <FieldRow
            label="Description"
            intVal={int.description}
            extVal={ext.description}
            hasDiff={false}
          />
          <FieldRow
            label="Counterparty"
            intVal={int.counterparty}
            extVal={ext.counterparty}
            hasDiff={int.counterparty !== ext.counterparty}
          />
        </div>

        {/* Diff summary */}
        {(hasAmountDiff || hasDateDiff) && (
          <div
            style={{
              margin: '0 24px 16px',
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <div style={{ color: COLORS.warning, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Differences Detected
            </div>
            {hasAmountDiff && (
              <div style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 }}>
                Amount variance:{' '}
                <span style={{ color: COLORS.warning, fontFamily: 'monospace' }}>
                  {formatAmount(amountDiff, int.currency)}
                </span>
                {match.toleranceApplied != null && (
                  <span style={{ color: COLORS.textSecondary }}> (within tolerance)</span>
                )}
              </div>
            )}
            {hasDateDiff && (
              <div style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                Date offset:{' '}
                <span style={{ color: COLORS.warning, fontFamily: 'monospace' }}>
                  {dateDiff.toFixed(0)} day{dateDiff !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fields matched */}
        <div style={{ margin: '0 24px 16px' }}>
          <div style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Fields Matched
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {match.fieldsMatched.map(f => (
              <span
                key={f}
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  color: COLORS.success,
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* AI action buttons */}
        {isAI && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => { onAccept(match.id); onClose() }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: `1px solid ${COLORS.success}50`,
                background: 'rgba(16,185,129,0.12)',
                color: COLORS.success,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.12)')}
            >
              Accept Match
            </button>
            <button
              onClick={() => { onReject(match.id); onClose() }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
                color: COLORS.danger,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
            >
              Reject
            </button>
          </div>
        )}

        {!isAI && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                border: COLORS.border,
                background: 'rgba(255,255,255,0.05)',
                color: COLORS.textPrimary,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary Bar ──────────────────────────────────────────────

interface SummaryBarProps {
  result: {
    totalItems: number
    totalMatched: number
    totalExceptions: number
    overallMatchRate: number
    passes: MatchingPassResult[]
  }
}

function SummaryBar({ result }: SummaryBarProps) {
  const aiPass = result.passes.find(p => p.pass === 'AI_SUGGESTED')
  const aiProposed = aiPass?.matchesFound ?? 0

  const stats = [
    { label: 'Total Items', value: result.totalItems.toLocaleString(), color: COLORS.textPrimary },
    {
      label: 'Total Matched',
      value: `${result.totalMatched.toLocaleString()} (${result.overallMatchRate.toFixed(1)}%)`,
      color: COLORS.success,
    },
    {
      label: 'Exceptions',
      value: result.totalExceptions.toLocaleString(),
      color: result.totalExceptions > 0 ? COLORS.danger : COLORS.success,
    },
    {
      label: 'AI Proposals',
      value: `${aiProposed} awaiting review`,
      color: COLORS.purple,
    },
  ]

  return (
    <div
      style={{
        background: COLORS.card,
        border: COLORS.border,
        borderRadius: COLORS.radius,
        padding: '16px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            padding: '0 20px',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            textAlign: 'center',
          }}
        >
          <div style={{ color: s.color, fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
            {s.value}
          </div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Screen ─────────────────────────────────────────────

export default function MatchingEngine() {
  const contexts = useReconStore(s => s.contexts)
  const activeContextId = useReconStore(s => s.activeContextId)
  const matchRules = useReconStore(s => s.matchRules)
  const suggestedRules = useReconStore(s => s.suggestedRules)
  const matchingResults = useReconStore(s => s.matchingResults)
  const isMatchingRunning = useReconStore(s => s.isMatchingRunning)
  const matchingProgress = useReconStore(s => s.matchingProgress)
  const runMatchingForContext = useReconStore(s => s.runMatchingForContext)
  const acceptProposedMatch = useReconStore(s => s.acceptProposedMatch)
  const rejectProposedMatch = useReconStore(s => s.rejectProposedMatch)
  const activateSuggestedRule = useReconStore(s => s.activateSuggestedRule)
  const setActiveContext = useReconStore(s => s.setActiveContext)

  const [selectedContextId, setSelectedContextId] = useState(activeContextId)
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set())

  const selectedContext = contexts.find(c => c.id === selectedContextId)
  const activeRules = matchRules.filter(r => r.contextId === selectedContextId && r.isActive)
  const contextSuggestedRules = suggestedRules.filter(
    r => r.contextId === selectedContextId && !r.isActive && !rejectedSuggestions.has(r.id)
  )
  const result = matchingResults.get(selectedContextId)

  const handleContextChange = (id: string) => {
    setSelectedContextId(id)
    setActiveContext(id)
  }

  const handleRun = useCallback(async () => {
    if (isMatchingRunning) return
    await runMatchingForContext(selectedContextId)
  }, [isMatchingRunning, runMatchingForContext, selectedContextId])

  const handleRejectSuggestion = (id: string) => {
    setRejectedSuggestions(prev => new Set([...prev, id]))
  }

  const healthColor = (h: string) =>
    h === 'GREEN' ? COLORS.success : h === 'AMBER' ? COLORS.warning : COLORS.danger

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        color: COLORS.textPrimary,
        padding: '28px 32px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: COLORS.textPrimary,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Matching Engine
        </h1>
        <p style={{ color: COLORS.textSecondary, margin: '6px 0 0', fontSize: 14 }}>
          Multi-pass reconciliation with exact, tolerance, fuzzy, and AI-assisted matching
        </p>
      </div>

      {/* Context Selector */}
      <div
        style={{
          background: COLORS.card,
          border: COLORS.border,
          borderRadius: COLORS.radius,
          padding: '18px 24px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.textSecondary, flexShrink: 0 }}>
          Reconciliation Context
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <select
            value={selectedContextId}
            onChange={e => handleContextChange(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: COLORS.textPrimary,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: 36,
            }}
          >
            {contexts.map(ctx => (
              <option key={ctx.id} value={ctx.id} style={{ background: '#13161f' }}>
                {ctx.name}
              </option>
            ))}
          </select>
        </div>

        {/* Context meta chips */}
        {selectedContext && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 8,
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#a5b4fc',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {selectedContext.currency}
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: COLORS.border,
                color: COLORS.textSecondary,
                fontSize: 12,
              }}
            >
              {selectedContext.type}
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 8,
                background: `${healthColor(selectedContext.healthStatus)}12`,
                border: `1px solid ${healthColor(selectedContext.healthStatus)}35`,
                color: healthColor(selectedContext.healthStatus),
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {selectedContext.matchRate}% matched
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: COLORS.border,
                color: COLORS.textSecondary,
                fontSize: 12,
              }}
            >
              {selectedContext.totalItems.toLocaleString()} items
            </span>
          </div>
        )}
      </div>

      {/* Two column layout: rules left, run + results right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* LEFT: Match Rules Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary }}>
              Match Rules
            </span>
            <Badge
              label={`${activeRules.length} active`}
              color={COLORS.success}
              bg="rgba(16,185,129,0.12)"
            />
          </div>

          {activeRules.map(rule => (
            <RuleCard key={rule.id} rule={rule} />
          ))}

          {contextSuggestedRules.length > 0 && (
            <>
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.warning }}>
                  Suggested Rules
                </span>
                <Badge
                  label={`${contextSuggestedRules.length} new`}
                  color={COLORS.warning}
                  bg="rgba(245,158,11,0.12)"
                />
              </div>
              <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: '0 0 4px', lineHeight: 1.5 }}>
                Auto-detected patterns from your data. Accept to add to the matching pipeline.
              </p>
              {contextSuggestedRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isSuggested
                  onAccept={activateSuggestedRule}
                  onReject={handleRejectSuggestion}
                />
              ))}
            </>
          )}
        </div>

        {/* RIGHT: Run button + results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Run Matching CTA */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: COLORS.radius,
              padding: '28px 32px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background glow */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 300,
                height: 300,
                background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative' }}>
              {!isMatchingRunning ? (
                <>
                  <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: '0 0 20px' }}>
                    Run the full 4-pass matching pipeline against{' '}
                    <strong style={{ color: COLORS.textPrimary }}>
                      {selectedContext?.totalItems.toLocaleString() ?? '—'} items
                    </strong>{' '}
                    in {selectedContext?.name ?? 'this context'}.
                  </p>
                  <button
                    onClick={handleRun}
                    style={{
                      padding: '16px 56px',
                      borderRadius: 12,
                      border: '1px solid rgba(99,102,241,0.5)',
                      background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                      color: '#fff',
                      fontSize: 17,
                      fontWeight: 800,
                      cursor: 'pointer',
                      letterSpacing: '-0.01em',
                      boxShadow: '0 0 40px rgba(99,102,241,0.4), 0 4px 24px rgba(99,102,241,0.25)',
                      transition: 'transform 0.12s, box-shadow 0.12s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 0 60px rgba(99,102,241,0.5), 0 6px 32px rgba(99,102,241,0.35)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 0 40px rgba(99,102,241,0.4), 0 4px 24px rgba(99,102,241,0.25)'
                    }}
                  >
                    <span style={{ fontSize: 20 }}>&#9654;</span>
                    Run Matching
                  </button>
                  {result && (
                    <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: '14px 0 0' }}>
                      Last run: {result.overallMatchRate.toFixed(1)}% match rate across {result.passes.length} passes
                    </p>
                  )}
                </>
              ) : (
                /* Running state */
                <div style={{ padding: '8px 0' }}>
                  <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                    Running Matching Pipeline...
                  </div>
                  <div style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 20 }}>
                    Processing {selectedContext?.totalItems.toLocaleString() ?? '—'} items across 4 passes
                  </div>

                  {/* Main progress bar */}
                  <div style={{ marginBottom: 12 }}>
                    <ProgressBar value={matchingProgress} color={COLORS.accent} height={10} animated />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: COLORS.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    <span>
                      Pass {Math.ceil((matchingProgress / 100) * 4)} of 4:{' '}
                      {matchingProgress < 25
                        ? 'Exact Match'
                        : matchingProgress < 50
                        ? 'Tolerance Match'
                        : matchingProgress < 75
                        ? 'Fuzzy Match'
                        : 'AI Analysis'}
                    </span>
                    <span style={{ color: COLORS.accent, fontWeight: 700 }}>
                      {Math.round(matchingProgress)}%
                    </span>
                  </div>

                  {/* Per-pass progress indicators */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
                    {(['EXACT', 'TOLERANCE', 'FUZZY', 'AI_SUGGESTED'] as const).map((pass, i) => {
                      const passThreshold = (i + 1) * 25
                      const isComplete = matchingProgress >= passThreshold
                      const isActive = matchingProgress >= i * 25 && matchingProgress < passThreshold
                      const passColor = PASS_COLORS[pass]
                      return (
                        <div
                          key={pass}
                          style={{
                            padding: '8px',
                            borderRadius: 8,
                            background: isComplete
                              ? `${passColor}15`
                              : isActive
                              ? `${passColor}0a`
                              : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isComplete ? passColor + '40' : isActive ? passColor + '25' : 'rgba(255,255,255,0.06)'}`,
                            textAlign: 'center',
                            transition: 'all 0.3s',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isComplete ? passColor : isActive ? passColor + 'bb' : COLORS.textSecondary,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {isComplete ? '✓ ' : isActive ? '... ' : ''}{PASS_LABELS[pass].split(' ')[0]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pass Results */}
          {result && !isMatchingRunning && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary }}>
                  Pass Results
                </span>
                <Badge
                  label={`${result.overallMatchRate.toFixed(1)}% overall`}
                  color={result.overallMatchRate >= 90 ? COLORS.success : result.overallMatchRate >= 75 ? COLORS.warning : COLORS.danger}
                  bg={
                    result.overallMatchRate >= 90
                      ? 'rgba(16,185,129,0.12)'
                      : result.overallMatchRate >= 75
                      ? 'rgba(245,158,11,0.12)'
                      : 'rgba(239,68,68,0.12)'
                  }
                />
              </div>

              <div style={{ position: 'relative' }}>
                {/* Vertical waterfall connector */}
                <div style={{
                  position: 'absolute',
                  left: 22,
                  top: 22,
                  bottom: 22,
                  width: 2,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 1,
                  zIndex: 0,
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
                  {result.passes.map(pass => (
                    <PassResultCard
                      key={pass.pass}
                      passResult={pass}
                      totalItems={result.totalItems}
                      onMatchClick={setSelectedMatch}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Summary Bar */}
          {result && !isMatchingRunning && (
            <SummaryBar result={result} />
          )}

          {/* Empty state */}
          {!result && !isMatchingRunning && (
            <div
              style={{
                background: COLORS.card,
                border: COLORS.border,
                borderRadius: COLORS.radius,
                padding: '48px 32px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: 22,
                }}
              >
                &#9670;
              </div>
              <div style={{ color: COLORS.textPrimary, fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
                No matching results yet
              </div>
              <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                Click "Run Matching" to execute the 4-pass pipeline and see detailed results for each pass.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match Detail Side Panel */}
      {selectedMatch && (
        <MatchDetailPanel
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onAccept={acceptProposedMatch}
          onReject={rejectProposedMatch}
        />
      )}
    </div>
  )
}
