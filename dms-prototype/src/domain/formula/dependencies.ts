/**
 * Dependency graph, topological order, and cycle detection.
 *
 * Formulas reference formulas: `CHE%GDP_SHA2011` → `CHE` → `HF.1` → `HF.1.1`.
 * Evaluating by string substitution would expand that chain textually and, on a
 * cycle, never terminate. So the engine builds a real graph, orders it, and
 * refuses to start on anything circular.
 *
 * **One subtlety worth stating, because it looks like a bug otherwise.** The
 * seeded set contains `GGHE-D` whose expression is `GGHE-D` — the FR lists it
 * among the indicators, but it is sourced from the macro series rather than
 * derived. A reference from a formula to *its own code* is therefore not a
 * cycle when that code is also a real variable: it is an identity onto the
 * underlying data, and the evaluator resolves it that way. When the code is
 * *not* a variable, the same self-reference is a genuine cycle and is reported.
 */

import { referencedCodes, type AstNode } from './ast'
import { cycleError } from './errors'

export interface GraphNode {
  code: string
  /** Formula codes this one depends on, in first-appearance order. */
  dependencies: readonly string[]
}

export interface DependencyGraph {
  /** Formula codes, in the order they must be evaluated: dependencies first. */
  order: readonly string[]
  /** code → the formula codes it reads. */
  dependencies: ReadonlyMap<string, readonly string[]>
  /** code → the formula codes that read it. Drives Phase 4's recompute. */
  dependents: ReadonlyMap<string, readonly string[]>
  /** Every cycle found, each as a path that returns to its start. */
  cycles: readonly (readonly string[])[]
}

export interface BuildGraphOptions {
  /**
   * Whether a code names a variable that carries data of its own. Used only to
   * decide whether a formula's self-reference is an identity or a cycle.
   */
  isBaseVariable?: (code: string) => boolean
}

/**
 * Build the graph from parsed formulas.
 *
 * Edges point from a formula to the formulas it *depends on*, and `order` lists
 * dependencies before dependents so a caller can evaluate straight down it.
 * Codes that are variables rather than formulas are leaves and do not appear.
 */
export function buildDependencyGraph(
  formulas: ReadonlyMap<string, AstNode>,
  options: BuildGraphOptions = {},
): DependencyGraph {
  const isBaseVariable = options.isBaseVariable ?? (() => false)

  const dependencies = new Map<string, readonly string[]>()
  const dependents = new Map<string, string[]>()

  for (const [code, ast] of formulas) {
    const deps: string[] = []
    for (const ref of referencedCodes(ast)) {
      if (!formulas.has(ref)) continue
      // Self-reference onto a real variable is an identity, not an edge.
      if (ref === code && isBaseVariable(code)) continue
      deps.push(ref)
    }
    dependencies.set(code, deps)
  }

  for (const [code, deps] of dependencies) {
    if (!dependents.has(code)) dependents.set(code, [])
    for (const d of deps) {
      const list = dependents.get(d)
      if (list) list.push(code)
      else dependents.set(d, [code])
    }
  }

  const { order, cycles } = topologicalOrder(dependencies)
  return { order, dependencies, dependents, cycles }
}

/* --------------------------------------------------------------------------
   Ordering
   -------------------------------------------------------------------------- */

/**
 * Kahn's algorithm, with the leftovers handed to a DFS that names the cycles.
 *
 * Kahn alone would tell us *that* something is circular; the RFP's demo needs
 * to say *which* — "CHE → CHE%GDP_SHA2011 → CHE" — so the second pass exists
 * purely to produce a readable path.
 */
function topologicalOrder(dependencies: ReadonlyMap<string, readonly string[]>): {
  order: string[]
  cycles: string[][]
} {
  const remaining = new Map<string, number>()
  for (const [code, deps] of dependencies) {
    remaining.set(code, deps.filter((d) => dependencies.has(d)).length)
  }

  const ready: string[] = []
  for (const [code, count] of remaining) if (count === 0) ready.push(code)
  // Stable output regardless of Map insertion order, so the demo screen and the
  // tests agree run to run.
  ready.sort()

  const order: string[] = []
  while (ready.length > 0) {
    const code = ready.shift()
    if (code == null) break
    order.push(code)
    for (const [other, deps] of dependencies) {
      if (!deps.includes(code)) continue
      const left = (remaining.get(other) ?? 0) - 1
      remaining.set(other, left)
      if (left === 0) {
        ready.push(other)
        ready.sort()
      }
    }
    remaining.delete(code)
  }

  const stuck = [...remaining.keys()]
  return { order, cycles: stuck.length === 0 ? [] : findCycles(dependencies, stuck) }
}

/** DFS over the nodes Kahn could not place, recording each distinct loop. */
function findCycles(
  dependencies: ReadonlyMap<string, readonly string[]>,
  stuck: readonly string[],
): string[][] {
  const cycles: string[][] = []
  const seenSignatures = new Set<string>()
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (code: string): void => {
    const mark = state.get(code)
    if (mark === 'done') return
    if (mark === 'visiting') {
      const from = stack.indexOf(code)
      if (from < 0) return
      const path = [...stack.slice(from), code]
      // Normalise so A→B→A and B→A→B are reported once.
      const signature = [...path.slice(0, -1)].sort().join('|')
      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature)
        cycles.push(path)
      }
      return
    }

    state.set(code, 'visiting')
    stack.push(code)
    for (const dep of dependencies.get(code) ?? []) {
      if (dependencies.has(dep)) visit(dep)
    }
    stack.pop()
    state.set(code, 'done')
  }

  for (const code of [...stuck].sort()) visit(code)
  return cycles
}

/* --------------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------------- */

/** Throws a `FormulaError` naming the first cycle, if the graph has any. */
export function assertAcyclic(graph: DependencyGraph): void {
  const first = graph.cycles[0]
  if (first) throw cycleError(first)
}

/** Cycles this code takes part in — an empty array when it is safe to evaluate. */
export function cyclesInvolving(graph: DependencyGraph, code: string): readonly (readonly string[])[] {
  return graph.cycles.filter((c) => c.includes(code))
}

/**
 * The formulas that must be evaluated before `code`, in order, `code` last.
 * This is the chain the inspector renders as "CHE → CHE%GDP_SHA2011".
 */
export function evaluationChain(graph: DependencyGraph, code: string): string[] {
  const needed = new Set<string>()

  const collect = (c: string, seen: Set<string>): void => {
    if (seen.has(c)) return
    seen.add(c)
    for (const dep of graph.dependencies.get(c) ?? []) collect(dep, seen)
    needed.add(c)
  }
  collect(code, new Set())

  // Reuse the graph's global ordering so the chain is consistent with it.
  const chain = graph.order.filter((c) => needed.has(c))
  // A code caught in a cycle never reaches `order`; keep it visible anyway.
  for (const c of needed) if (!chain.includes(c)) chain.push(c)
  return chain
}

/**
 * Everything that must be recomputed when `code` changes, nearest first.
 * Phase 4's grid uses this to refresh only the cells an edit actually touched.
 */
export function transitiveDependents(graph: DependencyGraph, code: string): string[] {
  const out: string[] = []
  const seen = new Set<string>([code])
  const queue = [...(graph.dependents.get(code) ?? [])]

  while (queue.length > 0) {
    const next = queue.shift()
    if (next == null || seen.has(next)) continue
    seen.add(next)
    out.push(next)
    queue.push(...(graph.dependents.get(next) ?? []))
  }
  return out
}
