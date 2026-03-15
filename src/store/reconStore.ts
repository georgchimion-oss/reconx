import { create } from 'zustand'
import { generateSeedData, type SeedData } from '../data/seedData'
import { runMatching } from '../data/matchingEngine'
import type {
  ReconContext, ReconItem, BalancePool, MatchRule,
  MatchingRunResult, Exception, WriteOffRequest, TeamMember,
  DashboardKPIs, UserRole,
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
    })
  },

  setActiveContext: (id) => set({ activeContextId: id }),
  setActiveRole: (role) => set({ activeRole: role }),

  runMatchingForContext: async (contextId: string) => {
    set({ isMatchingRunning: true, matchingProgress: 0 })
    const { items, matchRules, matchingResults } = get()
    const rules = matchRules.filter(r => r.contextId === contextId)

    // Simulate progressive matching with delays
    const result = runMatching(items, contextId, rules)

    // Animate progress through each pass
    for (let i = 0; i < result.passes.length; i++) {
      set({ matchingProgress: ((i + 1) / result.passes.length) * 100 })
      await new Promise(r => setTimeout(r, 800))
    }

    // Update items with match status
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
    }))
  },

  rejectProposedMatch: (matchId) => {
    set(state => ({
      items: state.items.map(item =>
        item.matchId === matchId && item.status === 'PROPOSED'
          ? { ...item, status: 'UNMATCHED', matchId: null, matchPass: null }
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
}))
