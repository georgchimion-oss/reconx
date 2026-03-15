import {
  type ReconContext, type ReconItem, type BalancePool, type MatchRule,
  type TeamMember, type Exception, type WriteOffRequest, type DashboardKPIs,
  type AgingBucket, type ValueTier, type TrendPoint, type CounterpartyBreak,
  type ItemSide, type ReasonCode,
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

function generateItemsForContext(ctx: ReconContext): ItemPair[] {
  const pairs: ItemPair[] = []
  const totalPairs = Math.floor(ctx.totalItems / 2)

  // Distribution: 70% exact, 15% tolerance, 7% fuzzy, 2% AI, 6% exceptions
  const exactCount = Math.floor(totalPairs * 0.70)
  const toleranceCount = Math.floor(totalPairs * 0.15)
  const fuzzyCount = Math.floor(totalPairs * 0.07)
  const aiCount = Math.floor(totalPairs * 0.02)
  const exceptionCount = totalPairs - exactCount - toleranceCount - fuzzyCount - aiCount

  let seq = 1

  function makeItem(side: ItemSide, date: string, ref: string, amount: number, desc: string): ReconItem {
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
      matchPass: null,
      reasonCode: null,
      assignedTo: null,
      age: Math.max(0, Math.floor((new Date(2026, 2, 15).getTime() - new Date(date).getTime()) / 86400000)),
      createdAt: date,
    }
  }

  // Exact matches — same reference pattern, same amount, same date
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

  // Tolerance matches — same date, amount off by $0.01-$2.00 (FX rounding, fees)
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

  // Fuzzy matches — reference truncated, date off by 1-2 days
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

  // AI-suggested matches — completely different reference format
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

  // Exceptions — items with no counterpart (timing, missing trades)
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

  return pairs
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
}

export function generateSeedData(): SeedData {
  _seed = 42 // Reset for determinism

  const contexts = CONTEXTS
  const itemPairs = new Map<string, ItemPair[]>()
  const allItems: ReconItem[] = []
  const allRules: MatchRule[] = []
  const allSuggestedRules: MatchRule[] = []
  const allPools: BalancePool[] = []

  for (const ctx of contexts) {
    const pairs = generateItemsForContext(ctx)
    itemPairs.set(ctx.id, pairs)

    // Flatten items: for exceptions, only add the one-sided item
    for (const pair of pairs) {
      if (pair.matchType === 'exception') {
        const item = { ...pair.internal, status: 'BREAK' as const }
        allItems.push(item)
      } else {
        allItems.push(pair.internal)
        allItems.push(pair.external)
      }
    }

    allRules.push(...generateMatchRules(ctx))
    allSuggestedRules.push(...generateSuggestedRules(ctx))
    allPools.push(...generateBalancePools(ctx, allItems.filter(i => i.contextId === ctx.id)))
  }

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
  }
}

export { CONTEXTS, BUSINESS_DATES, ANALYSTS, COUNTERPARTIES }
