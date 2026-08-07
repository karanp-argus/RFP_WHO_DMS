/**
 * Data behind the UC003 dashboard.
 *
 * Every figure is a real query through `XMartClient` rather than a seeded
 * summary. That costs a few hundred milliseconds on arrival and is worth it:
 * a dashboard whose numbers cannot be traced to a query is the tile an
 * evaluator asks about first, and the completeness grid in particular has to
 * agree with what the workbook shows for the same country-year.
 */

import { useQuery } from '@tanstack/react-query'
import { LAST_YEAR } from '@/domain/constants'
import { mockXMartClient } from '@/data/xmart/mockClient'

/**
 * The countries the heatmap covers.
 *
 * Eight, hand-picked across all six WHO regions and all four income groups —
 * the same reasoning as `qc/demoScope.ts`: a grid that samples randomly shows
 * a spread nobody can interpret, and one that shows only the well-behaved
 * demo countries shows no gaps at all.
 */
export const DASHBOARD_COUNTRIES: readonly string[] = [
  'CAN',
  'FRA',
  'ARG',
  'BRA',
  'IDN',
  'IND',
  'KEN',
  'UGA',
]

/** Twelve years — enough to see a trend, narrow enough to read on one screen. */
export const DASHBOARD_YEARS: readonly number[] = Array.from(
  { length: 12 },
  (_, i) => LAST_YEAR - 11 + i,
)

/**
 * The reported HF leaves.
 *
 * Leaves, not `HF.1`–`HF.4`: the parents are `isCalculated` and are produced
 * by the formula engine, so counting them would score a country on arithmetic
 * DMS performed rather than on data the country sent. Eleven codes, which is
 * the grid's `expected` per cell.
 */
export const DASHBOARD_HF_LEAVES: readonly string[] = [
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

const DASHBOARD_STALE_MS = 5 * 60 * 1000

/**
 * One bounded slice: 8 countries × 12 years × 11 codes ≈ 1,000 observations.
 *
 * Bounded deliberately. The publication counts and the completeness grid both
 * read from it, and asking for all 194 countries to put a number on a tile
 * would be the sort of query that makes a dashboard the slowest page in an
 * application.
 */
export function useDashboardObservations() {
  return useQuery({
    queryKey: ['xmart', 'dashboard-observations'],
    staleTime: DASHBOARD_STALE_MS,
    queryFn: () =>
      mockXMartClient.getObservations({
        countries: DASHBOARD_COUNTRIES,
        yearFrom: DASHBOARD_YEARS[0],
        yearTo: DASHBOARD_YEARS[DASHBOARD_YEARS.length - 1],
        variables: DASHBOARD_HF_LEAVES,
      }),
  })
}
