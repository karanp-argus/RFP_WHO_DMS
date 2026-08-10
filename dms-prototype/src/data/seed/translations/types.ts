/**
 * The shape one language pack has to fill (UC041).
 *
 * A pack is **seeded configuration**, not code. In a real DMS these strings are
 * translation attributes on the xMart variable and classification records, and
 * an administrator maintains them from the Setup module; here they are five
 * files, one per non-English WHO language, that a reviewer can read end to end
 * without knowing TypeScript.
 *
 * Two properties of the format are deliberate:
 *
 *  · **Variable labels are a `code|label` block, not an object literal.** The
 *    classification seed uses exactly that format for the English original
 *    (`classifications.ts`), so a translator can put the two side by side and
 *    diff them line for line. Coverage is enforced by
 *    `__tests__/translations.test.ts` rather than by the type system — a missing
 *    Russian label should fail a test naming the code, not produce a compiler
 *    error 400 lines from the cause.
 *
 *  · **Every map is complete, none is partial.** A pack that half-translates
 *    reads as a bug in the demo; the loader still merges over English so a code
 *    added after the packs were written degrades to its English name rather than
 *    to a blank cell.
 */

import type {
  DimensionCode,
  Scale,
  WbIncome,
  WhoLanguage,
  WhoRegion,
} from '@/domain/constants'
import type {
  ReportAggregation,
  ReportChrome,
  ReportFieldId,
  ReportUnit,
} from '@/domain/report'

export interface LanguagePack {
  language: WhoLanguage
  chrome: ReportChrome
  fields: Record<ReportFieldId, string>
  aggregations: Record<ReportAggregation, string>
  /** The word used inside a composed unit label, e.g. `millions` in `CAD millions`. */
  scales: Record<Scale, string>
  reportUnits: Record<ReportUnit, string>
  /** Keyed by the canonical English `UNITS` value — never by a translated one. */
  units: Record<string, string>
  dimensions: Record<DimensionCode, string>
  regions: Record<WhoRegion, string>
  incomes: Record<WbIncome, string>
  oecd: Record<'OECD' | 'Non-OECD', string>
  /** One `code|label` per line, matching the codes in `classifications.ts`. */
  variables: string
}
