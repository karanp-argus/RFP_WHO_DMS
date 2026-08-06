/**
 * The quality-check domain's public surface (plan §Phase 5).
 *
 * Pure — no React, no store, no data access. Values reach the runner only
 * through the `QcDataAccess` closure, which is what lets the same rules run
 * over the mock corpus today, over a workbook's on-screen selection (UC052),
 * and over a hand-built fixture in the tests.
 */

export {
  QC_COMPARISONS,
  QC_COMPARISON_LABELS,
  QC_DEVIATION_UNITS,
  QC_GROUP_ATTRIBUTES,
  QC_GROUP_ATTRIBUTE_LABELS,
  QC_NORMALISATIONS,
  QC_NORMALISATION_LABELS,
  QC_RULE_ORIGINS,
  QC_RULE_ORIGIN_DESCRIPTIONS,
  QC_RULE_ORIGIN_LABELS,
  QC_RULE_TYPES,
  QC_RULE_TYPE_DESCRIPTIONS,
  QC_RULE_TYPE_GROUPS,
  QC_RULE_TYPE_LABELS,
  QC_SEVERITY_LABELS,
  type QcComparison,
  type QcDeviationUnit,
  type QcFinding,
  type QcGroupAttribute,
  type QcNormalisation,
  type QcRule,
  type QcRuleOrigin,
  type QcRuleStat,
  type QcRuleType,
  type QcRunResult,
  type QcRunScope,
  type QcRunSummary,
  type QcSeverity,
  type QcThresholdPair,
} from './ruleTypes'

export {
  DEFAULT_THRESHOLDS,
  effectiveThresholds,
  severityFor,
  thresholdsFor,
  type QcThresholdSet,
} from './thresholds'

export {
  emptyRule,
  PREDEFINED_BY_ID,
  PREDEFINED_QC_RULES,
  SEEDED_LOCAL_RULES,
  SEEDED_QC_RULES,
} from './predefined'

export {
  DEFAULT_MAX_CHECKS,
  findingsByObservation,
  median,
  robustSigma,
  runQc,
  type QcDataAccess,
  type QcRunRequest,
  type QcVersionPoint,
} from './runner'

export {
  QC_RULE_HEADERS,
  rowsToRules,
  ruleToRow,
  type RuleImportResult,
} from './exchange'
