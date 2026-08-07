/**
 * Data-completeness heatmap (UC003).
 *
 * Reads the eleven reported HF leaves per country-year and shades each cell by
 * how many of them carry a figure. Five bands rather than a gradient, because
 * the grid is scanned for gaps and a continuous scale hides the one thing that
 * matters — the cliff between "sparse" and "nothing at all".
 *
 * Every band is a token with an alpha, never a colour: the palette has to
 * follow the theme, and pass/warn/fail already carry the right semantics in
 * both.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { completenessBand, type CompletenessGrid } from '@/domain/home'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { cn } from '@/lib/utils'

const BAND_CLASS: Record<ReturnType<typeof completenessBand>, string> = {
  none: 'bg-who-page-bg border border-dashed border-who-border',
  low: 'bg-who-fail/55',
  partial: 'bg-who-warn/60',
  high: 'bg-who-pass/45',
  full: 'bg-who-pass/85',
}

const BAND_LABEL: Record<ReturnType<typeof completenessBand>, string> = {
  none: 'No data',
  low: 'Under 40%',
  partial: '40–70%',
  high: '70–95%',
  full: '95%+',
}

export function CompletenessHeatmap({ grid }: { grid: CompletenessGrid }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[length:var(--text-meta)]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-who-surface pr-3 text-left font-semibold text-who-text-muted">
                Country
              </th>
              {grid.years.map((y) => (
                <th
                  key={y}
                  className="w-8 text-center font-normal text-who-text-muted tabular-nums"
                >
                  {/* Two digits: twelve four-digit headers over 32px cells
                      wrap, and the century is not in question. */}
                  {String(y).slice(2)}
                </th>
              ))}
              <th className="pl-3 text-right font-semibold text-who-text-muted">All</th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.iso3}>
                <th className="sticky left-0 z-[1] bg-who-surface pr-3 text-left font-normal whitespace-nowrap text-who-text">
                  {COUNTRY_BY_ISO3.get(row.iso3)?.NAME_SHORT_EN ?? row.iso3}
                </th>
                {row.cells.map((cell) => {
                  const band = completenessBand(cell.ratio)
                  return (
                    <td key={cell.year}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn('block h-6 w-8 rounded-sm', BAND_CLASS[band])}
                            aria-label={`${row.iso3} ${cell.year}: ${cell.reported} of ${cell.expected} reported`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.iso3} {cell.year} — {cell.reported} of {cell.expected} financing
                          schemes reported
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  )
                })}
                <td className="pl-3 text-right tabular-nums text-who-text">
                  {Math.round(row.ratio * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 flex list-none flex-wrap items-center gap-x-4 gap-y-1">
        {(['none', 'low', 'partial', 'high', 'full'] as const).map((band) => (
          <li
            key={band}
            className="flex items-center gap-1.5 text-[length:var(--text-meta)] text-who-text-muted"
          >
            <span className={cn('size-3 rounded-sm', BAND_CLASS[band])} aria-hidden />
            {BAND_LABEL[band]}
          </li>
        ))}
      </ul>
    </div>
  )
}
