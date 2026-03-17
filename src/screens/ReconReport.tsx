import { useMemo, useState } from 'react'
import { useReconStore } from '../store/reconStore'
import type {
  ReconContext,
  BalancePool,
  MatchGroup,
  ReconItem,
  Exception,
  AuditEvent,
  MatchGroupType,
  MatchPassType,
} from '../data/types'

// ─── Print Styles ─────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { background: #fff !important; color: #000 !important; font-family: 'Times New Roman', serif !important; }
  .no-print { display: none !important; }
  .print-card {
    background: #fff !important;
    border: 1px solid #ccc !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .print-text-primary { color: #000 !important; }
  .print-text-secondary { color: #333 !important; }
  .print-text-muted { color: #666 !important; }
  .print-table th { background: #f0f0f0 !important; color: #000 !important; }
  .print-table td { color: #111 !important; border-color: #ddd !important; }
  .print-header { border-bottom: 2px solid #000 !important; }
}
`

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#0f1117',
  card: 'rgba(26, 29, 41, 0.80)',
  border: 'rgba(255,255,255,0.09)',
  primary: '#f1f5f9',
  secondary: '#94a3b8',
  muted: '#64748b',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.14)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.14)',
  red: '#f87171',
  redDim: 'rgba(248,113,113,0.14)',
  blue: '#06B6D4',
  blueDim: 'rgba(6,182,212,0.14)',
  purple: '#a78bfa',
  purpleDim: 'rgba(167,139,250,0.14)',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.08)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, ccy = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: ccy,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  })
}

function matchRateColor(r: number): string {
  return r >= 95 ? C.green : r >= 85 ? C.amber : C.red
}

// ─── Shared Style Objects ─────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 20,
}

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
}

const TH: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: C.secondary,
  borderBottom: `1px solid rgba(255,255,255,0.04)`,
  verticalAlign: 'middle',
}

const TABLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

// ─── Small Badge ──────────────────────────────────────────────────────────────

function Badge({
  label,
  color,
  bg,
}: {
  label: string
  color: string
  bg: string
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${color}30`,
        borderRadius: 5,
        padding: '2px 8px',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function PassBadge({ pass }: { pass: MatchPassType }) {
  const map: Record<MatchPassType, { color: string; bg: string }> = {
    EXACT: { color: C.green, bg: C.greenDim },
    TOLERANCE: { color: C.blue, bg: C.blueDim },
    FUZZY: { color: C.amber, bg: C.amberDim },
    AI_SUGGESTED: { color: C.purple, bg: C.purpleDim },
    MANUAL: { color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' },
  }
  const { color, bg } = map[pass]
  return <Badge label={pass.replace('_', ' ')} color={color} bg={bg} />
}

function TypeBadge({ type }: { type: MatchGroupType }) {
  const map: Record<MatchGroupType, { color: string; bg: string }> = {
    '1:1': { color: C.green, bg: C.greenDim },
    '1:N': { color: C.blue, bg: C.blueDim },
    'N:1': { color: C.blue, bg: C.blueDim },
    'N:N': { color: C.amber, bg: C.amberDim },
    NET: { color: C.purple, bg: C.purpleDim },
    MANUAL: { color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' },
  }
  const { color, bg } = map[type]
  return <Badge label={type} color={color} bg={bg} />
}

function SlaChip({ breached }: { breached: boolean }) {
  return (
    <Badge
      label={breached ? 'SLA BREACH' : 'ON TIME'}
      color={breached ? C.red : C.green}
      bg={breached ? C.redDim : C.greenDim}
    />
  )
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
      <button
        className="no-print"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: C.primary,
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          {count !== undefined && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.blue,
                background: C.blueDim,
                borderRadius: 10,
                padding: '2px 9px',
              }}
            >
              {count}
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: 12, color: C.muted }}>{subtitle}</span>
          )}
        </div>
        <span style={{ fontSize: 16, color: C.muted }}>{open ? '▲' : '▼'}</span>
      </button>
      {/* Always render children for print */}
      <div
        style={{ padding: '0 24px 20px', display: open ? 'block' : 'none' }}
        className="collapsible-body"
      >
        {children}
      </div>
      {/* Print-only always-visible content */}
      <style>{`@media print { .collapsible-body { display: block !important; } }`}</style>
    </div>
  )
}

// ─── Match Group Detail Modal (inline drawer) ─────────────────────────────────

function MatchGroupDetail({
  group,
  onClose,
}: {
  group: MatchGroup
  onClose: () => void
}) {
  const allInternal = group.internalItems
  const allExternal = group.externalItems

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 640,
          maxWidth: '95vw',
          height: '100vh',
          overflowY: 'auto',
          background: '#1a1d29',
          borderLeft: `2px solid ${C.border}`,
          padding: '28px 28px 40px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>
              Match Group — {group.id}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {fmtDateTime(group.matchedAt)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.muted,
              fontSize: 20,
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            x
          </button>
        </div>

        {/* Metadata */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            background: C.surface,
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 20,
          }}
        >
          {[
            { label: 'Type', value: <TypeBadge type={group.type} /> },
            { label: 'Pass', value: <PassBadge pass={group.pass} /> },
            { label: 'Confidence', value: `${group.confidence}%` },
            { label: 'Status', value: group.status },
            { label: 'Matched By', value: group.matchedBy },
            { label: 'Rule Used', value: group.ruleUsed },
            { label: 'Fields Matched', value: group.fieldsMatched.join(', ') },
            {
              label: 'Tolerance',
              value: group.toleranceApplied !== null ? fmtCurrency(group.toleranceApplied) : 'None',
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>
                {typeof value === 'string' ? value : value}
              </div>
            </div>
          ))}
        </div>

        {/* Net summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            { label: 'Internal Total', value: fmtCurrency(group.internalTotal), color: C.blue },
            { label: 'External Total', value: fmtCurrency(group.externalTotal), color: C.amber },
            {
              label: 'Net Difference',
              value: fmtCurrency(group.netDifference),
              color: group.netDifference === 0 ? C.green : C.red,
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{ background: C.surface, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}
            >
              <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Internal Items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...SECTION_HEADER, color: C.blue }}>
            Internal Items ({allInternal.length})
          </div>
          <table style={TABLE} className="print-table">
            <thead>
              <tr>
                {['Reference', 'Date', 'Amount', 'Description'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allInternal.map(item => (
                <tr key={item.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', color: C.blue, fontSize: 11 }}>{item.reference}</td>
                  <td style={TD}>{fmtDate(item.valueDate)}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: item.amount >= 0 ? C.green : C.red }}>
                    {fmtCurrency(item.amount, item.currency)}
                  </td>
                  <td style={{ ...TD, color: C.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* External Items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...SECTION_HEADER, color: C.amber }}>
            External Items ({allExternal.length})
          </div>
          <table style={TABLE} className="print-table">
            <thead>
              <tr>
                {['Reference', 'Date', 'Amount', 'Description'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allExternal.map(item => (
                <tr key={item.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', color: C.amber, fontSize: 11 }}>{item.reference}</td>
                  <td style={TD}>{fmtDate(item.valueDate)}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: item.amount >= 0 ? C.green : C.red }}>
                    {fmtCurrency(item.amount, item.currency)}
                  </td>
                  <td style={{ ...TD, color: C.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Comments */}
        {group.comments.length > 0 && (
          <div>
            <div style={SECTION_HEADER}>Comments</div>
            {group.comments.map((c, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  color: C.secondary,
                  background: C.surface,
                  borderRadius: 7,
                  padding: '8px 12px',
                  marginBottom: 6,
                  lineHeight: 1.5,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        )}

        {/* Break info */}
        {group.status === 'BROKEN' && group.breakReason && (
          <div
            style={{
              marginTop: 16,
              background: C.redDim,
              border: `1px solid ${C.red}30`,
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>GROUP BROKEN</div>
            <div style={{ fontSize: 12, color: C.secondary }}>{group.breakReason}</div>
            {group.brokenBy && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                By {group.brokenBy} at {group.brokenAt ? fmtDateTime(group.brokenAt) : '—'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section 2: Executive Summary Table ──────────────────────────────────────

function ExecSummaryTable({
  contexts,
  items,
  balancePools,
  activeContextId,
  onSelectContext,
}: {
  contexts: ReconContext[]
  items: ReconItem[]
  balancePools: BalancePool[]
  activeContextId: string
  onSelectContext: (id: string) => void
}) {
  const rows = useMemo(() => {
    return contexts.map(ctx => {
      const ctxItems = items.filter(i => i.contextId === ctx.id)
      const matched = ctxItems.filter(i => i.status === 'MATCHED' || i.status === 'PROPOSED').length
      const pool = balancePools.find(bp => bp.contextId === ctx.id)
      return {
        ctx,
        total: ctxItems.length,
        matched,
        rate: ctxItems.length > 0 ? (matched / ctxItems.length) * 100 : ctx.matchRate,
        inProof: pool?.proofStatus === 'IN_PROOF',
        signedOff: pool?.signOffStatus === 'APPROVED',
        pool,
      }
    })
  }, [contexts, items, balancePools])

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0)
    const matched = rows.reduce((s, r) => s + r.matched, 0)
    return { total, matched, rate: total > 0 ? (matched / total) * 100 : 0 }
  }, [rows])

  const unmatchedValue = useMemo(() => {
    return items
      .filter(i => i.status === 'UNMATCHED' || i.status === 'BREAK')
      .reduce((s, i) => s + Math.abs(i.amount), 0)
  }, [items])

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>Executive Summary</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Total unmatched value:{' '}
          <span style={{ color: unmatchedValue > 0 ? C.red : C.green, fontWeight: 700 }}>
            {fmtCurrency(unmatchedValue)}
          </span>
        </div>
      </div>

      <table style={TABLE} className="print-table">
        <thead>
          <tr>
            {['Context', 'Type', 'Currency', 'Total Items', 'Matched', 'Match Rate', 'In Proof', 'Signed Off'].map(h => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ctx, total, matched, rate, inProof, signedOff }) => (
            <tr
              key={ctx.id}
              onClick={() => onSelectContext(ctx.id)}
              style={{
                cursor: 'pointer',
                background: activeContextId === ctx.id ? C.blueDim : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                if (activeContextId !== ctx.id)
                  (e.currentTarget as HTMLTableRowElement).style.background = C.surface
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLTableRowElement).style.background =
                  activeContextId === ctx.id ? C.blueDim : 'transparent'
              }}
            >
              <td style={{ ...TD, fontWeight: 600, color: C.primary, maxWidth: 220 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ctx.name}
                </div>
              </td>
              <td style={TD}>{ctx.type}</td>
              <td style={{ ...TD, fontFamily: 'monospace' }}>{ctx.currency}</td>
              <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{total.toLocaleString()}</td>
              <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{matched.toLocaleString()}</td>
              <td style={TD}>
                <span style={{ fontWeight: 700, color: matchRateColor(rate), fontVariantNumeric: 'tabular-nums' }}>
                  {rate.toFixed(1)}%
                </span>
              </td>
              <td style={TD}>
                <Badge
                  label={inProof ? 'IN PROOF' : 'OUT'}
                  color={inProof ? C.green : C.red}
                  bg={inProof ? C.greenDim : C.redDim}
                />
              </td>
              <td style={TD}>
                <Badge
                  label={signedOff ? 'APPROVED' : 'PENDING'}
                  color={signedOff ? C.green : C.amber}
                  bg={signedOff ? C.greenDim : C.amberDim}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${C.border}` }}>
            <td
              colSpan={3}
              style={{ ...TD, fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase' }}
            >
              Overall
            </td>
            <td style={{ ...TD, fontWeight: 700, color: C.primary, fontVariantNumeric: 'tabular-nums' }}>
              {totals.total.toLocaleString()}
            </td>
            <td style={{ ...TD, fontWeight: 700, color: C.primary, fontVariantNumeric: 'tabular-nums' }}>
              {totals.matched.toLocaleString()}
            </td>
            <td style={TD}>
              <span style={{ fontWeight: 800, color: matchRateColor(totals.rate), fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                {totals.rate.toFixed(1)}%
              </span>
            </td>
            <td colSpan={2} style={TD} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Section 3: Match Group Breakdown ────────────────────────────────────────

const GROUP_TYPES: MatchGroupType[] = ['1:1', '1:N', 'N:1', 'N:N', 'NET', 'MANUAL']
const PASSES: MatchPassType[] = ['EXACT', 'TOLERANCE', 'FUZZY', 'AI_SUGGESTED', 'MANUAL']

function MatchGroupBreakdown({
  contextId,
  matchGroups,
  onDrillType,
  onDrillPass,
  drillType,
  drillPass,
  onSelectGroup,
}: {
  contextId: string
  matchGroups: MatchGroup[]
  onDrillType: (t: MatchGroupType | null) => void
  onDrillPass: (p: MatchPassType | null) => void
  drillType: MatchGroupType | null
  drillPass: MatchPassType | null
  onSelectGroup: (g: MatchGroup) => void
}) {
  const ctxGroups = useMemo(
    () => matchGroups.filter(g => g.contextId === contextId && g.status !== 'BROKEN'),
    [matchGroups, contextId]
  )

  // By type
  const byType = useMemo(() => {
    return GROUP_TYPES.map(t => {
      const grps = ctxGroups.filter(g => g.type === t)
      const itemCount = grps.reduce(
        (s, g) => s + g.internalItems.length + g.externalItems.length,
        0
      )
      const value = grps.reduce((s, g) => s + Math.abs(g.internalTotal), 0)
      return { type: t, groupCount: grps.length, itemCount, value }
    }).filter(r => r.groupCount > 0)
  }, [ctxGroups])

  // By pass
  const byPass = useMemo(() => {
    const total = ctxGroups.length || 1
    return PASSES.map(p => {
      const grps = ctxGroups.filter(g => g.pass === p)
      return { pass: p, count: grps.length, pct: (grps.length / total) * 100 }
    }).filter(r => r.count > 0)
  }, [ctxGroups])

  // Drilled down groups
  const drilledGroups = useMemo(() => {
    let result = ctxGroups
    if (drillType) result = result.filter(g => g.type === drillType)
    if (drillPass) result = result.filter(g => g.pass === drillPass)
    return result
  }, [ctxGroups, drillType, drillPass])

  if (ctxGroups.length === 0) {
    return (
      <div style={{ ...CARD, color: C.muted, fontStyle: 'italic', fontSize: 13 }}>
        No match groups for selected context.
      </div>
    )
  }

  return (
    <div style={CARD}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.primary, marginBottom: 20 }}>
        Match Group Breakdown
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 10, fontWeight: 400 }}>
          Click a row to drill down
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* By Type */}
        <div>
          <div style={SECTION_HEADER}>By Match Type</div>
          <table style={TABLE} className="print-table">
            <thead>
              <tr>
                {['Type', 'Groups', 'Items', 'Value'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byType.map(row => (
                <tr
                  key={row.type}
                  onClick={() => onDrillType(drillType === row.type ? null : row.type)}
                  style={{
                    cursor: 'pointer',
                    background: drillType === row.type ? C.blueDim : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (drillType !== row.type)
                      (e.currentTarget as HTMLTableRowElement).style.background = C.surface
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      drillType === row.type ? C.blueDim : 'transparent'
                  }}
                >
                  <td style={TD}><TypeBadge type={row.type} /></td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{row.groupCount}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{row.itemCount}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11 }}>
                    {fmtCurrency(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Pass */}
        <div>
          <div style={SECTION_HEADER}>By Match Pass</div>
          <table style={TABLE} className="print-table">
            <thead>
              <tr>
                {['Pass', 'Groups', '% of Total'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byPass.map(row => (
                <tr
                  key={row.pass}
                  onClick={() => onDrillPass(drillPass === row.pass ? null : row.pass)}
                  style={{
                    cursor: 'pointer',
                    background: drillPass === row.pass ? C.blueDim : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (drillPass !== row.pass)
                      (e.currentTarget as HTMLTableRowElement).style.background = C.surface
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      drillPass === row.pass ? C.blueDim : 'transparent'
                  }}
                >
                  <td style={TD}><PassBadge pass={row.pass} /></td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{row.count}</td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          height: 6,
                          width: Math.max(4, (row.pct / 100) * 100),
                          background: C.blue,
                          borderRadius: 3,
                          opacity: 0.7,
                        }}
                      />
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                        {row.pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilled-down group list */}
      {(drillType || drillPass) && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: C.secondary }}>
              Drill-down: {drilledGroups.length} group{drilledGroups.length !== 1 ? 's' : ''}
              {drillType && <span style={{ marginLeft: 8 }}><TypeBadge type={drillType} /></span>}
              {drillPass && <span style={{ marginLeft: 8 }}><PassBadge pass={drillPass} /></span>}
            </div>
            <button
              className="no-print"
              onClick={() => { onDrillType(null); onDrillPass(null) }}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: C.muted,
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Clear filter
            </button>
          </div>
          <table style={TABLE} className="print-table">
            <thead>
              <tr>
                {['Group ID', 'Type', 'Pass', 'Confidence', 'Internal Total', 'External Total', 'Net Diff', 'Matched By', 'Status'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drilledGroups.slice(0, 50).map(g => (
                <tr
                  key={g.id}
                  onClick={() => onSelectGroup(g)}
                  style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surfaceHover }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  <td style={{ ...TD, fontFamily: 'monospace', color: C.blue, fontSize: 11 }}>
                    <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{g.id}</span>
                  </td>
                  <td style={TD}><TypeBadge type={g.type} /></td>
                  <td style={TD}><PassBadge pass={g.pass} /></td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: g.confidence >= 90 ? C.green : g.confidence >= 70 ? C.amber : C.red }}>
                      {g.confidence}%
                    </span>
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11 }}>
                    {fmtCurrency(g.internalTotal)}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11 }}>
                    {fmtCurrency(g.externalTotal)}
                  </td>
                  <td
                    style={{
                      ...TD,
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: g.netDifference === 0 ? C.green : C.red,
                    }}
                  >
                    {fmtCurrency(g.netDifference)}
                  </td>
                  <td style={{ ...TD, fontSize: 11 }}>{g.matchedBy}</td>
                  <td style={TD}>
                    <Badge
                      label={g.status}
                      color={g.status === 'CONFIRMED' ? C.green : g.status === 'PENDING_REVIEW' ? C.amber : C.red}
                      bg={g.status === 'CONFIRMED' ? C.greenDim : g.status === 'PENDING_REVIEW' ? C.amberDim : C.redDim}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {drilledGroups.length > 50 && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'right' }}>
              Showing 50 of {drilledGroups.length} groups
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section 4: Matched Items List ───────────────────────────────────────────

function MatchedItemsList({
  items,
  matchGroups,
  contextId,
  onSelectGroup,
}: {
  items: ReconItem[]
  matchGroups: MatchGroup[]
  contextId: string
  onSelectGroup: (g: MatchGroup) => void
}) {
  const matched = useMemo(
    () =>
      items
        .filter(i => i.contextId === contextId && (i.status === 'MATCHED' || i.status === 'PROPOSED'))
        .slice(0, 200),
    [items, contextId]
  )

  const groupById = useMemo(() => {
    const m = new Map<string, MatchGroup>()
    for (const g of matchGroups) m.set(g.id, g)
    return m
  }, [matchGroups])

  return (
    <CollapsibleSection
      title="Matched Items"
      count={matched.length}
      subtitle="Click a Match Group ID to inspect the full group"
    >
      {matched.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>No matched items.</div>
      ) : (
        <table style={TABLE} className="print-table">
          <thead>
            <tr>
              {['Side', 'Reference', 'Amount', 'Match Group ID', 'Type', 'Confidence', 'Pass'].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matched.map(item => {
              const group = item.matchGroupId ? groupById.get(item.matchGroupId) : undefined
              return (
                <tr key={item.id} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  <td style={TD}>
                    <Badge
                      label={item.side}
                      color={item.side === 'INTERNAL' ? C.blue : C.amber}
                      bg={item.side === 'INTERNAL' ? C.blueDim : C.amberDim}
                    />
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: C.primary }}>
                    {item.reference}
                  </td>
                  <td
                    style={{
                      ...TD,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: item.amount >= 0 ? C.green : C.red,
                      fontSize: 11,
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmtCurrency(item.amount, item.currency)}
                  </td>
                  <td style={TD}>
                    {group ? (
                      <button
                        onClick={() => onSelectGroup(group)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: C.blue,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {item.matchGroupId}
                      </button>
                    ) : (
                      <span style={{ color: C.muted, fontFamily: 'monospace', fontSize: 11 }}>
                        {item.matchGroupId ?? '—'}
                      </span>
                    )}
                  </td>
                  <td style={TD}>
                    {group ? <TypeBadge type={group.type} /> : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>
                    {group ? (
                      <span style={{ color: group.confidence >= 90 ? C.green : group.confidence >= 70 ? C.amber : C.red }}>
                        {group.confidence}%
                      </span>
                    ) : '—'}
                  </td>
                  <td style={TD}>
                    {item.matchPass ? <PassBadge pass={item.matchPass} /> : <span style={{ color: C.muted }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {matched.length === 200 && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'right' }}>
          Showing first 200 matched items
        </div>
      )}
    </CollapsibleSection>
  )
}

// ─── Section 5: Unmatched Items / Exceptions ─────────────────────────────────

function UnmatchedSection({
  exceptions,
  items,
  contextId,
}: {
  exceptions: Exception[]
  items: ReconItem[]
  contextId: string
}) {
  const ctxExceptions = useMemo(
    () =>
      exceptions
        .filter(e => e.contextId === contextId)
        .sort((a, b) => b.item.age - a.item.age),
    [exceptions, contextId]
  )

  const unmatchedRaw = useMemo(
    () =>
      items
        .filter(
          i =>
            i.contextId === contextId &&
            (i.status === 'UNMATCHED' || i.status === 'BREAK') &&
            !exceptions.some(e => e.itemId === i.id)
        )
        .sort((a, b) => b.age - a.age)
        .slice(0, 50),
    [items, contextId, exceptions]
  )

  return (
    <CollapsibleSection
      title="Unmatched Items / Exceptions"
      count={ctxExceptions.length + unmatchedRaw.length}
      subtitle="Sorted by age descending"
    >
      {ctxExceptions.length === 0 && unmatchedRaw.length === 0 ? (
        <div style={{ fontSize: 13, color: C.green, fontStyle: 'italic' }}>
          No open exceptions for this context.
        </div>
      ) : (
        <table style={TABLE} className="print-table">
          <thead>
            <tr>
              {['Reference', 'Side', 'Amount', 'Age (days)', 'Reason Code', 'Assigned To', 'SLA Status', 'Priority'].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ctxExceptions.map(exc => (
              <tr
                key={exc.id}
                style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: C.primary }}>
                  {exc.item.reference}
                </td>
                <td style={TD}>
                  <Badge
                    label={exc.item.side}
                    color={exc.item.side === 'INTERNAL' ? C.blue : C.amber}
                    bg={exc.item.side === 'INTERNAL' ? C.blueDim : C.amberDim}
                  />
                </td>
                <td
                  style={{
                    ...TD,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: exc.item.amount >= 0 ? C.green : C.red,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  {fmtCurrency(exc.item.amount, exc.item.currency)}
                </td>
                <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>
                  <span
                    style={{
                      color: exc.item.age > 30 ? C.red : exc.item.age > 5 ? C.amber : C.primary,
                      fontWeight: exc.item.age > 30 ? 700 : 400,
                    }}
                  >
                    {exc.item.age}
                  </span>
                </td>
                <td style={{ ...TD, fontSize: 11 }}>
                  {exc.reasonCode ? exc.reasonCode.replace(/_/g, ' ') : '—'}
                </td>
                <td style={{ ...TD, fontSize: 11 }}>{exc.assignedTo || '—'}</td>
                <td style={TD}><SlaChip breached={exc.slaBreach} /></td>
                <td style={TD}>
                  <Badge
                    label={exc.priority}
                    color={exc.priority === 'CRITICAL' ? C.red : exc.priority === 'HIGH' ? C.amber : exc.priority === 'MEDIUM' ? C.blue : C.muted}
                    bg={exc.priority === 'CRITICAL' ? C.redDim : exc.priority === 'HIGH' ? C.amberDim : exc.priority === 'MEDIUM' ? C.blueDim : C.surface}
                  />
                </td>
              </tr>
            ))}
            {unmatchedRaw.map(item => (
              <tr
                key={item.id}
                style={{ transition: 'background 0.1s', opacity: 0.8 }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: C.primary }}>
                  {item.reference}
                </td>
                <td style={TD}>
                  <Badge
                    label={item.side}
                    color={item.side === 'INTERNAL' ? C.blue : C.amber}
                    bg={item.side === 'INTERNAL' ? C.blueDim : C.amberDim}
                  />
                </td>
                <td
                  style={{
                    ...TD,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: item.amount >= 0 ? C.green : C.red,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  {fmtCurrency(item.amount, item.currency)}
                </td>
                <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: item.age > 30 ? C.red : item.age > 5 ? C.amber : C.primary }}>
                    {item.age}
                  </span>
                </td>
                <td style={{ ...TD, fontSize: 11, color: C.muted }}>
                  {item.reasonCode ? item.reasonCode.replace(/_/g, ' ') : '—'}
                </td>
                <td style={{ ...TD, fontSize: 11, color: C.muted }}>{item.assignedTo ?? '—'}</td>
                <td style={TD}><Badge label="—" color={C.muted} bg={C.surface} /></td>
                <td style={TD}><Badge label="—" color={C.muted} bg={C.surface} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  )
}

// ─── Section 6: Balance Proof Section ────────────────────────────────────────

function BalanceProofSection({
  balancePools,
  contextId,
  currency,
}: {
  balancePools: BalancePool[]
  contextId: string
  currency: string
}) {
  const pools = useMemo(
    () =>
      balancePools
        .filter(bp => bp.contextId === contextId)
        .sort((a, b) => b.reconDate.localeCompare(a.reconDate))
        .slice(0, 5),
    [balancePools, contextId]
  )

  return (
    <CollapsibleSection
      title="Balance Proof"
      defaultOpen
      subtitle="Last 5 days — Formula: Opening + Credits - Debits = Calculated Closing"
    >
      {pools.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
          No balance pools found for this context.
        </div>
      ) : (
        <>
          {/* Formula explainer */}
          <div
            style={{
              background: C.surface,
              borderRadius: 8,
              padding: '10px 16px',
              marginBottom: 16,
              fontSize: 12,
              color: C.secondary,
              fontFamily: 'monospace',
            }}
          >
            Opening Balance + Credits - Debits = Calculated Closing &nbsp;|&nbsp; Calculated Closing - Stated Closing = Variance
          </div>

          <table style={TABLE} className="print-table">
            <thead>
              <tr>
                {['Date', 'Opening Balance', 'Credits', 'Debits', 'Calculated Closing', 'Stated Closing', 'Variance', 'Proof Status', 'Sign-Off'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pools.map(pool => (
                <tr key={pool.id} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  <td style={{ ...TD, fontWeight: 600, color: C.primary, whiteSpace: 'nowrap' }}>
                    {fmtDate(pool.reconDate)}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11 }}>
                    {fmtCurrency(pool.openingBalance, currency)}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11, color: C.green }}>
                    {fmtCurrency(pool.totalCredits, currency)}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11, color: C.red }}>
                    {fmtCurrency(pool.totalDebits, currency)}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>
                    {fmtCurrency(pool.calculatedClosing, currency)}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 11 }}>
                    {fmtCurrency(pool.statedClosing, currency)}
                  </td>
                  <td
                    style={{
                      ...TD,
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      color: pool.variance === 0 ? C.green : C.red,
                      background: pool.variance !== 0 ? C.redDim : 'transparent',
                    }}
                  >
                    {pool.variance !== 0 && (
                      <span style={{ marginRight: 4 }}>!</span>
                    )}
                    {fmtCurrency(pool.variance, currency)}
                  </td>
                  <td style={TD}>
                    <Badge
                      label={pool.proofStatus === 'IN_PROOF' ? 'IN PROOF' : pool.proofStatus === 'OUT_OF_PROOF' ? 'OUT OF PROOF' : 'PENDING'}
                      color={pool.proofStatus === 'IN_PROOF' ? C.green : pool.proofStatus === 'OUT_OF_PROOF' ? C.red : C.amber}
                      bg={pool.proofStatus === 'IN_PROOF' ? C.greenDim : pool.proofStatus === 'OUT_OF_PROOF' ? C.redDim : C.amberDim}
                    />
                  </td>
                  <td style={TD}>
                    {pool.signOffStatus === 'APPROVED' ? (
                      <div>
                        <Badge label="APPROVED" color={C.green} bg={C.greenDim} />
                        {pool.signedOffBy && (
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                            {pool.signedOffBy}
                          </div>
                        )}
                      </div>
                    ) : pool.signOffStatus === 'REJECTED' ? (
                      <Badge label="REJECTED" color={C.red} bg={C.redDim} />
                    ) : (
                      <Badge label="PENDING" color={C.amber} bg={C.amberDim} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </CollapsibleSection>
  )
}

// ─── Section 7: Audit Trail ───────────────────────────────────────────────────

function AuditTrailSection({ events }: { events: AuditEvent[] }) {
  const recent = events.slice(0, 20)

  return (
    <CollapsibleSection title="Audit Trail" count={recent.length} subtitle="Last 20 events">
      {recent.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
          No audit events recorded.
        </div>
      ) : (
        <table style={TABLE} className="print-table">
          <thead>
            <tr>
              {['Timestamp', 'User', 'Action', 'Detail', 'Context'].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map(ev => (
              <tr
                key={ev.id}
                style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.surface }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td style={{ ...TD, fontSize: 11, whiteSpace: 'nowrap', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDateTime(ev.timestamp)}
                </td>
                <td style={{ ...TD, fontSize: 11, color: C.secondary, whiteSpace: 'nowrap' }}>
                  {ev.user}
                </td>
                <td style={{ ...TD, fontSize: 11, whiteSpace: 'nowrap' }}>
                  <Badge
                    label={ev.action.replace(/_/g, ' ')}
                    color={C.blue}
                    bg={C.blueDim}
                  />
                </td>
                <td style={{ ...TD, fontSize: 12, lineHeight: 1.5 }}>
                  {ev.detail}
                </td>
                <td style={{ ...TD, fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>
                  {ev.contextId ?? ev.matchGroupId ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReconReport() {
  const contexts = useReconStore(s => s.contexts)
  const items = useReconStore(s => s.items)
  const matchGroups = useReconStore(s => s.matchGroups)
  const exceptions = useReconStore(s => s.exceptions)
  const balancePools = useReconStore(s => s.balancePools)
  const auditTrail = useReconStore(s => s.auditTrail)
  const reconRuns = useReconStore(s => s.reconRuns)
  const storeActiveContextId = useReconStore(s => s.activeContextId)

  // Local selected context for this report screen (may differ from global)
  const [selectedContextId, setSelectedContextId] = useState<string>(storeActiveContextId)
  const [drillType, setDrillType] = useState<MatchGroupType | null>(null)
  const [drillPass, setDrillPass] = useState<MatchPassType | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<MatchGroup | null>(null)

  const selectedContext = useMemo(
    () => contexts.find(c => c.id === selectedContextId),
    [contexts, selectedContextId]
  )

  const generatedAt = useMemo(() => fmtDateTime(new Date().toISOString()), [])

  // Latest recon run for selected context
  const latestRun = useMemo(() => {
    return reconRuns
      .filter(r => r.contextId === selectedContextId)
      .sort((a, b) => b.runDate.localeCompare(a.runDate))[0]
  }, [reconRuns, selectedContextId])

  const overallMatchRate = useMemo(() => {
    if (contexts.length === 0) return 0
    return contexts.reduce((s, c) => s + c.matchRate, 0) / contexts.length
  }, [contexts])

  const totalUnmatchedValue = useMemo(() => {
    return items
      .filter(i => i.status === 'UNMATCHED' || i.status === 'BREAK')
      .reduce((s, i) => s + Math.abs(i.amount), 0)
  }, [items])

  function handleSelectContext(id: string) {
    setSelectedContextId(id)
    setDrillType(null)
    setDrillPass(null)
  }

  return (
    <div
      style={{
        background: C.bg,
        minHeight: '100vh',
        padding: '28px 32px 48px',
        color: C.primary,
        maxWidth: 1300,
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      }}
    >
      {/* ── Print Styles ── */}
      <style>{PRINT_CSS}</style>

      {/* ── Section 1: Report Header ── */}
      <div
        style={{
          ...CARD,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderLeft: `3px solid ${C.blue}`,
          marginBottom: 28,
        }}
        className="print-header"
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.primary, letterSpacing: '-0.02em' }}>
            Daily Reconciliation Report
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.secondary, marginTop: 4 }}>
            March 15, 2026
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
            Generated: {generatedAt}
            {latestRun && (
              <span style={{ marginLeft: 16 }}>
                Last run: {fmtDateTime(latestRun.runDate)} by {latestRun.runBy}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {/* Context Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Context:
            </label>
            <select
              value={selectedContextId}
              onChange={e => handleSelectContext(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                color: C.primary,
                fontSize: 13,
                padding: '6px 12px',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: 280,
              }}
            >
              {contexts.map(c => (
                <option key={c.id} value={c.id} style={{ background: '#1a1d29' }}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Print Button */}
          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: `1px solid rgba(6,182,212,0.4)`,
              background: 'rgba(6,182,212,0.1)',
              color: C.blue,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.1)' }}
          >
            Export / Print
          </button>
        </div>
      </div>

      {/* ── Global KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          {
            label: 'Overall Match Rate',
            value: `${overallMatchRate.toFixed(1)}%`,
            color: matchRateColor(overallMatchRate),
            sub: `${contexts.length} context${contexts.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Total Unmatched Value',
            value: totalUnmatchedValue === 0 ? '$0.00' : fmtCurrency(totalUnmatchedValue),
            color: totalUnmatchedValue === 0 ? C.green : C.red,
            sub: 'Absolute, all contexts',
          },
          {
            label: 'Pools In Proof',
            value: `${balancePools.filter(bp => bp.proofStatus === 'IN_PROOF').length} / ${balancePools.length}`,
            color: balancePools.every(bp => bp.proofStatus === 'IN_PROOF') ? C.green : C.amber,
            sub: 'Balance pools reconciled',
          },
          {
            label: 'Open Exceptions',
            value: exceptions.length.toString(),
            color: exceptions.length === 0 ? C.green : exceptions.length > 20 ? C.red : C.amber,
            sub: exceptions.filter(e => e.slaBreach).length + ' SLA breaches',
          },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Section 2: Executive Summary ── */}
      {contexts.length > 0 ? (
        <ExecSummaryTable
          contexts={contexts}
          items={items}
          balancePools={balancePools}
          activeContextId={selectedContextId}
          onSelectContext={handleSelectContext}
        />
      ) : (
        <div style={{ ...CARD, color: C.muted, fontStyle: 'italic', textAlign: 'center' }}>
          No reconciliation contexts loaded. Initialize the store to see data.
        </div>
      )}

      {/* ── Selected Context Label ── */}
      {selectedContext && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.secondary,
            marginBottom: 14,
            marginTop: 8,
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: C.muted }}>Detailed report for:</span>
          <span style={{ color: C.primary }}>{selectedContext.name}</span>
          <Badge label={selectedContext.currency} color={C.blue} bg={C.blueDim} />
          <Badge label={selectedContext.type} color={C.purple} bg={C.purpleDim} />
        </div>
      )}

      {/* ── Section 3: Match Group Breakdown ── */}
      <MatchGroupBreakdown
        contextId={selectedContextId}
        matchGroups={matchGroups}
        drillType={drillType}
        drillPass={drillPass}
        onDrillType={setDrillType}
        onDrillPass={setDrillPass}
        onSelectGroup={setSelectedGroup}
      />

      {/* ── Section 4: Matched Items ── */}
      <MatchedItemsList
        items={items}
        matchGroups={matchGroups}
        contextId={selectedContextId}
        onSelectGroup={setSelectedGroup}
      />

      {/* ── Section 5: Unmatched / Exceptions ── */}
      <UnmatchedSection
        exceptions={exceptions}
        items={items}
        contextId={selectedContextId}
      />

      {/* ── Section 6: Balance Proof ── */}
      <BalanceProofSection
        balancePools={balancePools}
        contextId={selectedContextId}
        currency={selectedContext?.currency ?? 'USD'}
      />

      {/* ── Section 7: Audit Trail ── */}
      <AuditTrailSection events={auditTrail} />

      {/* ── Footer ── */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px 0 8px',
          borderTop: `1px solid rgba(255,255,255,0.06)`,
          marginTop: 16,
        }}
      >
        <span style={{ fontSize: 11, color: '#2d3748' }}>
          ReconX — Daily Reconciliation Report — March 15, 2026 — CONFIDENTIAL
        </span>
      </div>

      {/* ── Match Group Detail Drawer ── */}
      {selectedGroup && (
        <MatchGroupDetail
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  )
}
