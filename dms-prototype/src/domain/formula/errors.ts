/**
 * Formula engine errors.
 *
 * One error type with a `kind` discriminator rather than a class hierarchy: the
 * UI needs to *render* the distinction (a syntax error highlights a position, a
 * cycle names the loop) and a discriminated union survives the structured clone
 * a store or a worker would apply to it.
 *
 * Every error carries enough to point at the problem — `position` for the
 * character offset in the source expression, `codes` for the codes involved.
 */

export type FormulaErrorKind =
  /** The tokeniser or parser could not read the expression. */
  | 'syntax'
  /** `FOO(...)` where FOO is not one of the ten supported functions. */
  | 'unknown-function'
  /** Right function, wrong number of arguments. */
  | 'arity'
  /** A reference that is neither a known variable nor a known formula. */
  | 'unknown-reference'
  /** A → B → A. Reported, never entered. */
  | 'cycle'
  /** A function argument that must be a plain reference was an expression. */
  | 'reference-required'

export class FormulaError extends Error {
  readonly kind: FormulaErrorKind
  /** Character offset into the source expression, when known. */
  readonly position: number | null
  /** Variable/formula codes the error concerns — the cycle path, for a cycle. */
  readonly codes: readonly string[]

  constructor(
    kind: FormulaErrorKind,
    message: string,
    options: { position?: number | null; codes?: readonly string[] } = {},
  ) {
    super(message)
    this.name = 'FormulaError'
    this.kind = kind
    this.position = options.position ?? null
    this.codes = options.codes ?? []
  }
}

/**
 * A cycle, formatted as the path a reader can follow.
 * `['CHE', 'CHE%GDP_SHA2011', 'CHE']` → `CHE → CHE%GDP_SHA2011 → CHE`.
 */
export function formatCycle(path: readonly string[]): string {
  return path.join(' → ')
}

export function cycleError(path: readonly string[]): FormulaError {
  return new FormulaError(
    'cycle',
    `Circular reference: ${formatCycle(path)}. A formula cannot depend on itself, directly or through another formula.`,
    { codes: path },
  )
}
