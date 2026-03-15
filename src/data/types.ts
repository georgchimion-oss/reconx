// ─── Core Enums ───────────────────────────────────────────────

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF'
export type ItemSide = 'INTERNAL' | 'EXTERNAL'
export type ItemStatus = 'UNMATCHED' | 'MATCHED' | 'BREAK' | 'WRITE_OFF' | 'PROPOSED'
export type MatchPassType = 'EXACT' | 'TOLERANCE' | 'FUZZY' | 'AI_SUGGESTED'
export type ProofStatus = 'IN_PROOF' | 'OUT_OF_PROOF' | 'PENDING'
export type ReasonCode = 'TIMING' | 'MISSING_TRADE' | 'RATE_DIFFERENCE' | 'COUNTERPARTY_ERROR' | 'FEE_DIFFERENCE' | 'DUPLICATE' | 'UNKNOWN'
export type UserRole = 'ANALYST' | 'SUPERVISOR'
export type ContextType = 'CASH' | 'SECURITIES'
export type SignOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type WriteOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type SeverityLevel = 'GREEN' | 'AMBER' | 'RED'

// ─── Reconciliation Context ──────────────────────────────────

export interface ReconContext {
  id: string
  name: string           // "USD Nostro — JPMorgan Chase"
  type: ContextType
  currency: Currency
  counterparty: string
  totalItems: number
  matchRate: number      // 0-100
  healthStatus: SeverityLevel
}

// ─── Reconciliation Item ─────────────────────────────────────

export interface ReconItem {
  id: string
  contextId: string
  side: ItemSide         // Internal ledger or bank statement
  valueDate: string      // ISO date
  reference: string      // SWIFT-style reference
  description: string
  counterparty: string
  currency: Currency
  amount: number         // Positive = credit, negative = debit
  status: ItemStatus
  matchId: string | null
  matchPass: MatchPassType | null
  reasonCode: ReasonCode | null
  assignedTo: string | null
  age: number            // Days outstanding
  createdAt: string
}

// ─── Match Result ────────────────────────────────────────────

export interface MatchResult {
  id: string
  contextId: string
  pass: MatchPassType
  confidence: number     // 0-100
  internalItemId: string
  externalItemId: string
  internalItem: ReconItem
  externalItem: ReconItem
  toleranceApplied: number | null
  fieldsMatched: string[]
  ruleUsed: string
}

// ─── Balance Pool ────────────────────────────────────────────

export interface BalancePool {
  id: string
  contextId: string
  name: string           // "USD Nostro — JPMorgan Chase — 2026-03-15"
  reconDate: string      // ISO date
  openingBalance: number
  totalDebits: number
  totalCredits: number
  calculatedClosing: number
  statedClosing: number
  variance: number
  proofStatus: ProofStatus
  signOffStatus: SignOffStatus
  signedOffBy: string | null
  signedOffAt: string | null
  totalItems: number
  matchedItems: number
  exceptionItems: number
}

// ─── Match Rule ──────────────────────────────────────────────

export interface MatchRule {
  id: string
  contextId: string
  pass: number           // 1, 2, 3, 4
  type: MatchPassType
  description: string
  fields: string[]
  tolerance: number | null
  toleranceType: 'ABSOLUTE' | 'PERCENTAGE' | null
  dateRange: number | null  // Days ± for fuzzy
  isAutoSuggested: boolean
  isActive: boolean
}

// ─── Exception / Case ────────────────────────────────────────

export interface Exception {
  id: string
  itemId: string
  item: ReconItem
  contextId: string
  reasonCode: ReasonCode
  assignedTo: string
  slaDeadline: string    // ISO datetime
  slaBreach: boolean
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  notes: string[]
  createdAt: string
}

// ─── Write-Off Request ───────────────────────────────────────

export interface WriteOffRequest {
  id: string
  itemId: string
  item: ReconItem
  contextId: string
  amount: number
  reasonCode: ReasonCode
  requestedBy: string
  requestedAt: string
  status: WriteOffStatus
  approvedBy: string | null
  approvedAt: string | null
  comments: string
}

// ─── User / Team ─────────────────────────────────────────────

export interface TeamMember {
  id: string
  name: string
  role: UserRole
  assignedContexts: string[]
  itemsResolvedToday: number
  avgResolutionTime: number  // hours
  slaCompliance: number      // percentage
}

// ─── Dashboard KPIs ──────────────────────────────────────────

export interface DashboardKPIs {
  overallMatchRate: number
  totalItems: number
  matchedItems: number
  exceptionCount: number
  poolsInProof: number
  poolsOutOfProof: number
  agingBuckets: AgingBucket[]
  valueTiers: ValueTier[]
  matchRateTrend: TrendPoint[]
  topBreakCounterparties: CounterpartyBreak[]
}

export interface AgingBucket {
  label: string          // "0-1d", "2-5d", etc.
  count: number
  value: number
}

export interface ValueTier {
  label: string          // "$0-10K", "$10K-100K", etc.
  count: number
}

export interface TrendPoint {
  date: string
  matchRate: number
}

export interface CounterpartyBreak {
  counterparty: string
  breakCount: number
  totalValue: number
}

// ─── Matching Engine State ───────────────────────────────────

export interface MatchingPassResult {
  pass: MatchPassType
  passNumber: number
  matchesFound: number
  itemsProcessed: number
  remainingUnmatched: number
  matches: MatchResult[]
  duration: number       // ms
}

export interface MatchingRunResult {
  contextId: string
  totalItems: number
  passes: MatchingPassResult[]
  totalMatched: number
  totalExceptions: number
  overallMatchRate: number
  suggestedRules: MatchRule[]
}
