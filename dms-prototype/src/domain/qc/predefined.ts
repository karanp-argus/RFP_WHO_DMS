/**
 * The delivered rule set — UC053's *"quality check rules created by the
 * developer team"*.
 *
 * Every rule here carries `origin: 'dev'`, which the list renders with its own
 * badge and colour so a user can always tell a shipped rule from one an
 * administrator wrote. That distinction is a stated requirement, not styling:
 * a dev rule is part of the product and can be reset to its delivered
 * definition; an admin rule is local policy and cannot.
 *
 * The variable lists are explicit rather than "every code in the corpus". A QC
 * run that sweeps 200 codes across 25 years and 190 countries is one nobody
 * waits for, and an unbounded rule is also an undebuggable one — when it fires
 * 4,000 times there is no way to tell whether it is working.
 *
 * Two rules deliberately carry their own threshold pair, overriding the global
 * UC054 set: it is worth showing on screen that a per-rule override exists,
 * because the alternative reading of UC054 — one global pair for everything —
 * would force an administrator to loosen every growth check in order to loosen
 * one of them.
 */

import { DEMO_NOW, FIRST_YEAR, LAST_YEAR } from '../constants'
import type { QcRule, QcRuleType } from './ruleTypes'

/* --------------------------------------------------------------------------
   Code sets the rules sweep
   -------------------------------------------------------------------------- */

/** Household out-of-pocket payment — the FR's own worked example of a spike. */
const OOP_CODES = ['HF.3.1', 'HF.3.2']

/** Curative care functions, the largest block of HC spending. */
const HC_CURATIVE = ['HC.1.1', 'HC.1.2', 'HC.1.3', 'HC.1.4']

/** Revenues of health care financing schemes, level 1 in full. */
const FS_LEVEL_1 = ['FS.1', 'FS.2', 'FS.3', 'FS.4', 'FS.5', 'FS.6', 'FS.7', 'FS.nec']

/** Financing schemes, every code a country reports directly. */
const HF_REPORTED = [
  'HF.1.1',
  'HF.1.2.1',
  'HF.1.2.2',
  'HF.1.3',
  'HF.2.1',
  'HF.2.2',
  'HF.2.3',
  'HF.3.1',
  'HF.3.2',
  'HF.4',
  'HF.nec',
]

/** Health care functions a country reports directly, across the main branches. */
const HC_REPORTED = [
  'HC.1.1',
  'HC.1.2',
  'HC.1.3',
  'HC.1.4',
  'HC.2.1',
  'HC.2.2',
  'HC.2.3',
  'HC.2.4',
  'HC.3.1',
  'HC.3.2',
  'HC.3.3',
  'HC.3.4',
  'HC.6.1',
  'HC.6.2',
  'HC.6.3',
  'HC.6.4',
  'HC.6.5',
  'HC.6.6',
]

/** The largest financing aggregates — the ones a size-based rule is meant for. */
const HF_LEVEL_1 = ['HF.1', 'HF.2', 'HF.3']

/* --------------------------------------------------------------------------
   Rule construction
   -------------------------------------------------------------------------- */

const DEV_AUTHOR = 'DMS development team'
const SEED_UTC = DEMO_NOW.toISOString()

type RuleSeed = Pick<QcRule, 'id' | 'name' | 'description' | 'type'> & Partial<QcRule>

/**
 * Fill a seed out into a complete rule.
 *
 * Defaults matter here: `comparison: 'outside'` means a growth rule fires on a
 * collapse as well as a spike, which is what a reviewer wants and what a naive
 * "greater than" would miss half of.
 */
function devRule(seed: RuleSeed): QcRule {
  return {
    origin: 'dev',
    createdBy: DEV_AUTHOR,
    createdUtc: SEED_UTC,
    updatedUtc: SEED_UTC,
    isEnabled: true,
    variables: [],
    excludedCountries: [],
    thresholds: null,
    comparison: 'outside',
    groupBy: null,
    normalise: 'share-of-che',
    leftCodes: [],
    rightCodes: [],
    yearFrom: null,
    yearTo: null,
    visibility: 'shared',
    ...seed,
  }
}

/* --------------------------------------------------------------------------
   The set
   -------------------------------------------------------------------------- */

export const PREDEFINED_QC_RULES: readonly QcRule[] = [
  /* --- growth ---------------------------------------------------------- */

  devRule({
    id: 'qc-yoy-abs-major-schemes',
    name: 'Large absolute movement in a major financing scheme',
    description:
      'Flags a financing scheme whose value moves by a large amount in one year, measured in the country’s own currency units. An absolute threshold is size-dependent by nature: it says nothing for a small economy and fires every year for one whose currency is denominated in thousands to the dollar. That is what UC048 country exclusions are for, and this rule ships with the worst offenders already excluded — an administrator can add or clear them from the rule editor in one click.',
    type: 'yoy-absolute',
    variables: HF_LEVEL_1,
    yearFrom: FIRST_YEAR + 1,
    // High-denomination currencies. Their health expenditure runs to hundreds
    // of millions of NCU millions, so any threshold that means something for
    // the rest of the world is crossed by these countries in an ordinary year.
    excludedCountries: ['IDN', 'VNM', 'KOR', 'COL', 'IRN', 'LAO', 'UZB', 'SLE', 'LBN'],
    thresholds: { warnAt: 250_000, failAt: 1_000_000 },
  }),

  devRule({
    id: 'qc-yoy-rel-oop',
    name: 'Out-of-pocket payment jumps year on year',
    description:
      'Household out-of-pocket spending is the most closely watched line in health accounts and the one most often broken by a currency or scale error. Fires on a move in either direction.',
    type: 'yoy-relative',
    variables: OOP_CODES,
    yearFrom: FIRST_YEAR + 1,
  }),

  devRule({
    id: 'qc-yoy-rel-curative',
    name: 'Curative care functions jump year on year',
    description:
      'Curative care is the largest block of HC spending, so a step change here moves the country’s whole functional breakdown.',
    type: 'yoy-relative',
    variables: HC_CURATIVE,
    yearFrom: FIRST_YEAR + 1,
  }),

  devRule({
    id: 'qc-yoy-rel-revenues',
    name: 'Revenue of financing schemes jumps year on year',
    description:
      'Revenue lines move with events — a new donor programme, an emergency appeal — so this rule is expected to surface things a reviewer accepts as well as things they correct.',
    type: 'yoy-relative',
    variables: FS_LEVEL_1,
    yearFrom: FIRST_YEAR + 1,
    // Revenues genuinely are more volatile than expenditure, so the delivered
    // 40/80 would report ordinary donor cycles. A per-rule override rather than
    // a looser global pair, which would weaken the two rules above with it.
    thresholds: { warnAt: 60, failAt: 120 },
  }),

  devRule({
    id: 'qc-version-growth-core',
    name: 'Figure has drifted a long way from its original submission',
    description:
      'Compares the current value against the earliest version DMS still holds for the same observation. A figure that has moved by a fifth across its revisions is a different number, not a revision — right-click the cell to see the individual steps that got it there.',
    type: 'version-growth',
    variables: ['HF.1.1', 'HF.2.1', 'HF.3.1', 'HC.1.1'],
    yearFrom: LAST_YEAR - 9,
  }),

  /* --- reporting continuity -------------------------------------------- */

  devRule({
    id: 'qc-new-observation-hc',
    name: 'Health care function reported for the first time',
    description:
      'A function that appears after years in which the country was reporting other variables. Usually a genuine expansion of the accounts, occasionally a code entered in the wrong row.',
    type: 'new-observation',
    variables: HC_REPORTED,
  }),

  devRule({
    id: 'qc-disappeared-observation-hc',
    name: 'Established health care function stopped being reported',
    description:
      'A function reported for an unbroken run of years and absent from then on, while the country carried on submitting everything else.',
    type: 'disappeared-observation',
    variables: HC_REPORTED,
  }),

  devRule({
    id: 'qc-missing-observation-hf',
    name: 'Gap in a financing scheme series',
    description:
      'A hole between two reported years — the country reports the scheme before and after, but not in between. These are the cells the workbook’s fill and interpolate tools are for.',
    type: 'missing-observation',
    variables: HF_REPORTED,
  }),

  devRule({
    id: 'qc-missing-observation-hc',
    name: 'Gap in a health care function series',
    description:
      'The same check across the functional classification, where mid-series holes are most often a programme whose spending was reported under a different code for a year or two.',
    type: 'missing-observation',
    variables: HC_REPORTED,
  }),

  /* --- consistency ------------------------------------------------------ */

  devRule({
    id: 'qc-category-mix-hf1',
    name: 'Government scheme mix breaks from its own pattern',
    description:
      'Checks each child of HF.1 against the share it has held of HF.1 across the period for that country. A category that has been a third of its parent for twenty years and is suddenly a fifth means the categories no longer reconcile the way they did.',
    type: 'category-consistency',
    variables: ['HF.1'],
  }),

  devRule({
    id: 'qc-category-mix-hc1',
    name: 'Curative care mix breaks from its own pattern',
    description:
      'The same check inside HC.1, where a reclassification between inpatient, day and outpatient care shows up as an abrupt change in the mix rather than in the total.',
    type: 'category-consistency',
    variables: ['HC.1'],
  }),

  devRule({
    id: 'qc-table-hf-vs-hc',
    name: 'Financing schemes and health care functions do not reconcile',
    description:
      'HF and HC are two partitions of the same spending, so their totals should agree. Real submissions never agree exactly, so the threshold is looser than the delivered default — a per-rule override, so the tighter FS check below keeps its own.',
    type: 'table-consistency',
    leftCodes: ['HF TOT'],
    rightCodes: ['HC TOT'],
    thresholds: { warnAt: 8, failAt: 15 },
    // The current reporting round. Reconciliation is checked on the data being
    // submitted, not re-litigated across twenty-five closed years.
    yearFrom: LAST_YEAR - 4,
  }),

  devRule({
    id: 'qc-table-hf-vs-fs',
    name: 'Financing schemes and their revenues do not reconcile',
    description:
      'Every unit of expenditure by scheme must have a revenue behind it, so HF and FS totals should be close. This is the tightest of the reconciliation checks.',
    type: 'table-consistency',
    leftCodes: ['HF TOT'],
    rightCodes: ['FS TOT'],
    yearFrom: LAST_YEAR - 4,
  }),

  /* --- plausibility ----------------------------------------------------- */

  devRule({
    id: 'qc-atypical-entries',
    name: 'Negative or zero expenditure',
    description:
      'A negative value fails outright — health expenditure cannot be negative. An exact zero against a positive total warns, because a category with genuinely no spending is normally left blank rather than filled with a zero.',
    type: 'atypical-entry',
    variables: [...HF_REPORTED, ...FS_LEVEL_1],
    comparison: 'above',
  }),

  devRule({
    id: 'qc-outlier-gghed',
    name: 'Government health expenditure moved against its income-group peers',
    description:
      'Domestic government health expenditure as a share of total health spending moves by a point or two a year in a stable system. This finds a country whose share jumped or collapsed in a year when the rest of its World Bank income group held steady, measured with a median-and-MAD spread so the outlier cannot inflate the yardstick it is judged against.',
    type: 'group-outlier',
    variables: ['GGHE-D'],
    groupBy: 'GRP_WB_INCOME',
    normalise: 'share-of-che-change',
  }),

  devRule({
    id: 'qc-outlier-gov-schemes',
    name: 'Government scheme spending moved against its regional peers',
    description:
      'The same comparison across WHO regions, on the share of health spending flowing through government schemes — the number that most distinguishes one health system from another, and the one a reclassification moves first.',
    type: 'group-outlier',
    variables: ['HF.1.1'],
    groupBy: 'GRP_WHO_REGION',
    normalise: 'share-of-che-change',
  }),
]

/**
 * Two seeded rules that are **not** dev-authored.
 *
 * They exist so the origin badge has something to contrast with the moment the
 * module is opened. Without them a user would have to create a rule before
 * discovering that UC053's "visually distinguishable" requirement was met at
 * all, and the seeded people are fictional per CLAUDE.md.
 */
export const SEEDED_LOCAL_RULES: readonly QcRule[] = [
  {
    ...devRule({
      id: 'qc-admin-preventive-growth',
      name: 'Preventive care programmes jump year on year',
      description:
        'Added after the 2025 round, where several countries moved immunisation spending between HC.6.2 and HC.6.5 and the movement was only visible year on year.',
      type: 'yoy-relative',
      variables: ['HC.6.1', 'HC.6.2', 'HC.6.5'],
      yearFrom: LAST_YEAR - 9,
      thresholds: { warnAt: 30, failAt: 60 },
    }),
    origin: 'admin',
    createdBy: 'dmsadmin@who.int',
  },
  {
    ...devRule({
      id: 'qc-user-ext-financing',
      name: 'External financing gap in my portfolio',
      description:
        'My own check on rest-of-world financing while reviewing the AFR submissions. Private to me until I share it.',
      type: 'yoy-relative',
      variables: ['HF.4', 'FS.2', 'FS.7'],
      thresholds: { warnAt: 50, failAt: 100 },
      yearFrom: LAST_YEAR - 9,
    }),
    origin: 'user',
    createdBy: 'dmsuser@who.int',
    visibility: 'private',
  },
]

/** Look-up used by the editor's "reset to the delivered definition" action. */
export const PREDEFINED_BY_ID: ReadonlyMap<string, QcRule> = new Map(
  PREDEFINED_QC_RULES.map((r) => [r.id, r]),
)

/** Every rule the module starts with, dev-authored first. */
export const SEEDED_QC_RULES: readonly QcRule[] = [
  ...PREDEFINED_QC_RULES,
  ...SEEDED_LOCAL_RULES,
]

/**
 * A blank rule for the editor's "create" path.
 *
 * `comparison: 'outside'` and an empty exclusion list are the same defaults the
 * delivered rules use, so a rule a user builds behaves like the ones they have
 * been reading.
 */
export function emptyRule(id: string, type: QcRuleType, createdBy: string, nowUtc: string): QcRule {
  return {
    id,
    name: '',
    description: '',
    type,
    origin: 'user',
    createdBy,
    createdUtc: nowUtc,
    updatedUtc: nowUtc,
    isEnabled: true,
    variables: [],
    excludedCountries: [],
    thresholds: null,
    comparison: 'outside',
    groupBy: type === 'group-outlier' ? 'GRP_WB_INCOME' : null,
    normalise: 'share-of-che',
    leftCodes: [],
    rightCodes: [],
    yearFrom: null,
    yearTo: null,
    visibility: 'private',
  }
}
