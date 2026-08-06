/**
 * Number presentation.
 *
 * One rule matters more than the formatting: **a blank is not a zero.** A
 * missing value renders as an em dash everywhere, never as `0`, because the
 * formula engine goes to some trouble to keep the distinction (see
 * `domain/formula/nullPolicy.ts`) and it would be lost at the last step if a
 * component decided `value ?? 0` was tidier.
 */

import { UNITS } from '@/domain/constants'

/** What a missing value looks like on screen. */
export const BLANK = '—'

const DECIMALS_BY_UNIT: Record<string, number> = {
  [UNITS.PERCENT]: 1,
  [UNITS.USD_PER_CAPITA]: 0,
  [UNITS.NCU_MILLIONS]: 0,
  [UNITS.COUNT]: 0,
  [UNITS.RATE]: 2,
}

/**
 * Format an indicator or observation value for display.
 *
 * `en-GB` rather than the user's locale: the demo must read identically on any
 * machine, in the same way every other seeded figure does.
 */
export function formatValue(value: number | null | undefined, unit?: string): string {
  if (value == null || !Number.isFinite(value)) return BLANK

  const decimals =
    (unit ? DECIMALS_BY_UNIT[unit] : undefined) ??
    // No unit to go on: keep small numbers readable, round large ones.
    (Math.abs(value) < 10 ? 2 : Math.abs(value) < 1000 ? 1 : 0)

  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Compact form for dense grids and inspector tables. */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return BLANK
  if (Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(
      value,
    )
  }
  return formatValue(value)
}
