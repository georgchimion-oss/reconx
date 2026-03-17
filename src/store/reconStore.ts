import { create } from 'zustand'
import { generateSeedData, type SeedData } from '../data/seedData'
import { runMatching } from '../data/matchingEngine'
import type {
  ReconContext, ReconItem, BalancePool, MatchRule,
  MatchingRunResult, Exception, WriteOffRequest, TeamMember,
  DashboardKPIs, UserRole, Case, AuditEvent, ReasonCode,
  MatchGroup, ReconciliationRun,
} from '../data/types'

interface ReconStore {
  // Data
  contexts: ReconContext[]
  items: ReconItem[]
  matchRules: MatchRule[]
  suggestedRules: MatchRule[]
  balancePools: BalancePool[]
  exceptions: Exception[]
  writeOffs: WriteOffRequest[]
  team: TeamMember[]
  kpis: DashboardKPIs
  cases: Case[]
  auditTrail: AuditEvent[]
  matchGroups: MatchGroup[]
  reconRuns: ReconciliationRun[]

  // UI State
  activeContextId: string
  activeRole: UserRole
  matchingResults: Map<string, MatchingRunResult>
  isMatchingRunning: boolean
  matchingProgress: number // 0-100

  // Actions
  initialize: () => void
  setActiveContext: (id: string) => void
  setActiveRole: (role: UserRole) => void
  runMatchingForContext: (contextId: string) => Promise<MatchingRunResult>
  approveBalancePool: (poolId: string) => void
  rejectBalancePool: (poolId: string) => void
  approveWriteOff: (woId: string) => void
  rejectWriteOff: (woId: string) => void
  acceptProposedMatch: (matchId: string) => void
  rejectProposedMatch: (matchId: string) => void
  assignReasonCode: (exceptionId: string, code: string) => void
  activateSuggestedRule: (ruleId: string) => void
  createWriteOffRequest: (exceptionId: string, comments: string) => void
  escalateToCase: (exceptionId: string) => void
  addNote: (exceptionId: string, note: string) => void
  assignException: (exceptionId: string, analystId: string) => void
  createManualMatch: (internalItemId: string, externalItemId: string, comment: string) => void
  createMultiMatch: (internalIds: string[], externalIds: string[], comment: string) => void
  resolveException: (exceptionId: string) => void
  updateCaseStatus: (caseId: string, status: Case['status']) => void
  breakMatchGroup: (groupId: string, reason: string) => void
  addGroupComment: (groupId: string, comment: string) => void
}

export const useReconStore = create<ReconStore>((set, get) => ({
  // Initial empty state
  contexts: [],
  items: [],
  matchRules: [],
  suggestedRules: [],
  balancePools: [],
  exceptions: [],
  writeOffs: [],
  team: [],
  kpis: {} as DashboardKPIs,
  cases: [],
  auditTrail: [],
  matchGroups: [],
  reconRuns: [],

  activeContextId: 'ctx-1',
  activeRole: 'SUPERVISOR',
  matchingResults: new Map(),
  isMatchingRunning: false,
  matchingProgress: 0,

  initialize: () => {
    const data: SeedData = generateSeedData()
    set({
      contexts: data.contexts,
      items: data.items,
      matchRules: data.matchRules,
      suggestedRules: data.suggestedRules,
      balancePools: data.balancePools,
      exceptions: data.exceptions,
      writeOffs: data.writeOffs,
      team: data.team,
      kpis: data.kpis,
      matchGroups: data.matchGroups,
      reconRuns: data.reconRuns,
    })
  },

  setActiveContext: (id) => set({ activeContextId: id }),
  setActiveRole: (role) => set({ activeRole: role }),

  runMatchingForContext: async (contextId: string) => {
    set({ isMatchingRunning: true, matchingProgress: 0 })
    const { items, matchRules, matchingResults } = get()
    const rules = matchRules.filter(r => r.contextId === contextId)

    const result = runMatching(items, contextId, rules)

    for (let i = 0; i < result.passes.length; i++) {
      set({ matchingProgress: ((i + 1) / result.passes.length) * 100 })
      await new Promise(r => setTimeout(r, 800))
    }

    const itemUpdates = new Map<string, { status: ReconItem['status']; matchId: string; matchPass: ReconItem['matchPass'] }>()

    for (const pass of result.passes) {
      for (const match of pass.matches) {
        const status = match.pass === 'AI_SUGGESTED' ? 'PROPOSED' as const : 'MATCHED' as const
        itemUpdates.set(match.internalItemId, { status, matchId: match.id, matchPass: match.pass })
        itemUpdates.set(match.externalItemId, { status, matchId: match.id, matchPass: match.pass })
      }
    }

    const updatedItems = items.map(item => {
      const update = itemUpdates.get(item.id)
      if (update) return { ...item, ...update }
      return item
    })

    const newResults = new Map(matchingResults)
    newResults.set(contextId, result)

    set({
      items: updatedItems,
      matchingResults: newResults,
      isMatchingRunning: false,
      matchingProgress: 100,
    })

    return result
  },

  approveBalancePool: (poolId) => {
    set(state => ({
      balancePools: state.balancePools.map(bp =>
        bp.id === poolId ? {
          ...bp,
          signOffStatus: 'APPROVED',
          signedOffBy: state.activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Evan Richards',
          signedOffAt: new Date().toISOString(),
        } : bp
      ),
    }))
  },

  rejectBalancePool: (poolId) => {
    set(state => ({
      balancePools: state.balancePools.map(bp =>
        bp.id === poolId ? { ...bp, signOffStatus: 'REJECTED', signedOffBy: null, signedOffAt: null } : bp
      ),
    }))
  },

  approveWriteOff: (woId) => {
    set(state => ({
      writeOffs: state.writeOffs.map(wo =>
        wo.id === woId ? {
          ...wo, status: 'APPROVED',
          approvedBy: 'Thomas Mueller',
          approvedAt: new Date().toISOString(),
        } : wo
      ),
    }))
  },

  rejectWriteOff: (woId) => {
    set(state => ({
      writeOffs: state.writeOffs.map(wo =>
        wo.id === woId ? { ...wo, status: 'REJECTED', approvedBy: null, approvedAt: null } : wo
      ),
    }))
  },

  acceptProposedMatch: (matchId) => {
    set(state => ({
      items: state.items.map(item =>
        item.matchId === matchId && item.status === 'PROPOSED'
          ? { ...item, status: 'MATCHED' }
          : item
      ),
      matchGroups: state.matchGroups.map(mg =>
        mg.id === matchId || mg.internalItems.some(i => i.matchId === matchId) || mg.externalItems.some(i => i.matchId === matchId)
          ? { ...mg, status: 'CONFIRMED' }
          : mg
      ),
    }))
  },

  rejectProposedMatch: (matchId) => {
    set(state => ({
      items: state.items.map(item =>
        item.matchId === matchId && item.status === 'PROPOSED'
          ? { ...item, status: 'UNMATCHED', matchId: null, matchPass: null, matchGroupId: null }
          : item
      ),
    }))
  },

  assignReasonCode: (exceptionId, code) => {
    set(state => ({
      exceptions: state.exceptions.map(exc =>
        exc.id === exceptionId ? { ...exc, reasonCode: code as Exception['reasonCode'] } : exc
      ),
    }))
  },

  activateSuggestedRule: (ruleId) => {
    set(state => ({
      suggestedRules: state.suggestedRules.map(r =>
        r.id === ruleId ? { ...r, isActive: true } : r
      ),
      matchRules: [
        ...state.matchRules,
        ...state.suggestedRules.filter(r => r.id === ruleId).map(r => ({ ...r, isActive: true })),
      ],
    }))
  },

  createWriteOffRequest: (exceptionId, comments) => {
    const { exceptions, activeRole } = get()
    const exc = exceptions.find(e => e.id === exceptionId)
    if (!exc) return
    const user = activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const wo: WriteOffRequest = {
      id: `wo-${Date.now()}`,
      itemId: exc.itemId,
      item: exc.item,
      contextId: exc.contextId,
      amount: Math.abs(exc.item.amount),
      reasonCode: exc.reasonCode as ReasonCode,
      requestedBy: user,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      approvedBy: null,
      approvedAt: null,
      comments,
    }
    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'WRITE_OFF_REQUESTED',
      detail: `Write-off requested for ${exc.item.reference} ($${Math.abs(exc.item.amount).toLocaleString()}) — ${comments}`,
      contextId: exc.contextId,
      itemId: exc.itemId,
    }
    set(state => ({
      writeOffs: [...state.writeOffs, wo],
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  escalateToCase: (exceptionId) => {
    const { exceptions, activeRole } = get()
    const exc = exceptions.find(e => e.id === exceptionId)
    if (!exc) return
    const user = activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const newCase: Case = {
      id: `case-${Date.now()}`,
      exceptionId,
      contextId: exc.contextId,
      item: exc.item,
      status: 'OPEN',
      priority: exc.priority,
      assignedTo: exc.assignedTo,
      createdBy: user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [{
        id: `ae-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        user,
        action: 'CASE_CREATED',
        detail: `Case escalated from exception ${exc.id} — ${exc.item.reference}`,
      }],
      amount: Math.abs(exc.item.amount),
    }
    const event: AuditEvent = {
      id: `ae-${Date.now()}-2`,
      timestamp: new Date().toISOString(),
      user,
      action: 'CASE_ESCALATED',
      detail: `Exception ${exc.id} escalated to case ${newCase.id}`,
      contextId: exc.contextId,
    }
    set(state => ({
      cases: [...state.cases, newCase],
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  addNote: (exceptionId, note) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'NOTE_ADDED',
      detail: note,
    }
    set(state => ({
      exceptions: state.exceptions.map(exc =>
        exc.id === exceptionId ? { ...exc, notes: [...exc.notes, `${user}: ${note}`] } : exc
      ),
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  assignException: (exceptionId, analystName) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'EXCEPTION_ASSIGNED',
      detail: `Exception reassigned to ${analystName}`,
    }
    set(state => ({
      exceptions: state.exceptions.map(exc =>
        exc.id === exceptionId ? { ...exc, assignedTo: analystName } : exc
      ),
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  createManualMatch: (internalItemId, externalItemId, comment) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const matchId = `manual-${Date.now()}`
    const groupId = `mg-manual-${Date.now()}`
    const { items } = get()
    const intItem = items.find(i => i.id === internalItemId)
    const extItem = items.find(i => i.id === externalItemId)

    const newGroup: MatchGroup = {
      id: groupId,
      contextId: intItem?.contextId ?? '',
      type: 'MANUAL',
      status: 'CONFIRMED',
      pass: 'MANUAL',
      confidence: 100,
      internalItems: intItem ? [intItem] : [],
      externalItems: extItem ? [extItem] : [],
      internalTotal: intItem?.amount ?? 0,
      externalTotal: extItem?.amount ?? 0,
      netDifference: Math.abs((intItem?.amount ?? 0) - (extItem?.amount ?? 0)),
      toleranceApplied: null,
      fieldsMatched: ['manual'],
      ruleUsed: `Manual match by ${user}`,
      matchedBy: user,
      matchedAt: new Date().toISOString(),
      brokenBy: null,
      brokenAt: null,
      breakReason: null,
      comments: comment ? [comment] : [],
    }

    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'MANUAL_MATCH',
      detail: `Manual match created: ${internalItemId} ↔ ${externalItemId} — ${comment}`,
      contextId: intItem?.contextId,
      itemId: internalItemId,
      matchGroupId: groupId,
    }
    set(state => ({
      items: state.items.map(item => {
        if (item.id === internalItemId || item.id === externalItemId) {
          return { ...item, status: 'MATCHED' as const, matchId, matchPass: 'MANUAL' as const, matchGroupId: groupId }
        }
        return item
      }),
      exceptions: state.exceptions.filter(exc =>
        exc.itemId !== internalItemId && exc.itemId !== externalItemId
      ),
      matchGroups: [...state.matchGroups, newGroup],
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  createMultiMatch: (internalIds, externalIds, comment) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const groupId = `mg-multi-${Date.now()}`
    const matchId = `multi-${Date.now()}`
    const { items } = get()
    const intItems = items.filter(i => internalIds.includes(i.id))
    const extItems = items.filter(i => externalIds.includes(i.id))
    const intTotal = intItems.reduce((s, i) => s + i.amount, 0)
    const extTotal = extItems.reduce((s, i) => s + i.amount, 0)

    const groupType = internalIds.length === 1 && externalIds.length > 1 ? '1:N'
      : internalIds.length > 1 && externalIds.length === 1 ? 'N:1'
      : 'N:N'

    const newGroup: MatchGroup = {
      id: groupId,
      contextId: intItems[0]?.contextId ?? '',
      type: groupType,
      status: 'CONFIRMED',
      pass: 'MANUAL',
      confidence: 100,
      internalItems: intItems,
      externalItems: extItems,
      internalTotal: intTotal,
      externalTotal: extTotal,
      netDifference: Math.abs(intTotal - extTotal),
      toleranceApplied: null,
      fieldsMatched: ['manual'],
      ruleUsed: `Manual ${groupType} match by ${user}`,
      matchedBy: user,
      matchedAt: new Date().toISOString(),
      brokenBy: null,
      brokenAt: null,
      breakReason: null,
      comments: comment ? [comment] : [],
    }

    const allIds = new Set([...internalIds, ...externalIds])
    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'MULTI_MATCH',
      detail: `${groupType} match created: ${internalIds.length} internal ↔ ${externalIds.length} external — ${comment}`,
      contextId: intItems[0]?.contextId,
      matchGroupId: groupId,
    }
    set(state => ({
      items: state.items.map(item => {
        if (allIds.has(item.id)) {
          return { ...item, status: 'MATCHED' as const, matchId, matchPass: 'MANUAL' as const, matchGroupId: groupId }
        }
        return item
      }),
      exceptions: state.exceptions.filter(exc => !allIds.has(exc.itemId)),
      matchGroups: [...state.matchGroups, newGroup],
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  resolveException: (exceptionId) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'EXCEPTION_RESOLVED',
      detail: `Exception ${exceptionId} marked as resolved`,
    }
    set(state => ({
      exceptions: state.exceptions.filter(exc => exc.id !== exceptionId),
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  updateCaseStatus: (caseId, status) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'CASE_STATUS_UPDATED',
      detail: `Case ${caseId} status changed to ${status}`,
    }
    set(state => ({
      cases: state.cases.map(c =>
        c.id === caseId ? { ...c, status, updatedAt: new Date().toISOString() } : c
      ),
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  breakMatchGroup: (groupId, reason) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    const { matchGroups } = get()
    const group = matchGroups.find(g => g.id === groupId)
    if (!group) return

    const allItemIds = new Set([
      ...group.internalItems.map(i => i.id),
      ...group.externalItems.map(i => i.id),
    ])

    const event: AuditEvent = {
      id: `ae-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'MATCH_GROUP_BROKEN',
      detail: `Match group ${groupId} (${group.type}) broken apart — Reason: ${reason}`,
      contextId: group.contextId,
      matchGroupId: groupId,
    }
    set(state => ({
      matchGroups: state.matchGroups.map(mg =>
        mg.id === groupId ? { ...mg, status: 'BROKEN', brokenBy: user, brokenAt: new Date().toISOString(), breakReason: reason } : mg
      ),
      items: state.items.map(item =>
        allItemIds.has(item.id) ? { ...item, status: 'UNMATCHED', matchId: null, matchPass: null, matchGroupId: null } : item
      ),
      auditTrail: [event, ...state.auditTrail],
    }))
  },

  addGroupComment: (groupId, comment) => {
    const user = get().activeRole === 'SUPERVISOR' ? 'Thomas Mueller' : 'Sarah Chen'
    set(state => ({
      matchGroups: state.matchGroups.map(mg =>
        mg.id === groupId ? { ...mg, comments: [...mg.comments, `${user}: ${comment}`] } : mg
      ),
    }))
  },
}))
