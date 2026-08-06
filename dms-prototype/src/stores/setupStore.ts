/**
 * Setup module UI state.
 *
 * Holds the things UC015/UC016/UC018 make user- or admin-configurable and that
 * must survive a reload: column order per component, hidden columns, and edits
 * to lists of values. Persisted, because UC015's acceptance is explicitly that
 * the order sticks — "A regular user connects to DMS, Setup module, Countries.
 * The fields displayed are ordered as per the Administrator action."
 *
 * Component *data* is not held here; that comes from `XMartClient`.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AttributeDef } from '@/domain/types'

/** The Setup tabs that render a component grid. */
export type SetupComponentId =
  | 'countries'
  | 'currencies'
  | 'classifications'
  | 'crosses'
  | 'metadata'
  | 'formulas'
  | 'reporting'

interface ComponentUiState {
  /** Column keys in display order (UC015). Empty = use the attribute defaults. */
  columnOrder: string[]
  /** Column keys explicitly hidden. */
  hidden: string[]
}

interface SetupState {
  byComponent: Partial<Record<SetupComponentId, ComponentUiState>>
  /**
   * UC016 — edited lists of values, keyed `${component}.${attributeKey}`.
   * An entry here overrides the seeded `AttributeDef.lov`.
   */
  lovOverrides: Record<string, string[]>
  /**
   * UC018 (bonus) — attributes an administrator added at runtime, keyed by
   * component. These are appended to the seeded definitions.
   */
  customAttributes: Partial<Record<SetupComponentId, AttributeDef[]>>
  /**
   * UC022 — `groupable` overrides, keyed `${component}.${attributeKey}`.
   * Flipping this is what makes an attribute appear as a grouping option in
   * Workbooks, Reports and Quality Checks.
   */
  groupableOverrides: Record<string, boolean>

  setColumnOrder: (c: SetupComponentId, order: string[]) => void
  toggleColumn: (c: SetupComponentId, key: string) => void
  resetColumns: (c: SetupComponentId) => void
  setLov: (c: SetupComponentId, key: string, values: string[]) => void
  addAttribute: (c: SetupComponentId, attr: AttributeDef) => void
  setGroupable: (c: SetupComponentId, key: string, groupable: boolean) => void
}

const EMPTY: ComponentUiState = { columnOrder: [], hidden: [] }

export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      byComponent: {},
      lovOverrides: {},
      customAttributes: {},
      groupableOverrides: {},

      setColumnOrder: (c, order) =>
        set((s) => ({
          byComponent: {
            ...s.byComponent,
            [c]: { ...(s.byComponent[c] ?? EMPTY), columnOrder: order },
          },
        })),

      toggleColumn: (c, key) =>
        set((s) => {
          const cur = s.byComponent[c] ?? EMPTY
          const hidden = cur.hidden.includes(key)
            ? cur.hidden.filter((k) => k !== key)
            : [...cur.hidden, key]
          return { byComponent: { ...s.byComponent, [c]: { ...cur, hidden } } }
        }),

      resetColumns: (c) =>
        set((s) => ({ byComponent: { ...s.byComponent, [c]: { ...EMPTY } } })),

      setLov: (c, key, values) =>
        set((s) => ({ lovOverrides: { ...s.lovOverrides, [`${c}.${key}`]: values } })),

      addAttribute: (c, attr) =>
        set((s) => ({
          customAttributes: {
            ...s.customAttributes,
            [c]: [...(s.customAttributes[c] ?? []), attr],
          },
        })),

      setGroupable: (c, key, groupable) =>
        set((s) => ({
          groupableOverrides: { ...s.groupableOverrides, [`${c}.${key}`]: groupable },
        })),
    }),
    { name: 'dms-setup', version: 1 },
  ),
)

/* --------------------------------------------------------------------------
   Selectors
   -------------------------------------------------------------------------- */

/**
 * The store slices `effectiveAttributes` needs.
 *
 * Passed in explicitly rather than read via `getState()`. Two reasons: a
 * component's `useMemo` then has honest, lint-checkable dependencies, and the
 * function stays pure so the UC015/UC016/UC022 merge logic is unit-testable
 * without a store.
 */
export interface AttributeOverrides {
  columnOrder?: string[]
  custom?: readonly AttributeDef[]
  lovOverrides?: Record<string, string[]>
  groupableOverrides?: Record<string, boolean>
}

/**
 * Effective attribute definitions for a component: seeded defaults, plus any
 * runtime additions, with LOV and groupable overrides applied, in the user's
 * column order.
 */
export function effectiveAttributes(
  component: SetupComponentId,
  seeded: readonly AttributeDef[],
  overrides: AttributeOverrides = {},
): AttributeDef[] {
  const { columnOrder = [], custom = [], lovOverrides = {}, groupableOverrides = {} } = overrides

  const all = [...seeded, ...custom].map((a) => {
    const lov = lovOverrides[`${component}.${a.key}`]
    const groupable = groupableOverrides[`${component}.${a.key}`]
    return {
      ...a,
      ...(lov ? { lov } : {}),
      ...(groupable != null ? { groupable } : {}),
    }
  })

  if (columnOrder.length === 0) return all.sort((a, b) => a.order - b.order)

  // Ordered keys first, then anything the stored order does not mention — so a
  // newly added attribute appears rather than vanishing.
  const rank = new Map(columnOrder.map((k, i) => [k, i]))
  return all.sort((a, b) => {
    const ra = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER
    return ra === rb ? a.order - b.order : ra - rb
  })
}

/**
 * Hook form — subscribes to exactly the slices that affect the result, so any
 * Setup surface gets the effective attributes with correct reactivity.
 */
export function useEffectiveAttributes(
  component: SetupComponentId,
  seeded: readonly AttributeDef[],
): AttributeDef[] {
  const columnOrder = useSetupStore((s) => s.byComponent[component]?.columnOrder)
  const custom = useSetupStore((s) => s.customAttributes[component])
  const lovOverrides = useSetupStore((s) => s.lovOverrides)
  const groupableOverrides = useSetupStore((s) => s.groupableOverrides)

  return effectiveAttributes(component, seeded, {
    ...(columnOrder ? { columnOrder } : {}),
    ...(custom ? { custom } : {}),
    lovOverrides,
    groupableOverrides,
  })
}

/** Attribute keys flagged groupable — the UC022 filter/grouping options. */
export function groupableKeys(
  component: SetupComponentId,
  seeded: readonly AttributeDef[],
  overrides: AttributeOverrides = {},
): string[] {
  return effectiveAttributes(component, seeded, overrides)
    .filter((a) => a.groupable)
    .map((a) => a.key)
}
