import {
  type ReconContext, type ReconItem, type BalancePool, type MatchRule,
  type TeamMember, type Exception, type WriteOffRequest, type DashboardKPIs,
  type AgingBucket, type ValueTier, type TrendPoint, type CounterpartyBreak,
  type ItemSide, type ReasonCode, type MatchGroup, type MatchGroupType,
  type MatchGroupStatus, type ReconciliationRun, type MatchPassType,
} from './types'

// ─── Deterministic Random ────────────────────────────────────

let _seed = 42
function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647
  return (_seed - 1) / 2147483646
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)]
}

function randBetween(min: number, max: number): number {
  return min + seededRandom() * (max - min)
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Constants ───────────────────────────────────────────────

const COUNTERPARTIES = [
  'JPMorgan Chase', 'Citibank', 'Deutsche Bank', 'HSBC',
  'Barclays', 'Goldman Sachs', 'BNP Paribas', 'UBS',
  'Morgan Stanley', 'State Street', 'Bank of America',
  'Credit Suisse', 'Nomura', 'Standard Chartered',
]

const TRANSACTION_TYPES = [
  'Wire Transfer', 'FX Settlement', 'Coupon Payment', 'Dividend',
  'Margin Call', 'Repo Settlement', 'Securities Delivery', 'Fee Payment',
  'Interest Payment', 'Principal Repayment', 'Collateral Transfer',
  'Trade Settlement', 'Corporate Action', 'Tax Payment',
]

const ANALYSTS: TeamMember[] = [
  { id: 'u1', name: 'Sarah Chen', role: 'ANALYST', assignedContexts: ['ctx-1', 'ctx-2'], itemsResolvedToday: 47, avgResolutionTime: 2.3, slaCompliance: 96 },
  { id: 'u2', name: 'Marcus Rodriguez', role: 'ANALYST', assignedContexts: ['ctx-1', 'ctx-3'], itemsResolvedToday: 38, avgResolutionTime: 3.1, slaCompliance: 91 },
  { id: 'u3', name: 'Priya Patel', role: 'ANALYST', assignedContexts: ['ctx-2', 'ctx-4'], itemsResolvedToday: 52, avgResolutionTime: 1.8, slaCompliance: 98 },
  { id: 'u4', name: 'James O\'Brien', role: 'ANALYST', assignedContexts: ['ctx-3', 'ctx-4'], itemsResolvedToday: 29, avgResolutionTime: 4.2, slaCompliance: 84 },
  { id: 'u5', name: 'Thomas Mueller', role: 'SUPERVISOR', assignedContexts: ['ctx-1', 'ctx-2', 'ctx-3', 'ctx-4'], itemsResolvedToday: 0, avgResolutionTime: 0, slaCompliance: 100 },
  { id: 'u6', name: 'Evan Richards', role: 'SUPERVISOR', assignedContexts: ['ctx-1', 'ctx-2', 'ctx-3', 'ctx-4'], itemsResolvedToday: 0, avgResolutionTime: 0, slaCompliance: 100 },
]

// ─── Reconciliation Contexts ─────────────────────────────────

const CONTEXTS: ReconContext[] = [
  { id: 'ctx-1', name: 'USD Nostro — JPMorgan Chase', type: 'CASH', currency: 'USD', counterparty: 'JPMorgan Chase', totalItems: 800, matchRate: 94.2, healthStatus: 'AMBER' },
  { id: 'ctx-2', name: 'EUR Nostro — Deutsche Bank', type: 'CASH', currency: 'EUR', counterparty: 'Deutsche Bank', totalItems: 500, matchRate: 91.8, healthStatus: 'RED' },
  { id: 'ctx-3', name: 'GBP Nostro — Barclays', type: 'CASH', currency: 'GBP', counterparty: 'Barclays', totalItems: 300, matchRate: 97.1, healthStatus: 'GREEN' },
  { id: 'ctx-4', name: 'Securities Custody — State Street', type: 'SECURITIES', currency: 'USD', counterparty: 'State Street', totalItems: 400, matchRate: 88.5, healthStatus: 'RED' },
]

// ─── Generate Business Dates ─────────────────────────────────

function getBusinessDates(count: number): string[] {
  const dates: string[] = []
  const today = new Date(2026, 2, 15) // March 15, 2026
  let d = new Date(today)
  while (dates.length < count) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().split('T')[0])
    }
    d = new Date(d.getTime() - 86400000)
  }
  return dates.reverse()
}

const BUSINESS_DATES = getBusinessDates(30)

// ─── Generate SWIFT-style References ─────────────────────────

function genInternalRef(currency: string, date: string, seq: number): string {
  const d = date.replace(/-/g, '').slice(2)
  return `PAY/${d}/${currency}/${String(seq).padStart(6, '0')}`
}

function genExternalRef(_currency: string, date: string, seq: number, variant: 'exact' | 'truncated' | 'different'): string {
  const d = date.replace(/-/g, '').slice(4)
  if (variant === 'exact') return `NONREF/${d}/${String(seq).padStart(6, '0')}`
  if (variant === 'truncated') return `NONREF/${d}/${String(seq).padStart(4, '0')}`
  return `${pick(['CRED', 'DEBT', 'TRF', 'SETL'])}/${d}/${String(Math.floor(seq * 1.5)).padStart(6, '0')}`
}

// ─── Generate Items for a Context ────────────────────────────

interface ItemPair {
  internal: ReconItem
  external: ReconItem
  matchType: 'exact' | 'tolerance' | 'fuzzy' | 'ai' | 'exception'
}

// Represents a 1:N, N:1, or N:N multi-item group
interface MultiItemGroup {
  groupType: MatchGroupType
  internalItems: ReconItem[]
  externalItems: ReconItem[]
  matchType: 'exact' | 'tolerance' | 'fuzzy' | 'ai'
}

function generateRealisticAmount(type: 'CASH' | 'SECURITIES'): number {
  // Realistic distribution: many small, few large
  const r = seededRandom()
  if (type === 'SECURITIES') {
    if (r < 0.3) return roundCents(randBetween(1000, 50000))
    if (r < 0.6) return roundCents(randBetween(50000, 500000))
    if (r < 0.85) return roundCents(randBetween(500000, 5000000))
    return roundCents(randBetween(5000000, 50000000))
  }
  if (r < 0.25) return roundCents(randBetween(500, 10000))
  if (r < 0.55) return roundCents(randBetween(10000, 100000))
  if (r < 0.80) return roundCents(randBetween(100000, 1000000))
  if (r < 0.95) return roundCents(randBetween(1000000, 10000000))
  return roundCents(randBetween(10000000, 50000000))
}

function generateItemsForContext(ctx: ReconContext): {
  pairs: ItemPair[]
  multiGroups: MultiItemGroup[]
} {
  const pairs: ItemPair[] = []
  const multiGroups: MultiItemGroup[] = []
  const totalPairs = Math.floor(ctx.totalItems / 2)

  // Reserve ~10% of totalPairs for multi-item groups (5% 1:N + 3% N:1 + 2% N:N)
  const oneToNCount = Math.floor(totalPairs * 0.05)
  const nToOneCount = Math.floor(totalPairs * 0.03)
  const nToNCount = Math.floor(totalPairs * 0.02)
  const multiReserved = oneToNCount + nToOneCount + nToNCount

  // Remaining pairs for 1:1 matches
  const remainingPairs = totalPairs - multiReserved

  // Distribution of 1:1 matches: 70% exact, 15% tolerance, 7% fuzzy, 2% AI, 6% exceptions
  const exactCount = Math.floor(remainingPairs * 0.70)
  const toleranceCount = Math.floor(remainingPairs * 0.15)
  const fuzzyCount = Math.floor(remainingPairs * 0.07)
  const aiCount = Math.floor(remainingPairs * 0.02)
  const exceptionCount = remainingPairs - exactCount - toleranceCount - fuzzyCount - aiCount

  let seq = 1

  function makeItem(
    side: ItemSide,
    date: string,
    ref: string,
    amount: number,
    desc: string,
    overrides: Partial<ReconItem> = {}
  ): ReconItem {
    return {
      id: `${ctx.id}-${side[0]}-${String(seq).padStart(5, '0')}`,
      contextId: ctx.id,
      side,
      valueDate: date,
      reference: ref,
      description: desc,
      counterparty: ctx.counterparty,
      currency: ctx.currency,
      amount: roundCents(amount),
      status: 'UNMATCHED',
      matchId: null,
      matchGroupId: null,
      matchPass: null,
      reasonCode: null,
      assignedTo: null,
      age: Math.max(0, Math.floor((new Date(2026, 2, 15).getTime() - new Date(date).getTime()) / 86400000)),
      createdAt: date,
      isCarryForward: false,
      carryForwardDays: 0,
      ...overrides,
    }
  }

  // ── 1:N groups — 1 internal matches N (2-4) external items (split settlements)
  for (let i = 0; i < oneToNCount; i++) {
    const date = pick(BUSINESS_DATES)
    const totalAmount = generateRealisticAmount(ctx.type)
    const txType = pick(TRANSACTION_TYPES)
    const nParts = 2 + Math.floor(seededRandom() * 3) // 2-4 external parts
    const intRef = genInternalRef(ctx.currency, date, seq)

    const internalItem = makeItem(
      'INTERNAL', date, intRef, totalAmount,
      `${txType} — ${pick(COUNTERPARTIES)} [Split Settlement]`
    )
    seq++

    // Generate external split parts that sum to totalAmount
    const externalItems: ReconItem[] = []
    let remaining = totalAmount
    for (let p = 0; p < nParts; p++) {
      const isLast = p === nParts - 1
      const partAmount = isLast
        ? roundCents(remaining)
        : roundCents(totalAmount * (0.2 + seededRandom() * 0.4))
      remaining = roundCents(remaining - (isLast ? 0 : partAmount))
      const extRef = genExternalRef(ctx.currency, date, seq, 'exact')
      externalItems.push(makeItem(
        'EXTERNAL', date, extRef, partAmount,
        `${txType.toUpperCase()} PART ${p + 1}/${nParts}`
      ))
      seq++
    }

    multiGroups.push({ groupType: '1:N', internalItems: [internalItem], externalItems, matchType: 'exact' })
  }

  // ── N:1 groups — N (2-3) internal items match 1 external item (batch payments)
  for (let i = 0; i < nToOneCount; i++) {
    const date = pick(BUSINESS_DATES)
    const txType = pick(TRANSACTION_TYPES)
    const nParts = 2 + Math.floor(seededRandom() * 2) // 2-3 internal parts
    const extRef = genExternalRef(ctx.currency, date, seq, 'exact')

    const internalItems: ReconItem[] = []
    let batchTotal = 0
    for (let p = 0; p < nParts; p++) {
      const partAmount = generateRealisticAmount(ctx.type)
      batchTotal = roundCents(batchTotal + partAmount)
      const intRef = genInternalRef(ctx.currency, date, seq)
      internalItems.push(makeItem(
        'INTERNAL', date, intRef, partAmount,
        `${txType} — ${pick(COUNTERPARTIES)} [Batch ${p + 1}/${nParts}]`
      ))
      seq++
    }

    const externalItem = makeItem(
      'EXTERNAL', date, extRef, batchTotal,
      `${txType.toUpperCase()} BATCH PAYMENT`
    )
    seq++

    multiGroups.push({ groupType: 'N:1', internalItems, externalItems: [externalItem], matchType: 'tolerance' })
  }

  // ── N:N groups — N internals and M externals net to within tolerance (net matching)
  for (let i = 0; i < nToNCount; i++) {
    const date = pick(BUSINESS_DATES)
    const txType = pick(TRANSACTION_TYPES)
    const nInt = 2 + Math.floor(seededRandom() * 2) // 2-3 internals
    const nExt = 2 + Math.floor(seededRandom() * 2) // 2-3 externals

    const internalItems: ReconItem[] = []
    let internalTotal = 0
    for (let p = 0; p < nInt; p++) {
      const amt = generateRealisticAmount(ctx.type)
      internalTotal = roundCents(internalTotal + amt)
      const intRef = genInternalRef(ctx.currency, date, seq)
      internalItems.push(makeItem(
        'INTERNAL', date, intRef, amt,
        `${txType} — ${pick(COUNTERPARTIES)} [Net ${p + 1}/${nInt}]`
      ))
      seq++
    }

    const externalItems: ReconItem[] = []
    // Externals total within $100 tolerance of internalTotal
    const netDiff = roundCents((seededRandom() - 0.5) * 100) // -$50 to +$50
    const targetExtTotal = roundCents(internalTotal + netDiff)
    let extRemaining = targetExtTotal
    for (let p = 0; p < nExt; p++) {
      const isLast = p === nExt - 1
      const amt = isLast
        ? roundCents(extRemaining)
        : roundCents(targetExtTotal * (0.2 + seededRandom() * 0.5))
      extRemaining = roundCents(extRemaining - (isLast ? 0 : amt))
      const extRef = genExternalRef(ctx.currency, date, seq, 'exact')
      externalItems.push(makeItem(
        'EXTERNAL', date, extRef, amt,
        `${txType.toUpperCase()} NET ${p + 1}/${nExt}`
      ))
      seq++
    }

    multiGroups.push({ groupType: 'N:N', internalItems, externalItems, matchType: 'tolerance' })
  }

  // ── 1:1 Exact matches
  for (let i = 0; i < exactCount; i++) {
    const date = pick(BUSINESS_DATES)
    const amount = generateRealisticAmount(ctx.type)
    const txType = pick(TRANSACTION_TYPES)
    const intRef = genInternalRef(ctx.currency, date, seq)
    const extRef = genExternalRef(ctx.currency, date, seq, 'exact')
    pairs.push({
      internal: makeItem('INTERNAL', date, intRef, amount, `${txType} — ${pick(COUNTERPARTIES)}`),
      external: makeItem('EXTERNAL', date, extRef, amount, `${txType.toUpperCase().replace(/ /g, ' ')}`),
      matchType: 'exact',
    })
    seq++
  }

  // ── 1:1 Tolerance matches — amount off by $0.01-$2.00 (FX rounding, fees)
  for (let i = 0; i < toleranceCount; i++) {
    const date = pick(BUSINESS_DATES)
    const amount = generateRealisticAmount(ctx.type)
    const diff = roundCents(randBetween(0.01, 2.00) * (seededRandom() > 0.5 ? 1 : -1))
    const txType = pick(TRANSACTION_TYPES)
    const intRef = genInternalRef(ctx.currency, date, seq)
    const extRef = genExternalRef(ctx.currency, date, seq, 'exact')
    pairs.push({
      internal: makeItem('INTERNAL', date, intRef, amount, `${txType} — ${pick(COUNTERPARTIES)}`),
      external: makeItem('EXTERNAL', date, extRef, roundCents(amount + diff), `${txType.toUpperCase().replace(/ /g, ' ')}`),
      matchType: 'tolerance',
    })
    seq++
  }

  // ── 1:1 Fuzzy matches — reference truncated, date off by 1-2 days
  for (let i = 0; i < fuzzyCount; i++) {
    const dateIdx = Math.min(BUSINESS_DATES.length - 3, Math.floor(seededRandom() * (BUSINESS_DATES.length - 2)))
    const intDate = BUSINESS_DATES[dateIdx]
    const offset = Math.floor(seededRandom() * 2) + 1
    const extDate = BUSINESS_DATES[Math.min(dateIdx + offset, BUSINESS_DATES.length - 1)]
    const amount = generateRealisticAmount(ctx.type)
    const txType = pick(TRANSACTION_TYPES)
    const intRef = genInternalRef(ctx.currency, intDate, seq)
    const extRef = genExternalRef(ctx.currency, extDate, seq, 'truncated')
    pairs.push({
      internal: makeItem('INTERNAL', intDate, intRef, amount, `${txType} — ${pick(COUNTERPARTIES)}`),
      external: makeItem('EXTERNAL', extDate, extRef, amount, `${txType.toUpperCase()}`),
      matchType: 'fuzzy',
    })
    seq++
  }

  // ── 1:1 AI-suggested matches — completely different reference format
  for (let i = 0; i < aiCount; i++) {
    const date = pick(BUSINESS_DATES)
    const amount = generateRealisticAmount(ctx.type)
    const txType = pick(TRANSACTION_TYPES)
    const intRef = genInternalRef(ctx.currency, date, seq)
    const extRef = genExternalRef(ctx.currency, date, seq, 'different')
    pairs.push({
      internal: makeItem('INTERNAL', date, intRef, amount, `${txType} — ${pick(COUNTERPARTIES)}`),
      external: makeItem('EXTERNAL', date, extRef, roundCents(amount + randBetween(-0.50, 0.50)), `${txType.toUpperCase()}`),
      matchType: 'ai',
    })
    seq++
  }

  // ── Exceptions — items with no counterpart (timing, missing trades)
  for (let i = 0; i < exceptionCount; i++) {
    const date = pick(BUSINESS_DATES)
    const amount = generateRealisticAmount(ctx.type)
    const txType = pick(TRANSACTION_TYPES)
    const side: ItemSide = seededRandom() > 0.5 ? 'INTERNAL' : 'EXTERNAL'
    const ref = side === 'INTERNAL'
      ? genInternalRef(ctx.currency, date, seq)
      : genExternalRef(ctx.currency, date, seq, 'exact')
    pairs.push({
      internal: makeItem(side, date, ref, amount, `${txType} — ${pick(COUNTERPARTIES)}`),
      external: makeItem(side, date, ref, amount, `${txType}`), // dummy, won't be used
      matchType: 'exception',
    })
    seq++
  }

  return { pairs, multiGroups }
}

// ─── Generate Match Groups from Item Pairs ────────────────────

function passToConfidence(matchType: 'exact' | 'tolerance' | 'fuzzy' | 'ai'): number {
  if (matchType === 'exact') return 100
  if (matchType === 'tolerance') return 85 + Math.floor(seededRandom() * 11) // 85-95
  if (matchType === 'fuzzy') return 70 + Math.floor(seededRandom() * 16)    // 70-85
  return 60 + Math.floor(seededRandom() * 16)                                // 60-75
}

function matchTypeToPass(matchType: 'exact' | 'tolerance' | 'fuzzy' | 'ai'): MatchPassType {
  if (matchType === 'exact') return 'EXACT'
  if (matchType === 'tolerance') return 'TOLERANCE'
  if (matchType === 'fuzzy') return 'FUZZY'
  return 'AI_SUGGESTED'
}

function matchTypeToStatus(matchType: 'exact' | 'tolerance' | 'fuzzy' | 'ai'): MatchGroupStatus {
  return matchType === 'ai' ? 'PENDING_REVIEW' : 'CONFIRMED'
}

function matchTypeToRule(matchType: 'exact' | 'tolerance' | 'fuzzy' | 'ai'): {
  ruleUsed: string
  fieldsMatched: string[]
  toleranceApplied: number | null
} {
  if (matchType === 'exact') {
    return { ruleUsed: 'Exact match on Reference + Amount + Value Date', fieldsMatched: ['reference', 'amount', 'valueDate'], toleranceApplied: null }
  }
  if (matchType === 'tolerance') {
    return { ruleUsed: 'Tolerance match: Amount within $2.00 or 0.1%', fieldsMatched: ['reference', 'amount', 'valueDate'], toleranceApplied: 2.00 }
  }
  if (matchType === 'fuzzy') {
    return { ruleUsed: 'Fuzzy match: Partial reference + Date range ±2 business days', fieldsMatched: ['reference', 'amount', 'valueDate'], toleranceApplied: null }
  }
  return { ruleUsed: 'AI-suggested: Counterparty + Amount pattern + Date proximity', fieldsMatched: ['counterparty', 'amount', 'valueDate', 'description'], toleranceApplied: 0.50 }
}

function generateMatchGroups(
  ctxId: string,
  pairs: ItemPair[],
  multiGroups: MultiItemGroup[]
): MatchGroup[] {
  const groups: MatchGroup[] = []
  let mgSeq = 1

  const RECON_DATE = '2026-03-15'

  // Convert 1:1 pairs (non-exception) to MatchGroups
  for (const pair of pairs) {
    if (pair.matchType === 'exception') continue

    const mgId = `mg-${ctxId}-${String(mgSeq).padStart(4, '0')}`
    mgSeq++

    const internalTotal = pair.internal.amount
    const externalTotal = pair.external.amount
    const netDifference = roundCents(Math.abs(internalTotal - externalTotal))
    const pass = matchTypeToPass(pair.matchType)
    const status = matchTypeToStatus(pair.matchType)
    const confidence = passToConfidence(pair.matchType)
    const { ruleUsed, fieldsMatched, toleranceApplied } = matchTypeToRule(pair.matchType)

    // Link items back to this match group
    pair.internal.matchGroupId = mgId
    pair.internal.matchId = mgId
    pair.internal.matchPass = pass
    pair.internal.status = status === 'PENDING_REVIEW' ? 'PROPOSED' : 'MATCHED'

    pair.external.matchGroupId = mgId
    pair.external.matchId = mgId
    pair.external.matchPass = pass
    pair.external.status = status === 'PENDING_REVIEW' ? 'PROPOSED' : 'MATCHED'

    groups.push({
      id: mgId,
      contextId: ctxId,
      type: '1:1',
      status,
      pass,
      confidence,
      internalItems: [pair.internal],
      externalItems: [pair.external],
      internalTotal,
      externalTotal,
      netDifference,
      toleranceApplied,
      fieldsMatched,
      ruleUsed,
      matchedBy: status === 'PENDING_REVIEW' ? 'AUTO' : 'AUTO',
      matchedAt: `${RECON_DATE}T08:${String(30 + (mgSeq % 30)).padStart(2, '0')}:00Z`,
      brokenBy: null,
      brokenAt: null,
      breakReason: null,
      comments: [],
    })
  }

  // Convert multi-item groups (1:N, N:1, N:N) to MatchGroups
  for (const group of multiGroups) {
    const mgId = `mg-${ctxId}-${String(mgSeq).padStart(4, '0')}`
    mgSeq++

    const internalTotal = roundCents(group.internalItems.reduce((s, it) => s + it.amount, 0))
    const externalTotal = roundCents(group.externalItems.reduce((s, it) => s + it.amount, 0))
    const netDifference = roundCents(Math.abs(internalTotal - externalTotal))
    const pass = matchTypeToPass(group.matchType)
    const status = matchTypeToStatus(group.matchType)
    const confidence = passToConfidence(group.matchType)
    const { ruleUsed, fieldsMatched, toleranceApplied } = matchTypeToRule(group.matchType)

    // Build a descriptive rule string for multi-item groups
    const multiRuleUsed = group.groupType === '1:N'
      ? `1:N Split settlement — ${ruleUsed}`
      : group.groupType === 'N:1'
        ? `N:1 Batch payment — ${ruleUsed}`
        : `N:N Net matching within tolerance — ${ruleUsed}`

    // Link all items back to this match group
    for (const item of group.internalItems) {
      item.matchGroupId = mgId
      item.matchId = mgId
      item.matchPass = pass
      item.status = status === 'PENDING_REVIEW' ? 'PROPOSED' : 'MATCHED'
    }
    for (const item of group.externalItems) {
      item.matchGroupId = mgId
      item.matchId = mgId
      item.matchPass = pass
      item.status = status === 'PENDING_REVIEW' ? 'PROPOSED' : 'MATCHED'
    }

    groups.push({
      id: mgId,
      contextId: ctxId,
      type: group.groupType,
      status,
      pass,
      confidence,
      internalItems: group.internalItems,
      externalItems: group.externalItems,
      internalTotal,
      externalTotal,
      netDifference,
      toleranceApplied,
      fieldsMatched,
      ruleUsed: multiRuleUsed,
      matchedBy: 'AUTO',
      matchedAt: `${RECON_DATE}T08:${String(30 + (mgSeq % 30)).padStart(2, '0')}:00Z`,
      brokenBy: null,
      brokenAt: null,
      breakReason: null,
      comments: [],
    })
  }

  return groups
}

// ─── Apply CarryForward to Exception Items ────────────────────

function applyCarryForward(items: ReconItem[]): void {
  // Mark ~10% of BREAK items as carry-forward
  const breakItems = items.filter(it => it.status === 'BREAK' || it.status === 'UNMATCHED')
  const cfThreshold = Math.floor(breakItems.length * 0.10)

  let cfCount = 0
  for (const item of breakItems) {
    if (cfCount >= cfThreshold) break
    // Only mark older items (age > 1) as carry-forward
    if (item.age > 1) {
      item.isCarryForward = true
      item.carryForwardDays = item.age
      cfCount++
    }
  }
}

// ─── Generate Default Match Rules ────────────────────────────

function generateMatchRules(ctx: ReconContext): MatchRule[] {
  return [
    {
      id: `rule-${ctx.id}-1`, contextId: ctx.id, pass: 1, type: 'EXACT',
      description: 'Exact match on Reference + Amount + Value Date',
      fields: ['reference', 'amount', 'valueDate'], tolerance: null, toleranceType: null, dateRange: null,
      isAutoSuggested: false, isActive: true,
    },
    {
      id: `rule-${ctx.id}-2`, contextId: ctx.id, pass: 2, type: 'TOLERANCE',
      description: `Tolerance match: Amount within $${ctx.currency === 'JPY' ? '50' : '0.50'} or 0.1%`,
      fields: ['reference', 'amount', 'valueDate'], tolerance: ctx.currency === 'JPY' ? 50 : 0.50, toleranceType: 'ABSOLUTE', dateRange: null,
      isAutoSuggested: false, isActive: true,
    },
    {
      id: `rule-${ctx.id}-3`, contextId: ctx.id, pass: 3, type: 'FUZZY',
      description: 'Fuzzy match: Partial reference + Date range ±2 business days',
      fields: ['reference', 'amount', 'valueDate'], tolerance: null, toleranceType: null, dateRange: 2,
      isAutoSuggested: false, isActive: true,
    },
    {
      id: `rule-${ctx.id}-4`, contextId: ctx.id, pass: 4, type: 'AI_SUGGESTED',
      description: 'AI-suggested: Counterparty + Amount pattern + Date proximity',
      fields: ['counterparty', 'amount', 'valueDate', 'description'], tolerance: 0.50, toleranceType: 'ABSOLUTE', dateRange: 3,
      isAutoSuggested: true, isActive: true,
    },
  ]
}

// ─── Generate Auto-Suggested Rules ───────────────────────────

function generateSuggestedRules(ctx: ReconContext): MatchRule[] {
  return [
    {
      id: `suggest-${ctx.id}-1`, contextId: ctx.id, pass: 2, type: 'TOLERANCE',
      description: `Detected: Amount differences cluster around $0.01–$2.00 → Suggest tolerance ±$${ctx.currency === 'JPY' ? '50' : '2.00'}`,
      fields: ['amount'], tolerance: ctx.currency === 'JPY' ? 50 : 2.00, toleranceType: 'ABSOLUTE', dateRange: null,
      isAutoSuggested: true, isActive: false,
    },
    {
      id: `suggest-${ctx.id}-2`, contextId: ctx.id, pass: 3, type: 'FUZZY',
      description: `Detected: Bank 'Reference' contains substring of Ledger 'PaymentRef' → Suggest fuzzy match with substring matching`,
      fields: ['reference'], tolerance: null, toleranceType: null, dateRange: null,
      isAutoSuggested: true, isActive: false,
    },
    {
      id: `suggest-${ctx.id}-3`, contextId: ctx.id, pass: 3, type: 'FUZZY',
      description: `Detected: Bank posts 1–2 days after Ledger value date → Suggest date range ±2 business days`,
      fields: ['valueDate'], tolerance: null, toleranceType: null, dateRange: 2,
      isAutoSuggested: true, isActive: false,
    },
  ]
}

// ─── Generate Balance Pools ──────────────────────────────────

function generateBalancePools(ctx: ReconContext, items: ReconItem[]): BalancePool[] {
  const pools: BalancePool[] = []
  const last5Dates = BUSINESS_DATES.slice(-5)

  let runningBalance = ctx.currency === 'USD' ? 142567891.23
    : ctx.currency === 'EUR' ? 87432156.78
    : ctx.currency === 'GBP' ? 53218743.91
    : 234567890.12

  for (let i = 0; i < last5Dates.length; i++) {
    const date = last5Dates[i]
    const dayItems = items.filter(it => it.valueDate === date)
    const debits = roundCents(dayItems.filter(it => it.amount < 0).reduce((s, it) => s + Math.abs(it.amount), 0) || randBetween(50000000, 90000000))
    const credits = roundCents(dayItems.filter(it => it.amount > 0).reduce((s, it) => s + it.amount, 0) || randBetween(50000000, 90000000))
    const opening = roundCents(runningBalance)
    const calculated = roundCents(opening + credits - debits)

    // Some days have a variance (out of proof)
    const hasVariance = i === 2 || (ctx.id === 'ctx-2' && i === 4) || (ctx.id === 'ctx-4' && i === 3)
    const variance = hasVariance ? roundCents(randBetween(-500, 500)) : 0
    const stated = roundCents(calculated + variance)

    const matched = Math.floor(dayItems.length * (ctx.matchRate / 100))
    const exceptions = dayItems.length - matched

    const isApproved = !hasVariance && i < last5Dates.length - 1

    pools.push({
      id: `bp-${ctx.id}-${date}`,
      contextId: ctx.id,
      name: `${ctx.name} — ${date}`,
      reconDate: date,
      openingBalance: opening,
      totalDebits: debits,
      totalCredits: credits,
      calculatedClosing: calculated,
      statedClosing: stated,
      variance,
      proofStatus: hasVariance ? 'OUT_OF_PROOF' : 'IN_PROOF',
      signOffStatus: isApproved ? 'APPROVED' : 'PENDING',
      signedOffBy: isApproved ? 'Thomas Mueller' : null,
      signedOffAt: isApproved ? `${date}T09:42:00Z` : null,
      totalItems: dayItems.length || Math.floor(ctx.totalItems / 5),
      matchedItems: matched || Math.floor((ctx.totalItems / 5) * (ctx.matchRate / 100)),
      exceptionItems: exceptions || Math.floor((ctx.totalItems / 5) * ((100 - ctx.matchRate) / 100)),
    })

    runningBalance = stated
  }

  return pools
}

// ─── Generate Exceptions ─────────────────────────────────────

function generateExceptions(items: ReconItem[]): Exception[] {
  const unmatched = items.filter(it => it.status === 'UNMATCHED' || it.status === 'BREAK')
  const reasons: ReasonCode[] = ['TIMING', 'MISSING_TRADE', 'RATE_DIFFERENCE', 'COUNTERPARTY_ERROR', 'FEE_DIFFERENCE']

  return unmatched.slice(0, 60).map((item, i) => {
    const age = item.age
    const priority = age > 15 ? 'CRITICAL' : age > 7 ? 'HIGH' : age > 3 ? 'MEDIUM' : 'LOW' as Exception['priority']
    const analyst = pick(ANALYSTS.filter(a => a.role === 'ANALYST'))
    const slaHours = priority === 'CRITICAL' ? 4 : priority === 'HIGH' ? 8 : priority === 'MEDIUM' ? 24 : 48
    const slaDeadline = new Date(new Date(item.createdAt).getTime() + slaHours * 3600000).toISOString()

    return {
      id: `exc-${String(i).padStart(4, '0')}`,
      itemId: item.id,
      item,
      contextId: item.contextId,
      reasonCode: pick(reasons),
      assignedTo: analyst.name,
      slaDeadline,
      slaBreach: new Date(slaDeadline) < new Date(2026, 2, 15),
      priority,
      notes: age > 5 ? [`Investigating with ${item.counterparty}`, 'Awaiting confirmation from counterparty'] : [],
      createdAt: item.createdAt,
    }
  })
}

// ─── Generate Write-Off Requests ─────────────────────────────

function generateWriteOffs(exceptions: Exception[]): WriteOffRequest[] {
  const smallExceptions = exceptions.filter(e => Math.abs(e.item.amount) < 10000)
  return smallExceptions.slice(0, 8).map((exc, i) => ({
    id: `wo-${String(i).padStart(4, '0')}`,
    itemId: exc.itemId,
    item: exc.item,
    contextId: exc.contextId,
    amount: exc.item.amount,
    reasonCode: exc.reasonCode,
    requestedBy: exc.assignedTo,
    requestedAt: exc.createdAt,
    status: i < 3 ? 'APPROVED' : i < 6 ? 'PENDING' : 'REJECTED',
    approvedBy: i < 3 ? 'Thomas Mueller' : null,
    approvedAt: i < 3 ? new Date(new Date(exc.createdAt).getTime() + 7200000).toISOString() : null,
    comments: i < 3 ? 'Approved — FX rounding within threshold' : '',
  }))
}

// ─── Generate Reconciliation Runs ────────────────────────────

function generateReconRuns(ctx: ReconContext, matchGroups: MatchGroup[]): ReconciliationRun[] {
  const runs: ReconciliationRun[] = []
  // Use last 5 business dates (most recent = today)
  const runDates = BUSINESS_DATES.slice(-5)
  const analysts = ['Sarah Chen', 'Marcus Rodriguez', 'Priya Patel', 'AUTO']

  const ctxGroups = matchGroups.filter(mg => mg.contextId === ctx.id)
  const totalGroupsForCtx = ctxGroups.length

  for (let i = 0; i < runDates.length; i++) {
    const runDate = runDates[i]
    // Simulate slight daily variation in match counts
    const dayFactor = 0.90 + seededRandom() * 0.10 // 90-100% of all groups found that day
    const groupsFound = Math.floor(totalGroupsForCtx * dayFactor)
    const matchedItems = groupsFound * 2 // approximate 2 items per group (simplified)
    const totalItems = Math.floor(ctx.totalItems * dayFactor)
    const matchRate = roundCents((matchedItems / Math.max(totalItems, 1)) * 100)

    // Pass-by-pass breakdown
    const exactMatched = Math.floor(groupsFound * 0.70)
    const tolMatched = Math.floor(groupsFound * 0.15)
    const fuzzyMatched = Math.floor(groupsFound * 0.07)
    const aiMatched = groupsFound - exactMatched - tolMatched - fuzzyMatched

    const passResults: ReconciliationRun['passResults'] = [
      { pass: 'EXACT', matched: exactMatched },
      { pass: 'TOLERANCE', matched: tolMatched },
      { pass: 'FUZZY', matched: fuzzyMatched },
      { pass: 'AI_SUGGESTED', matched: aiMatched },
    ]

    // Realistic duration: 30-90 seconds in ms
    const duration = Math.floor(randBetween(30000, 90000))

    runs.push({
      id: `run-${ctx.id}-${runDate}`,
      contextId: ctx.id,
      runDate: `${runDate}T07:${String(Math.floor(randBetween(0, 59))).padStart(2, '0')}:00Z`,
      runBy: i === runDates.length - 1 ? 'AUTO' : pick(analysts),
      duration,
      totalItems,
      matchedItems,
      matchRate,
      passResults,
      groupsCreated: groupsFound,
    })
  }

  return runs
}

// ─── Generate Dashboard KPIs ─────────────────────────────────

function generateKPIs(contexts: ReconContext[], pools: BalancePool[]): DashboardKPIs {
  const totalItems = contexts.reduce((s, c) => s + c.totalItems, 0)
  const matchedItems = contexts.reduce((s, c) => s + Math.floor(c.totalItems * c.matchRate / 100), 0)
  const exceptionCount = totalItems - matchedItems

  const agingBuckets: AgingBucket[] = [
    { label: '0–1d', count: Math.floor(exceptionCount * 0.15), value: 2340000 },
    { label: '2–5d', count: Math.floor(exceptionCount * 0.30), value: 8760000 },
    { label: '6–15d', count: Math.floor(exceptionCount * 0.25), value: 12450000 },
    { label: '16–30d', count: Math.floor(exceptionCount * 0.20), value: 18230000 },
    { label: '30d+', count: Math.floor(exceptionCount * 0.10), value: 31560000 },
  ]

  const valueTiers: ValueTier[] = [
    { label: '$0–10K', count: Math.floor(exceptionCount * 0.40) },
    { label: '$10K–100K', count: Math.floor(exceptionCount * 0.30) },
    { label: '$100K–1M', count: Math.floor(exceptionCount * 0.20) },
    { label: '$1M+', count: Math.floor(exceptionCount * 0.10) },
  ]

  // 30-day match rate trend
  const matchRateTrend: TrendPoint[] = BUSINESS_DATES.slice(-22).map((date, i) => ({
    date,
    matchRate: roundCents(91 + seededRandom() * 5 + (i * 0.1)),
  }))

  const topBreakCounterparties: CounterpartyBreak[] = [
    { counterparty: 'Deutsche Bank', breakCount: 41, totalValue: 23456789 },
    { counterparty: 'State Street', breakCount: 46, totalValue: 18923456 },
    { counterparty: 'JPMorgan Chase', breakCount: 23, totalValue: 15678234 },
    { counterparty: 'HSBC', breakCount: 18, totalValue: 8234567 },
    { counterparty: 'BNP Paribas', breakCount: 12, totalValue: 4567890 },
  ]

  return {
    overallMatchRate: roundCents(matchedItems / totalItems * 100),
    totalItems,
    matchedItems,
    exceptionCount,
    poolsInProof: pools.filter(p => p.proofStatus === 'IN_PROOF').length,
    poolsOutOfProof: pools.filter(p => p.proofStatus === 'OUT_OF_PROOF').length,
    agingBuckets,
    valueTiers,
    matchRateTrend,
    topBreakCounterparties,
  }
}

// ─── Master Seed Function ────────────────────────────────────

export interface SeedData {
  contexts: ReconContext[]
  items: ReconItem[]
  itemPairs: Map<string, ItemPair[]>
  matchRules: MatchRule[]
  suggestedRules: MatchRule[]
  balancePools: BalancePool[]
  exceptions: Exception[]
  writeOffs: WriteOffRequest[]
  team: TeamMember[]
  kpis: DashboardKPIs
  matchGroups: MatchGroup[]
  reconRuns: ReconciliationRun[]
}

export function generateSeedData(): SeedData {
  _seed = 42 // Reset for determinism

  const contexts = CONTEXTS
  const itemPairs = new Map<string, ItemPair[]>()
  const allItems: ReconItem[] = []
  const allRules: MatchRule[] = []
  const allSuggestedRules: MatchRule[] = []
  const allPools: BalancePool[] = []
  const allMatchGroups: MatchGroup[] = []
  const allReconRuns: ReconciliationRun[] = []

  for (const ctx of contexts) {
    const { pairs, multiGroups } = generateItemsForContext(ctx)
    itemPairs.set(ctx.id, pairs)

    // Flatten 1:1 items: for exceptions, only add the one-sided item
    for (const pair of pairs) {
      if (pair.matchType === 'exception') {
        const item = { ...pair.internal, status: 'BREAK' as const }
        allItems.push(item)
      } else {
        allItems.push(pair.internal)
        allItems.push(pair.external)
      }
    }

    // Flatten multi-group items (all are matched sides)
    for (const group of multiGroups) {
      allItems.push(...group.internalItems)
      allItems.push(...group.externalItems)
    }

    allRules.push(...generateMatchRules(ctx))
    allSuggestedRules.push(...generateSuggestedRules(ctx))
    allPools.push(...generateBalancePools(ctx, allItems.filter(i => i.contextId === ctx.id)))

    // Generate MatchGroups — this mutates pair/multiGroup items to set matchGroupId, matchId, matchPass, status
    const ctxMatchGroups = generateMatchGroups(ctx.id, pairs, multiGroups)
    allMatchGroups.push(...ctxMatchGroups)

    // Generate historical recon runs for this context
    allReconRuns.push(...generateReconRuns(ctx, ctxMatchGroups))
  }

  // Apply carry-forward flags to ~10% of BREAK/UNMATCHED items
  applyCarryForward(allItems)

  const exceptions = generateExceptions(allItems)
  const writeOffs = generateWriteOffs(exceptions)
  const kpis = generateKPIs(contexts, allPools)

  return {
    contexts,
    items: allItems,
    itemPairs,
    matchRules: allRules,
    suggestedRules: allSuggestedRules,
    balancePools: allPools,
    exceptions,
    writeOffs,
    team: ANALYSTS,
    kpis,
    matchGroups: allMatchGroups,
    reconRuns: allReconRuns,
  }
}

export { CONTEXTS, BUSINESS_DATES, ANALYSTS, COUNTERPARTIES }
