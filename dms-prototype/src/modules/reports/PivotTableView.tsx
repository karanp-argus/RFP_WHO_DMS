/**
 * A rendered pivot.
 *
 * Two decisions carried over from the Workbook (§2.4), because a report reads
 * like a workbook and breaking the muscle memory twice would be worse than
 * breaking it once:
 *
 *  · **Headers freeze, they do not scroll away.** The column header block and
 *    the row-label columns are sticky, so scrolling to 2019 in a fifty-row
 *    report never leaves you guessing which country you are on.
 *  · **The cell palette carries the same semantics.** Subtotal and grand-total
 *    lines use `--who-cell-indicator`, the pink the legacy screenshots give to
 *    calculated rows, because that is exactly what they are. Never a hardcoded
 *    tint — CLAUDE.md.
 *
 * A blank cell renders as an em dash and a cell whose group mixed units renders
 * as a marked refusal rather than as a blank, because the two mean different
 * things and only one of them is the user's problem to fix.
 *
 * **Every word in the table comes from `table.vocabulary` (UC041)**, never from
 * the module constants — the labels were resolved into that language when the
 * pivot was built, and headers taken from anywhere else would be the one part
 * of the report still in English.
 */

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/common/EmptyState'
import { BLANK } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fieldHeading, type PivotAxisNode, type PivotTable } from '@/domain/report'

/**
 * Numbers stay in `en-GB` grouping in every language, and deliberately so: the
 * exported `.xlsx` writes raw numbers under an Excel format string that the
 * recipient's own locale renders, and a screen that used the report language
 * while the file used the reader's would show two different separators for the
 * same figure. UC041 is about labels; number formatting belongs to the viewer.
 */
function formatCell(value: number | null, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return BLANK
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Axis-header text at one nesting level, matching `pivotToGrid`'s rules so the
 * screen and the exported file say the same thing in the same cells.
 */
function axisLabelAt(node: PivotAxisNode, level: number, totalWord: string): string {
  if (node.kind === 'grand-total') return level === 0 ? node.label : ''
  const label = node.pathLabels[level]
  if (label != null) return label
  return level === node.pathLabels.length && node.kind === 'subtotal' ? totalWord : ''
}

/**
 * Row-label columns are frozen at a fixed width so the sticky offsets can be
 * computed, and only the first two are frozen: past that the labels would take
 * more of the viewport than the numbers they describe. A third nesting level
 * scrolls with the body, which is the right trade at the width where it starts
 * to matter.
 */
const LABEL_WIDTH = 200
const MAX_STICKY_LABEL_COLUMNS = 2
/** Must match the rendered header row height, or level 2 overlaps level 1. */
const HEADER_ROW_HEIGHT = 34

function stickyLeft(level: number): number | undefined {
  return level < MAX_STICKY_LABEL_COLUMNS ? level * LABEL_WIDTH : undefined
}

export interface PivotTableViewProps {
  table: PivotTable
  decimals: number
  /** Cap the rows rendered; the caller says what it capped. */
  maxRows?: number
}

export function PivotTableView({ table, decimals, maxRows }: PivotTableViewProps) {
  const rows = useMemo(
    () => (maxRows != null ? table.rows.slice(0, maxRows) : table.rows),
    [table.rows, maxRows],
  )

  const vocabulary = table.vocabulary
  const totalWord = vocabulary.chrome.total
  const columnLevels = table.columnFields.length
  const showValueRow = table.values.length > 1
  const rowLabelColumns = Math.max(1, table.rowFields.length)
  const rowFieldLabels =
    table.rowFields.length > 0
      ? table.rowFields.map((p) => fieldHeading(p.field, vocabulary))
      : ['']

  if (table.columns.length === 0) {
    return (
      <EmptyState
        message="This report has no value fields"
        hint="Open it in the builder and drag a field into Values."
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        message="No data for this selection"
        hint="Every country, year and variable combination in scope was filtered out, or none of them carries a value."
      />
    )
  }

  const headerRowCount = Math.max(1, columnLevels + (showValueRow ? 1 : 0))

  return (
    <div className="max-h-[60vh] overflow-auto rounded border border-who-border bg-who-surface">
      <table className="border-collapse text-[length:var(--text-body-sm)]">
        <thead>
          {Array.from({ length: headerRowCount }, (_, level) => {
            const isValueRow = showValueRow && level === headerRowCount - 1
            const isLastHeaderRow = level === headerRowCount - 1
            return (
              <tr key={level}>
                {Array.from({ length: rowLabelColumns }, (_, i) => (
                  <th
                    key={i}
                    // Sticky in both directions on the corner cells, so the row
                    // labels stay put horizontally and the header vertically.
                    className={cn(
                      'z-20 border-b border-who-border bg-who-surface px-3 py-2 text-left align-bottom',
                      'text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase whitespace-nowrap',
                      stickyLeft(i) != null && 'sticky',
                    )}
                    style={{
                      top: `${level * HEADER_ROW_HEIGHT}px`,
                      left: stickyLeft(i),
                      minWidth: LABEL_WIDTH,
                      width: LABEL_WIDTH,
                    }}
                  >
                    {isLastHeaderRow ? (rowFieldLabels[i] ?? '') : ''}
                  </th>
                ))}
                {table.columns.map((column) => (
                  <th
                    key={`${level}-${column.key}`}
                    className={cn(
                      'sticky z-10 border-b border-l border-who-border bg-who-surface px-3 py-2 text-right align-bottom',
                      'text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase whitespace-nowrap',
                      column.node.kind !== 'leaf' && 'bg-who-cell-indicator',
                    )}
                    style={{ top: `${level * HEADER_ROW_HEIGHT}px` }}
                  >
                    {isValueRow
                      ? column.value.label
                      : axisLabelAt(column.node, level, totalWord)}
                  </th>
                ))}
              </tr>
            )
          })}
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => {
            const isTotal = row.kind !== 'leaf'
            return (
              <tr
                key={row.key}
                className={cn(
                  'border-b border-who-border/60 last:border-b-0',
                  !isTotal && 'even:bg-who-page-bg hover:bg-who-accent-subtle',
                )}
              >
                {Array.from({ length: rowLabelColumns }, (_, level) => (
                  <th
                    key={level}
                    scope="row"
                    className={cn(
                      'z-10 truncate border-r border-who-border px-3 py-2 text-left align-middle font-normal',
                      stickyLeft(level) != null && 'sticky',
                      isTotal
                        ? 'bg-who-cell-indicator font-semibold text-who-heading'
                        : 'bg-who-surface text-who-text',
                    )}
                    style={{ left: stickyLeft(level), minWidth: LABEL_WIDTH, width: LABEL_WIDTH }}
                    title={axisLabelAt(row, level, totalWord)}
                  >
                    {axisLabelAt(row, level, totalWord)}
                  </th>
                ))}

                {table.columns.map((column, columnIndex) => {
                  const cell = table.cells[rowIndex]?.[columnIndex] ?? null
                  const totalCell = isTotal || column.node.kind !== 'leaf'
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        'border-l border-who-border/60 px-3 py-2 text-right tabular-nums whitespace-nowrap',
                        totalCell
                          ? 'bg-who-cell-indicator font-semibold text-who-heading'
                          : 'text-who-text',
                      )}
                    >
                      {cell?.mixedUnits ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-who-warn">
                              <AlertTriangle className="size-3.5" />
                              {vocabulary.chrome.mixed}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            The values behind this total are in different units — national
                            currencies that differ, or a percentage alongside a currency amount.
                            Switch the report to US dollars, or split the units onto their own
                            rows, and the total becomes meaningful.
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        formatCell(cell?.value ?? null, decimals)
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
