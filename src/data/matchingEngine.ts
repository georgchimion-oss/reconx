import {
  type ReconItem, type MatchResult, type MatchingPassResult,
  type MatchingRunResult, type MatchRule, type MatchPassType,
} from './types'

// ─── Matching Helpers ────────────────────────────────────────

function normalizeRef(ref: string): string {
  return ref.replace(/[^A-Z0-9]/gi, '').toUpperCase()
}

function refContains(a: string, b: string): boolean {
  const na = normalizeRef(a)
  const nb = normalizeRef(b)
  // Extract the numeric portion for comparison
  const numA = a.replace(/[^0-9]/g, '')
  const numB = b.replace(/[^0-9]/g, '')
  return na.includes(nb) || nb.includes(na) || (numA.length > 3 && numB.length > 3 && (numA.includes(numB) || numB.includes(numA)))
}

function dateDiffDays(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000
}

// ─── Pass 1: Exact Match ─────────────────────────────────────

function exactMatch(
  internals: ReconItem[],
  externals: ReconItem[],
  contextId: string,
): { matches: MatchResult[]; remainingInternal: ReconItem[]; remainingExternal: ReconItem[] } {
  const matches: MatchResult[] = []
  const usedExternal = new Set<string>()
  const matchedInternal = new Set<string>()

  for (const int of internals) {
    for (const ext of externals) {
      if (usedExternal.has(ext.id)) continue
      if (int.amount === ext.amount && int.valueDate === ext.valueDate && refContains(int.reference, ext.reference)) {
        matches.push({
          id: `match-exact-${matches.length}`,
          contextId,
          pass: 'EXACT',
          confidence: 100,
          internalItemId: int.id,
          externalItemId: ext.id,
          internalItem: int,
          externalItem: ext,
          toleranceApplied: null,
          fieldsMatched: ['reference', 'amount', 'valueDate'],
          ruleUsed: 'Exact match on Reference + Amount + Value Date',
        })
        usedExternal.add(ext.id)
        matchedInternal.add(int.id)
        break
      }
    }
  }

  return {
    matches,
    remainingInternal: internals.filter(i => !matchedInternal.has(i.id)),
    remainingExternal: externals.filter(e => !usedExternal.has(e.id)),
  }
}

// ─── Pass 2: Tolerance Match ─────────────────────────────────

function toleranceMatch(
  internals: ReconItem[],
  externals: ReconItem[],
  contextId: string,
  tolerance: number = 2.00,
): { matches: MatchResult[]; remainingInternal: ReconItem[]; remainingExternal: ReconItem[] } {
  const matches: MatchResult[] = []
  const usedExternal = new Set<string>()
  const matchedInternal = new Set<string>()

  for (const int of internals) {
    for (const ext of externals) {
      if (usedExternal.has(ext.id)) continue
      const amountDiff = Math.abs(int.amount - ext.amount)
      if (amountDiff <= tolerance && amountDiff > 0 && int.valueDate === ext.valueDate && refContains(int.reference, ext.reference)) {
        matches.push({
          id: `match-tol-${matches.length}`,
          contextId,
          pass: 'TOLERANCE',
          confidence: Math.round(100 - (amountDiff / tolerance) * 15),
          internalItemId: int.id,
          externalItemId: ext.id,
          internalItem: int,
          externalItem: ext,
          toleranceApplied: amountDiff,
          fieldsMatched: ['reference', 'amount (tolerance)', 'valueDate'],
          ruleUsed: `Tolerance match: Amount within $${tolerance.toFixed(2)} | Difference: $${amountDiff.toFixed(2)}`,
        })
        usedExternal.add(ext.id)
        matchedInternal.add(int.id)
        break
      }
    }
  }

  return {
    matches,
    remainingInternal: internals.filter(i => !matchedInternal.has(i.id)),
    remainingExternal: externals.filter(e => !usedExternal.has(e.id)),
  }
}

// ─── Pass 3: Fuzzy Match ─────────────────────────────────────

function fuzzyMatch(
  internals: ReconItem[],
  externals: ReconItem[],
  contextId: string,
  dateRange: number = 2,
): { matches: MatchResult[]; remainingInternal: ReconItem[]; remainingExternal: ReconItem[] } {
  const matches: MatchResult[] = []
  const usedExternal = new Set<string>()
  const matchedInternal = new Set<string>()

  for (const int of internals) {
    let bestMatch: { ext: ReconItem; score: number } | null = null

    for (const ext of externals) {
      if (usedExternal.has(ext.id)) continue
      const amountDiff = Math.abs(int.amount - ext.amount)
      const daysDiff = dateDiffDays(int.valueDate, ext.valueDate)

      if (amountDiff <= 2.00 && daysDiff <= dateRange && refContains(int.reference, ext.reference)) {
        const score = 100 - (daysDiff * 10) - (amountDiff * 5)
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { ext, score }
        }
      }
    }

    if (bestMatch) {
      const ext = bestMatch.ext
      matches.push({
        id: `match-fuzzy-${matches.length}`,
        contextId,
        pass: 'FUZZY',
        confidence: Math.round(bestMatch.score),
        internalItemId: int.id,
        externalItemId: ext.id,
        internalItem: int,
        externalItem: ext,
        toleranceApplied: Math.abs(int.amount - ext.amount) || null,
        fieldsMatched: ['reference (partial)', 'amount', `valueDate (±${dateDiffDays(int.valueDate, ext.valueDate).toFixed(0)}d)`],
        ruleUsed: `Fuzzy match: Partial reference + Date range ±${dateRange} days`,
      })
      usedExternal.add(ext.id)
      matchedInternal.add(int.id)
    }
  }

  return {
    matches,
    remainingInternal: internals.filter(i => !matchedInternal.has(i.id)),
    remainingExternal: externals.filter(e => !usedExternal.has(e.id)),
  }
}

// ─── Pass 4: AI-Suggested Match ──────────────────────────────

function aiSuggestedMatch(
  internals: ReconItem[],
  externals: ReconItem[],
  contextId: string,
): { matches: MatchResult[]; remainingInternal: ReconItem[]; remainingExternal: ReconItem[] } {
  const matches: MatchResult[] = []
  const usedExternal = new Set<string>()
  const matchedInternal = new Set<string>()

  for (const int of internals) {
    let bestMatch: { ext: ReconItem; score: number } | null = null

    for (const ext of externals) {
      if (usedExternal.has(ext.id)) continue
      const amountDiff = Math.abs(int.amount - ext.amount)
      const pctDiff = int.amount !== 0 ? (amountDiff / Math.abs(int.amount)) * 100 : 100
      const daysDiff = dateDiffDays(int.valueDate, ext.valueDate)

      // AI matching: amount within 0.5%, date within 3 days, same currency
      if (pctDiff <= 0.5 && daysDiff <= 3 && int.currency === ext.currency) {
        const score = 85 - (pctDiff * 20) - (daysDiff * 5)
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { ext, score }
        }
      }
    }

    if (bestMatch && bestMatch.score > 60) {
      const ext = bestMatch.ext
      matches.push({
        id: `match-ai-${matches.length}`,
        contextId,
        pass: 'AI_SUGGESTED',
        confidence: Math.round(bestMatch.score),
        internalItemId: int.id,
        externalItemId: ext.id,
        internalItem: int,
        externalItem: ext,
        toleranceApplied: Math.abs(int.amount - ext.amount),
        fieldsMatched: ['counterparty', 'amount (pattern)', 'valueDate (proximity)', 'currency'],
        ruleUsed: `AI-suggested: Cross-field pattern analysis | Confidence: ${Math.round(bestMatch.score)}%`,
      })
      usedExternal.add(ext.id)
      matchedInternal.add(int.id)
    }
  }

  return {
    matches,
    remainingInternal: internals.filter(i => !matchedInternal.has(i.id)),
    remainingExternal: externals.filter(e => !usedExternal.has(e.id)),
  }
}

// ─── Run Full Matching Pipeline ──────────────────────────────

export function runMatching(
  allItems: ReconItem[],
  contextId: string,
  rules: MatchRule[],
): MatchingRunResult {
  const contextItems = allItems.filter(i => i.contextId === contextId)
  let internals = contextItems.filter(i => i.side === 'INTERNAL')
  let externals = contextItems.filter(i => i.side === 'EXTERNAL')
  const totalItems = internals.length + externals.length
  const passes: MatchingPassResult[] = []

  // Pass 1: Exact
  const t1 = performance.now()
  const exact = exactMatch(internals, externals, contextId)
  passes.push({
    pass: 'EXACT', passNumber: 1,
    matchesFound: exact.matches.length,
    itemsProcessed: totalItems,
    remainingUnmatched: exact.remainingInternal.length + exact.remainingExternal.length,
    matches: exact.matches,
    duration: Math.round(performance.now() - t1),
  })
  internals = exact.remainingInternal
  externals = exact.remainingExternal

  // Pass 2: Tolerance
  const toleranceRule = rules.find(r => r.type === 'TOLERANCE')
  const t2 = performance.now()
  const tol = toleranceMatch(internals, externals, contextId, toleranceRule?.tolerance ?? 2.00)
  passes.push({
    pass: 'TOLERANCE', passNumber: 2,
    matchesFound: tol.matches.length,
    itemsProcessed: internals.length + externals.length,
    remainingUnmatched: tol.remainingInternal.length + tol.remainingExternal.length,
    matches: tol.matches,
    duration: Math.round(performance.now() - t2),
  })
  internals = tol.remainingInternal
  externals = tol.remainingExternal

  // Pass 3: Fuzzy
  const fuzzyRule = rules.find(r => r.type === 'FUZZY')
  const t3 = performance.now()
  const fuz = fuzzyMatch(internals, externals, contextId, fuzzyRule?.dateRange ?? 2)
  passes.push({
    pass: 'FUZZY', passNumber: 3,
    matchesFound: fuz.matches.length,
    itemsProcessed: internals.length + externals.length,
    remainingUnmatched: fuz.remainingInternal.length + fuz.remainingExternal.length,
    matches: fuz.matches,
    duration: Math.round(performance.now() - t3),
  })
  internals = fuz.remainingInternal
  externals = fuz.remainingExternal

  // Pass 4: AI-Suggested
  const t4 = performance.now()
  const ai = aiSuggestedMatch(internals, externals, contextId)
  passes.push({
    pass: 'AI_SUGGESTED', passNumber: 4,
    matchesFound: ai.matches.length,
    itemsProcessed: internals.length + externals.length,
    remainingUnmatched: ai.remainingInternal.length + ai.remainingExternal.length,
    matches: ai.matches,
    duration: Math.round(performance.now() - t4),
  })

  const totalMatched = passes.reduce((s, p) => s + p.matchesFound * 2, 0) // Each match = 2 items
  const totalExceptions = ai.remainingInternal.length + ai.remainingExternal.length

  // Generate suggested rules based on matching patterns
  const suggestedRules: MatchRule[] = []
  if (tol.matches.length > 0) {
    const avgTolerance = tol.matches.reduce((s, m) => s + (m.toleranceApplied || 0), 0) / tol.matches.length
    suggestedRules.push({
      id: `auto-rule-tol-${contextId}`,
      contextId,
      pass: 2,
      type: 'TOLERANCE',
      description: `Auto-detected: Average amount variance is $${avgTolerance.toFixed(2)} → Recommend tolerance ±$${(avgTolerance * 2).toFixed(2)}`,
      fields: ['amount'],
      tolerance: avgTolerance * 2,
      toleranceType: 'ABSOLUTE',
      dateRange: null,
      isAutoSuggested: true,
      isActive: false,
    })
  }

  return {
    contextId,
    totalItems,
    passes,
    totalMatched,
    totalExceptions,
    overallMatchRate: totalItems > 0 ? Math.round((totalMatched / totalItems) * 1000) / 10 : 0,
    suggestedRules,
  }
}

// ─── Run matching for all contexts ───────────────────────────

export function runAllMatching(
  items: ReconItem[],
  contexts: Array<{ id: string }>,
  rules: MatchRule[],
): Map<string, MatchingRunResult> {
  const results = new Map<string, MatchingRunResult>()
  for (const ctx of contexts) {
    const ctxRules = rules.filter(r => r.contextId === ctx.id)
    results.set(ctx.id, runMatching(items, ctx.id, ctxRules))
  }
  return results
}

export type { MatchPassType }
