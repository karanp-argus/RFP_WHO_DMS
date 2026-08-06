/**
 * Units, currencies and scale — UC035's *"combinations of predefined units and
 * currencies"*, and the legacy screenshot's "Millions (Default)" selector.
 *
 * **Conversion happens per observation, before aggregation.** This is the part
 * that matters and it is easy to get backwards. A report grouped by WHO region
 * that sums national-currency millions across its members is adding pesos to
 * yen, and dividing the answer by an exchange rate afterwards does not rescue
 * it. So every value is converted at the coordinate it was read at, using that
 * country's exchange rate for that year, and only then does it enter a total.
 *
 * **Not every series is convertible, and the ones that are not are left alone.**
 * A percentage is a percentage in every currency, and `CHE_pc_US$` is already
 * in dollars. Scaling those by a million would produce numbers that are wrong
 * rather than merely differently presented, so `presentValue` converts only
 * what is genuinely denominated in national currency and reports the unit it
 * ended up with. A cell whose group mixed units refuses to produce a number at
 * all — see `pivot.ts`.
 *
 * Pure — no React, no store.
 */

import {
  SCALE_DIVISORS,
  SCALE_LABELS,
  UNITS,
  type Scale,
  type WhoLanguage,
} from '../constants'

/* ==========================================================================
   UNITS
   ========================================================================== */

/** The two unit bases a monetary series can be presented in. */
export const REPORT_UNITS = ['national', 'usd'] as const
export type ReportUnit = (typeof REPORT_UNITS)[number]

export const REPORT_UNIT_LABELS: Record<ReportUnit, string> = {
  national: 'National currency (as reported)',
  usd: 'US dollars (converted at the reported exchange rate)',
}

export const REPORT_UNIT_SHORT: Record<ReportUnit, string> = {
  national: 'NCU',
  usd: 'US$',
}

export interface ReportPresentation {
  unit: ReportUnit
  scale: Scale
  language: WhoLanguage
  /** Decimal places on screen and in the export. */
  decimals: number
}

export const DEFAULT_PRESENTATION: ReportPresentation = {
  unit: 'national',
  // "Millions (Default)" — the legacy DMS default, kept deliberately (§2.4).
  scale: 'millions',
  language: 'en',
  decimals: 1,
}

/* ==========================================================================
   WHICH SERIES ARE MONEY
   ========================================================================== */

/**
 * MACRO codes that are denominated in national currency.
 *
 * The classification seed carries `isCurrency` per *dimension*, and MACRO is
 * the one dimension where that cannot be right: it holds GDP and general
 * government expenditure — both money — alongside population, an exchange rate
 * and a PPP factor, which are not. Rather than reopen the Phase 1 seed and the
 * economic-plausibility suite attached to it, the report layer names the three
 * monetary members explicitly. The consequence is confined to presentation: a
 * report that scales health expenditure to billions scales GDP with it instead
 * of leaving one column in millions, which is what the dimension-level flag
 * would have produced.
 */
export const MONETARY_MACRO_CODES: readonly string[] = ['GDP', 'GGE', 'GGHE-D']

/**
 * True when a unit string means "national currency units, in millions" — the
 * form every reported expenditure figure is stored in.
 */
export function isNationalCurrencyUnit(unit: string): boolean {
  return unit === UNITS.NCU_MILLIONS
}

/* ==========================================================================
   PRESENTING ONE VALUE
   ========================================================================== */

export interface PresentedValue {
  value: number
  /** What the number is now in — the label a column header carries. */
  unit: string
}

/** Why a value could not be presented, when it could not. */
export type PresentationFailure = 'no-exchange-rate'

/**
 * Convert one stored value into the requested unit and scale.
 *
 * Returns `null` with a reason when the conversion is impossible — currently
 * only a missing exchange rate. Callers count those separately from blanks,
 * because "this country did not report" and "we could not express what it
 * reported in dollars" are different facts and a report that merges them is
 * lying about its own coverage.
 */
export function presentValue(
  raw: number,
  unit: string,
  presentation: ReportPresentation,
  exchangeRate: number | null,
  /**
   * The reporting country's own currency, e.g. `CAD`. Used as the unit label
   * when the report is left in national currency — which is what makes a total
   * across two countries refuse to add pesos to yen, since the two
   * contributions arrive carrying different units. Presenting every country as
   * an anonymous "NCU" would let that sum through looking correct.
   */
  currencyCode: string,
): { ok: true; presented: PresentedValue } | { ok: false; reason: PresentationFailure } {
  if (!isNationalCurrencyUnit(unit)) {
    // Percentages, per-capita dollars and counts pass through untouched.
    return { ok: true, presented: { value: raw, unit } }
  }

  let value = raw
  let currencyLabel = currencyCode || REPORT_UNIT_SHORT.national

  if (presentation.unit === 'usd') {
    if (exchangeRate == null || !Number.isFinite(exchangeRate) || exchangeRate === 0) {
      return { ok: false, reason: 'no-exchange-rate' }
    }
    // `EXR` is NCU per US$, so dividing takes national currency to dollars.
    value = value / exchangeRate
    currencyLabel = REPORT_UNIT_SHORT.usd
  }

  // Stored figures are already in millions, so the divisor is applied relative
  // to a million rather than to one unit.
  value = (value * 1e6) / SCALE_DIVISORS[presentation.scale]

  return { ok: true, presented: { value, unit: `${currencyLabel} ${scaleWord(presentation.scale)}` } }
}

/** "Millions (Default)" is a menu label; a column header wants "millions". */
export function scaleWord(scale: Scale): string {
  return SCALE_LABELS[scale].replace(' (Default)', '').toLowerCase()
}

/** Human summary of a presentation choice, for the report header line. */
export function describePresentation(presentation: ReportPresentation): string {
  return `${REPORT_UNIT_SHORT[presentation.unit]} · ${scaleWord(presentation.scale)}`
}
