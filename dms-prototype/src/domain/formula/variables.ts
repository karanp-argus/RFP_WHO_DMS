/**
 * Turning the variable list into the two maps the engine needs.
 *
 * Kept in `domain/` and taking `Variable[]` as an argument rather than reading
 * a seed file, so the same functions serve the mock client and a real xMart
 * `getVariables()` response without change.
 *
 * The rule being encoded is CLAUDE.md's: **aggregates are never generated.**
 * Every parent and every total is `isCalculated: true` and gets its value from
 * its children here, which is what puts the engine on screen in the demo rather
 * than in a paragraph of the proposal.
 */

import type { Variable } from '../types'

/** Totals are level-1 siblings (`HF TOT`) rather than parents of anything. */
const TOTAL_SUFFIX = ' TOT'

export function isTotalCode(code: string): boolean {
  return code.endsWith(TOTAL_SUFFIX)
}

/**
 * Aggregate code → the codes it sums.
 *
 * Two shapes, both from `classifications.ts`:
 *
 *  · **Parents** (`HF.1`) own the codes whose `parentCode` points at them.
 *  · **Totals** (`HF TOT`) have no children by that rule — they are declared as
 *    level-1 siblings of the categories they cover — so they take every level-1
 *    code in their dimension except themselves. `HF TOT` therefore equals
 *    `HF.1 + HF.2 + HF.3 + HF.4 + HF.nec`, which is the seeded `CHE` formula,
 *    and the two agreeing is asserted in the Phase 3 tests.
 */
export function aggregatesFromVariables(
  variables: readonly Variable[],
): Map<string, readonly string[]> {
  const childrenByParent = new Map<string, string[]>()
  for (const v of variables) {
    if (v.parentCode == null) continue
    const list = childrenByParent.get(v.parentCode)
    if (list) list.push(v.code)
    else childrenByParent.set(v.parentCode, [v.code])
  }

  const out = new Map<string, readonly string[]>()
  for (const v of variables) {
    if (!v.isCalculated) continue

    const children = childrenByParent.get(v.code)
    if (children && children.length > 0) {
      out.set(v.code, children)
      continue
    }

    if (isTotalCode(v.code) && v.dimension != null) {
      const members = variables
        .filter(
          (other) =>
            other.dimension === v.dimension &&
            other.level === 1 &&
            other.code !== v.code &&
            !isTotalCode(other.code),
        )
        .map((other) => other.code)
      if (members.length > 0) out.set(v.code, members)
    }
  }
  return out
}

/** Codes that can carry a reported value — the leaves the warehouse holds. */
export function baseVariableCodes(variables: readonly Variable[]): string[] {
  return variables.filter((v) => !v.isCalculated).map((v) => v.code)
}
