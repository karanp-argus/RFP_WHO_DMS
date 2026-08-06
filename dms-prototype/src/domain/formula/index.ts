/**
 * The formula engine's public surface (plan §3.3).
 *
 * Pure — no React, no store, no data access. Values reach it only through the
 * `resolveReported` closure handed to `createFormulaEngine`, which is what lets
 * the same engine serve the mock client today and a real xMart tomorrow.
 */

export {
  astOutline,
  formatNode,
  FUNCTION_NAMES,
  isFunctionName,
  referencedCodes,
  refsOf,
  walk,
  type AstNode,
  type AstOutlineRow,
  type BinaryOp,
  type CallNode,
  type CompareOp,
  type FunctionName,
  type NumberNode,
  type RefNode,
} from './ast'

export { FormulaError, formatCycle, cycleError, type FormulaErrorKind } from './errors'

export { tokenize, type Token, type TokenType } from './tokenizer'

export { parseExpression, tryParseExpression, type ParseOptions } from './parser'

export {
  applyValueFunction,
  FUNCTION_ARITY,
  FUNCTION_HELP,
  SERIES_FUNCTIONS,
  type FunctionArity,
} from './functions'

export {
  buildSeries,
  extrapolateAt,
  fillSeries,
  growthPercent,
  interpolateAt,
  knownPoints,
  valueAt,
  type ExtrapolationDirection,
  type ExtrapolationMethod,
  type FilledPoint,
  type FillOptions,
  type SeriesPoint,
} from './series'

export {
  coerceMissing,
  guardPasses,
  missingInputs,
  NULL_POLICY_DESCRIPTIONS,
  NULL_POLICY_LABELS,
  type InputRead,
} from './nullPolicy'

export {
  assertAcyclic,
  buildDependencyGraph,
  cyclesInvolving,
  evaluationChain,
  transitiveDependents,
  type DependencyGraph,
} from './dependencies'

export { evaluateAst, type EvaluationContext, type EvaluationTrace } from './evaluator'

export { aggregatesFromVariables, baseVariableCodes, isTotalCode } from './variables'

export {
  createFormulaEngine,
  type EngineFormula,
  type EngineOptions,
  type EvaluationResult,
  type FormulaEngine,
  type ValidationResult,
  type ValueSource,
} from './engine'
