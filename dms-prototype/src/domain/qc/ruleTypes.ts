/**
 * Quality check rules — the shape, and the rule categories UC053 mandates.
 *
 * Pure types and metadata. No React, no store, no data access: the runner takes
 * its values through a `QcDataAccess` closure exactly as the formula engine
 * takes them through `resolveReported`.
 *
 * **Ten types, not nine.** UC053 lists its categories as *"YoY absolute/relative
 * growth; growth between two data versions; new / disappeared / missing
 * observations vs prior reporting; inconsistency between categories;
 * inconsistency between tables; atypical entries; outliers across country
 * groups"*. Counted as written that is nine bullets, but *new*, *disappeared*
 * and *missing* are three different comparisons against three different windows
 * — a code that starts, a code that stops, and a hole between two reported years
 * — so they are three rule types here rather than one with a mode flag. Every
 * category the FR names is covered; the count differs because the FR groups by
 * sentence and this groups by comparison.
 */

/* ==========================================================================
   RULE TYPES
   ========================================================================== */

export const QC_RULE_TYPES = [
  'yoy-absolute',
  'yoy-relative',
  'version-growth',
  'new-observation',
  'disappeared-observation',
  'missing-observation',
  'category-consistency',
  'table-consistency',
  'atypical-entry',
  'group-outlier',
] as const

export type QcRuleType = (typeof QC_RULE_TYPES)[number]

export const QC_RULE_TYPE_LABELS: Record<QcRuleType, string> = {
  'yoy-absolute': 'Year-on-year absolute growth',
  'yoy-relative': 'Year-on-year relative growth',
  'version-growth': 'Growth between data versions',
  'new-observation': 'New observation',
  'disappeared-observation': 'Disappeared observation',
  'missing-observation': 'Missing observation',
  'category-consistency': 'Inconsistency between categories',
  'table-consistency': 'Inconsistency between tables',
  'atypical-entry': 'Atypical entry',
  'group-outlier': 'Outlier across a country group',
}

export const QC_RULE_TYPE_DESCRIPTIONS: Record<QcRuleType, string> = {
  'yoy-absolute':
    'Change in a value between one year and the next, measured in the value’s own units.',
  'yoy-relative': 'Percentage change in a value between one year and the next.',
  'version-growth':
    'Percentage change between the two most recent committed versions of the same observation.',
  'new-observation':
    'A variable reported for the first time, after a run of years in which the country reported nothing for it.',
  'disappeared-observation':
    'A variable reported up to a year and absent from then on, after an established run of reporting.',
  'missing-observation':
    'A hole between two reported years — the country reports the series before and after, but not in between.',
  'category-consistency':
    'A category’s share of its parent, against the share that country has held across the period. A break means the categories no longer reconcile the way they have.',
  'table-consistency':
    'One set of codes against another that should reconcile with it — a classification total against another classification’s total, or a macro series against the revenues that make it up.',
  'atypical-entry':
    'A value that cannot be right on its face: negative expenditure, or an exact zero where the parent is positive.',
  'group-outlier':
    'A country far from its peers on a shared attribute — WHO region, World Bank income group or OECD membership.',
}

/**
 * How the rule list is grouped on screen.
 *
 * Ordered so the growth rules — the ones the HA team runs most — come first,
 * and the structural ones that need no threshold come last.
 */
export const QC_RULE_TYPE_GROUPS: { label: string; types: readonly QcRuleType[] }[] = [
  { label: 'Growth', types: ['yoy-absolute', 'yoy-relative', 'version-growth'] },
  {
    label: 'Reporting continuity',
    types: ['new-observation', 'disappeared-observation', 'missing-observation'],
  },
  { label: 'Consistency', types: ['category-consistency', 'table-consistency'] },
  { label: 'Plausibility', types: ['atypical-entry', 'group-outlier'] },
]

/**
 * What the number compared against the threshold means, per type.
 *
 * Shown beside every threshold field, because "warn at 40" is unreadable
 * without it — 40 percent, 40 million NCU and 40 consecutive years are all
 * plausible readings of the same box.
 */
export const QC_DEVIATION_UNITS: Record<QcRuleType, { unit: QcDeviationUnit; hint: string }> = {
  'yoy-absolute': { unit: 'absolute', hint: 'NCU millions of change' },
  'yoy-relative': { unit: 'percent', hint: '% change year on year' },
  'version-growth': { unit: 'percent', hint: '% change between versions' },
  'new-observation': { unit: 'years', hint: 'years of silence before the first report' },
  'disappeared-observation': { unit: 'years', hint: 'years reported before it stopped' },
  'missing-observation': { unit: 'years', hint: 'consecutive years missing' },
  'category-consistency': { unit: 'percent', hint: '% away from the country’s usual share' },
  'table-consistency': { unit: 'percent', hint: '% by which the two sides disagree' },
  'atypical-entry': { unit: 'score', hint: '1 = zero against a positive parent, 2 = negative' },
  'group-outlier': { unit: 'sigma', hint: 'robust deviations from the group median' },
}

export type QcDeviationUnit = 'absolute' | 'percent' | 'years' | 'score' | 'sigma'

/* ==========================================================================
   RULE ORIGIN — the UC053 "visually distinguishable" requirement
   ========================================================================== */

/**
 * Who authored a rule.
 *
 * UC053 requires that *"the rules created by the developer team"* be
 * distinguishable from the ones an administrator creates — the reason being
 * that a dev rule ships with the product and an admin rule is local policy, and
 * the two carry different authority when a finding is disputed. The list renders
 * each origin with its own badge and colour; nothing merges them.
 */
export const QC_RULE_ORIGINS = ['dev', 'admin', 'user'] as const
export type QcRuleOrigin = (typeof QC_RULE_ORIGINS)[number]

export const QC_RULE_ORIGIN_LABELS: Record<QcRuleOrigin, string> = {
  dev: 'Developer',
  admin: 'Administrator',
  user: 'Custom',
}

export const QC_RULE_ORIGIN_DESCRIPTIONS: Record<QcRuleOrigin, string> = {
  dev: 'Shipped with DMS by the development team. Editable, and resettable to the delivered definition.',
  admin: 'Created by an administrator and visible to every user (UC049).',
  user: 'Created by a regular user. Private to its author unless shared; administrators see all (UC050).',
}

/* ==========================================================================
   RULE PARAMETERS
   ========================================================================== */

/** Which side of the threshold fires. */
export const QC_COMPARISONS = ['outside', 'above', 'below'] as const
export type QcComparison = (typeof QC_COMPARISONS)[number]

export const QC_COMPARISON_LABELS: Record<QcComparison, string> = {
  outside: 'Moves either way by more than',
  above: 'Rises by more than',
  below: 'Falls by more than',
}

/**
 * Country attributes a rule may group by.
 *
 * These are the three flagged `groupable` on the Countries component in Setup
 * (UC022), which is what ties the two use cases together — flipping an
 * attribute's groupable flag there is what makes it usable as a QC run scope
 * and as an outlier peer group here.
 */
export const QC_GROUP_ATTRIBUTES = ['GRP_WHO_REGION', 'GRP_WB_INCOME', 'GRP_OECD'] as const
export type QcGroupAttribute = (typeof QC_GROUP_ATTRIBUTES)[number]

export const QC_GROUP_ATTRIBUTE_LABELS: Record<QcGroupAttribute, string> = {
  GRP_WHO_REGION: 'WHO region',
  GRP_WB_INCOME: 'World Bank income group',
  GRP_OECD: 'OECD membership',
}

/**
 * How a value is made comparable before countries are compared to each other.
 *
 * An outlier rule on raw expenditure would say nothing but "Canada is bigger
 * than Kenya", so `share-of-che` converts it to a share of the country's own
 * total health expenditure — which is how an HA economist compares two
 * countries and the only form in which "far from its peers" means anything.
 *
 * `share-of-che-change` compares the **year-on-year movement** in that share
 * instead, and is what the delivered outlier rules use. The reason is a real
 * property of the data rather than a preference: health systems differ from one
 * another far more than they differ from themselves. Government schemes carry
 * anywhere from 8% to 75% of health spending across upper-middle-income
 * countries, so no member of that group is a statistical outlier on the level —
 * whereas every one of them holds its share to within a point or two from one
 * year to the next, which makes a country that jumps while its peers stand
 * still unmistakable. The comparison population is still the peer group; the
 * statistic compared is the movement.
 */
export const QC_NORMALISATIONS = ['share-of-che-change', 'share-of-che', 'raw'] as const
export type QcNormalisation = (typeof QC_NORMALISATIONS)[number]

export const QC_NORMALISATION_LABELS: Record<QcNormalisation, string> = {
  'share-of-che-change': 'Year-on-year change in % of health expenditure',
  'share-of-che': '% of current health expenditure',
  raw: 'Raw value (NCU millions)',
}

export const QC_NORMALISATION_HINTS: Record<QcNormalisation, string> = {
  'share-of-che-change':
    'Finds a country that moved when its peers did not. The comparison a group of unlike health systems can actually support.',
  'share-of-che':
    'Finds a country sitting at an unusual level for its group. Only discriminates where the group is genuinely alike to begin with.',
  raw: 'Compares national currency amounts directly. Only meaningful inside a group of similarly sized economies.',
}

/* ==========================================================================
   THE RULE
   ========================================================================== */

export interface QcRule {
  id: string
  name: string
  description: string
  type: QcRuleType
  origin: QcRuleOrigin
  createdBy: string
  createdUtc: string
  updatedUtc: string
  isEnabled: boolean
  /**
   * Variable codes the rule inspects. Never empty for a shipped rule: an
   * unbounded sweep over every code in the corpus is how a QC run becomes a
   * thing nobody waits for.
   */
  variables: string[]
  /**
   * UC048 — *"exclude specific countries from a QC rule, so that the rule is
   * not applied to countries where it is known not to be relevant"*. Reset to
   * empty in one click from the editor.
   */
  excludedCountries: string[]
  /** Overrides the global UC054 pair for this rule. Null = use the global set. */
  thresholds: QcThresholdPair | null
  comparison: QcComparison
  /** `group-outlier` only. */
  groupBy: QcGroupAttribute | null
  normalise: QcNormalisation
  /** `table-consistency` only — the two sides that should reconcile. */
  leftCodes: string[]
  rightCodes: string[]
  /** Year window. Null means every year in the run's scope. */
  yearFrom: number | null
  yearTo: number | null
  /** UC050 — a regular user's rule is private to its author; admins see all. */
  visibility: 'shared' | 'private'
}

/**
 * UC054 — *"configure the criteria for pass, fail or warning"*.
 *
 * Two numbers rather than three: pass is the absence of the other two, and a
 * third "passAt" field would be a value that can contradict them.
 */
export interface QcThresholdPair {
  warnAt: number
  failAt: number
}

/* ==========================================================================
   FINDINGS
   ========================================================================== */

export type QcSeverity = 'error' | 'warning'

export const QC_SEVERITY_LABELS: Record<QcSeverity, string> = {
  error: 'Fail',
  warning: 'Warning',
}

export interface QcFinding {
  /** Stable within a run: `${ruleId}|${iso3}|${year}|${code}`. */
  id: string
  ruleId: string
  ruleName: string
  ruleType: QcRuleType
  ruleOrigin: QcRuleOrigin
  iso3: string
  countryName: string
  year: number
  code: string
  variableLabel: string
  /** The cell this rings in a workbook (UC052). */
  observationKey: string
  severity: QcSeverity
  /** What the rule expected — a prior value, a peer median, the other side. */
  expected: number | null
  /** What it found. */
  actual: number | null
  /** The magnitude compared against the threshold. */
  deviation: number
  deviationUnit: QcDeviationUnit
  /** One line, written to be read in a table cell and in a cell tooltip. */
  message: string
  /**
   * The observation's own comment. For a seeded defect this is the note from
   * `generators/defects.ts`, so every finding in the demo traces back to a
   * sentence a human wrote about why the data looks like that.
   */
  note?: string
}

/** Per-rule accounting, so a run reports what it looked at and not only what it found. */
export interface QcRuleStat {
  ruleId: string
  ruleName: string
  ruleType: QcRuleType
  ruleOrigin: QcRuleOrigin
  checked: number
  errors: number
  warnings: number
  /** Countries skipped by UC048 exclusions, so the exclusion is visible in the report. */
  excluded: number
  /** Set when the check budget stopped the sweep early — never silent. */
  truncated: boolean
}

/* ==========================================================================
   A RUN
   ========================================================================== */

/** How the run's countries were chosen — shown at the head of the report. */
export interface QcRunScope {
  kind: 'countries' | 'attribute' | 'workbook'
  /** Human label: "Region = EUR", "12 countries", "Workbook — Canada". */
  label: string
  countries: string[]
  yearFrom: number
  yearTo: number
}

export interface QcRunSummary {
  id: string
  /** ISO timestamp, derived from DEMO_NOW by the caller so demos are stable. */
  runUtc: string
  runBy: string
  scope: QcRunScope
  ruleIds: string[]
  observationsChecked: number
  errors: number
  warnings: number
  countriesWithFindings: number
}

export interface QcRunResult {
  summary: QcRunSummary
  findings: QcFinding[]
  ruleStats: QcRuleStat[]
}
