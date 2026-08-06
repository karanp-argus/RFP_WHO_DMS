/**
 * Quality Checks module state.
 *
 * Holds the four things UC048–UC055 make user- or admin-configurable and that
 * must survive a reload: rule edits, rules people created, the global threshold
 * set, and the history of runs.
 *
 * **Findings are deliberately not persisted.** A regional run produces on the
 * order of a thousand findings, and a handful of those runs would fill the same
 * `localStorage` quota the observation overlay depends on — the one thing
 * PROTOTYPE_PLAN §7 names as a risk to manage. So run *summaries* persist,
 * which is what UC055's "report history" is about, and the findings themselves
 * live in memory for the session. A history entry whose findings are gone
 * offers to run again rather than showing an empty table, which is honest about
 * what it has.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEMO_NOW } from '@/domain/constants'
import {
  PREDEFINED_BY_ID,
  SEEDED_QC_RULES,
  effectiveThresholds,
  type QcFinding,
  type QcRule,
  type QcRuleStat,
  type QcRuleType,
  type QcRunResult,
  type QcRunSummary,
  type QcThresholdPair,
  type QcThresholdSet,
} from '@/domain/qc'

/** A run as the history list holds it — summary and per-rule accounting only. */
export interface QcRunRecord {
  summary: QcRunSummary
  ruleStats: QcRuleStat[]
}

interface QcState {
  /**
   * Rules that differ from the delivered set: an edited dev rule keyed by its
   * own id, or a rule someone created. Merged over `SEEDED_QC_RULES` by
   * `allRules`, so a rule the next release changes is not frozen at whatever it
   * was when someone last opened the editor.
   */
  ruleEdits: Record<string, QcRule>
  /** Ids of user-created rules that have been removed. Delivered rules are never deleted. */
  removedRuleIds: string[]
  /** UC054 — the administrator's threshold set, as a diff over the delivered one. */
  thresholdOverrides: Partial<Record<QcRuleType, QcThresholdPair>>
  /** UC055 — the persistent report history, newest first. */
  runs: QcRunRecord[]

  saveRule: (rule: QcRule) => void
  removeRule: (id: string) => void
  /** UC053 — restore a delivered rule to the definition DMS shipped with. */
  resetRule: (id: string) => void
  toggleRule: (id: string, isEnabled: boolean) => void
  /** UC048 — the one-click clear the use case asks for. */
  clearExclusions: (id: string) => void
  importRules: (rules: readonly QcRule[]) => void

  setThreshold: (type: QcRuleType, pair: QcThresholdPair) => void
  resetThresholds: () => void

  recordRun: (result: QcRunResult) => void
  clearHistory: () => void
}

/** Keep the history readable rather than unbounded. */
const MAX_HISTORY = 20

export const useQcStore = create<QcState>()(
  persist(
    (set) => ({
      ruleEdits: {},
      removedRuleIds: [],
      thresholdOverrides: {},
      runs: [],

      saveRule: (rule) =>
        set((s) => ({
          ruleEdits: {
            ...s.ruleEdits,
            [rule.id]: { ...rule, updatedUtc: new Date(DEMO_NOW.getTime()).toISOString() },
          },
          removedRuleIds: s.removedRuleIds.filter((id) => id !== rule.id),
        })),

      removeRule: (id) =>
        set((s) => {
          const rest = { ...s.ruleEdits }
          delete rest[id]
          return {
            ruleEdits: rest,
            // A delivered rule cannot be deleted, only disabled — the same rule
            // UC012 applies to users, for the same reason: something else may
            // reference it, and a report in the history names it.
            removedRuleIds: PREDEFINED_BY_ID.has(id)
              ? s.removedRuleIds
              : [...new Set([...s.removedRuleIds, id])],
          }
        }),

      resetRule: (id) =>
        set((s) => {
          const rest = { ...s.ruleEdits }
          delete rest[id]
          return { ruleEdits: rest }
        }),

      toggleRule: (id, isEnabled) =>
        set((s) => {
          const current = s.ruleEdits[id] ?? SEEDED_QC_RULES.find((r) => r.id === id)
          if (!current) return s
          return { ruleEdits: { ...s.ruleEdits, [id]: { ...current, isEnabled } } }
        }),

      clearExclusions: (id) =>
        set((s) => {
          const current = s.ruleEdits[id] ?? SEEDED_QC_RULES.find((r) => r.id === id)
          if (!current) return s
          return { ruleEdits: { ...s.ruleEdits, [id]: { ...current, excludedCountries: [] } } }
        }),

      importRules: (rules) =>
        set((s) => {
          const next = { ...s.ruleEdits }
          for (const rule of rules) next[rule.id] = rule
          return {
            ruleEdits: next,
            removedRuleIds: s.removedRuleIds.filter((id) => !rules.some((r) => r.id === id)),
          }
        }),

      setThreshold: (type, pair) =>
        set((s) => ({ thresholdOverrides: { ...s.thresholdOverrides, [type]: pair } })),

      resetThresholds: () => set({ thresholdOverrides: {} }),

      recordRun: (result) =>
        set((s) => ({
          runs: [
            { summary: result.summary, ruleStats: result.ruleStats },
            ...s.runs.filter((r) => r.summary.id !== result.summary.id),
          ].slice(0, MAX_HISTORY),
        })),

      clearHistory: () => set({ runs: [] }),
    }),
    {
      name: 'dms-qc',
      version: 1,
      // Everything here is small and all of it is meant to survive a reload —
      // unlike the workbook store, which partializes its session state away.
      // The findings are the exception, and they never enter the store at all.
      partialize: (s) => ({
        ruleEdits: s.ruleEdits,
        removedRuleIds: s.removedRuleIds,
        thresholdOverrides: s.thresholdOverrides,
        runs: s.runs,
      }),
    },
  ),
)

/* --------------------------------------------------------------------------
   In-memory findings
   -------------------------------------------------------------------------- */

/**
 * Findings for runs made in this session, keyed by run id.
 *
 * A plain module-level map rather than store state: putting a thousand findings
 * into a persisted Zustand store would either blow the quota or force a
 * `partialize` that silently drops them, and a store field that silently does
 * not persist is worse than one that was never there. Cleared by a reload,
 * which is exactly what the history list tells the user.
 */
const findingsByRun = new Map<string, QcFinding[]>()

export function rememberFindings(runId: string, findings: readonly QcFinding[]): void {
  findingsByRun.set(runId, [...findings])
  // Hold only the few most recent runs: a demo session can produce a dozen, and
  // there is no reason for the first one to still be in memory.
  if (findingsByRun.size > 5) {
    const oldest = findingsByRun.keys().next().value
    if (oldest != null) findingsByRun.delete(oldest)
  }
}

export function recallFindings(runId: string): QcFinding[] | undefined {
  return findingsByRun.get(runId)
}

/* --------------------------------------------------------------------------
   Selectors
   -------------------------------------------------------------------------- */

/**
 * The delivered set with edits applied, removals dropped, and created rules
 * appended.
 *
 * Pure and taking its state as arguments, for the same reason
 * `effectiveAttributes` in `setupStore` does: a component's `useMemo` gets
 * honest dependencies, and the merge is testable without a store.
 */
export function allRules(
  ruleEdits: Record<string, QcRule>,
  removedRuleIds: readonly string[],
): QcRule[] {
  const removed = new Set(removedRuleIds)
  const out: QcRule[] = []
  const seen = new Set<string>()

  for (const rule of SEEDED_QC_RULES) {
    if (removed.has(rule.id)) continue
    seen.add(rule.id)
    out.push(ruleEdits[rule.id] ?? rule)
  }
  // Rules created since, in creation order.
  for (const [id, rule] of Object.entries(ruleEdits)) {
    if (seen.has(id) || removed.has(id)) continue
    out.push(rule)
  }
  return out
}

/**
 * UC050 — *"custom rules private to their author and visible to admins"*.
 *
 * A private rule belongs to its author. Administrators see every rule, which is
 * what makes them able to promote one to the shared set; regular users see the
 * shared ones plus their own.
 */
export function visibleRules(
  rules: readonly QcRule[],
  userEmail: string | undefined,
  isAdmin: boolean,
): QcRule[] {
  if (isAdmin) return [...rules]
  return rules.filter((r) => r.visibility === 'shared' || r.createdBy === userEmail)
}

/** True when a delivered rule has been changed and can be reset (UC053). */
export function isRuleModified(rule: QcRule, ruleEdits: Record<string, QcRule>): boolean {
  const delivered = PREDEFINED_BY_ID.get(rule.id)
  return delivered != null && ruleEdits[rule.id] != null
}

/** Hook form of the effective UC054 threshold set. */
export function useQcThresholds(): QcThresholdSet {
  const overrides = useQcStore((s) => s.thresholdOverrides)
  return effectiveThresholds(overrides)
}
