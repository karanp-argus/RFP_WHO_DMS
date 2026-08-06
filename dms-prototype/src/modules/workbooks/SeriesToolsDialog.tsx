/**
 * Series tools — HLR8's "filling data series" and "extrapolate for previous and
 * future values", applied to a selected range.
 *
 * **Preview before commit, always.** These operations write numbers a country
 * did not report, into cells that will be exported and published. Presenting
 * that as a one-click action would be wrong even if the maths were perfect. So
 * the dialog computes the whole result first, shows every cell it would fill
 * and where the figure came from, and only then offers to apply it.
 *
 * The maths is the Phase 3 `domain/formula/series.ts` — the same
 * interpolation and linear/CAGR extrapolation the `INTERPOLATE` and
 * `EXTRAPOLATE` functions use, so a filled cell and a formula cell cannot
 * disagree.
 */

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fillSeries, type ExtrapolationMethod, type SeriesPoint } from '@/domain/formula'
import type { CellChange, GridColumn, GridRow } from '@/domain/workbook'
import type { WorkbookCell } from '@/hooks/useWorkbookData'
import { currentSnapshot } from '@/stores/workbookStore'
import { formatValue } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GridRangeRef } from './WorkbookGrid'

export interface SeriesToolsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: GridRow[]
  columns: GridColumn[]
  range: GridRangeRef | null
  getCell: (rowKey: string, columnKey: string) => WorkbookCell | null
  onApply: (changes: CellChange[], label: string) => void
}

interface PreviewEntry {
  rowLabel: string
  columnKey: string
  value: number
  origin: 'interpolated' | 'extrapolated'
  change: CellChange
}

export function SeriesToolsDialog({
  open,
  onOpenChange,
  rows,
  columns,
  range,
  getCell,
  onApply,
}: SeriesToolsDialogProps) {
  const [interpolate, setInterpolate] = useState(true)
  const [backward, setBackward] = useState(false)
  const [forward, setForward] = useState(false)
  const [method, setMethod] = useState<ExtrapolationMethod>('linear')

  /**
   * Compute the fill across the selected rows.
   *
   * Each row is a series in its own right, so the operation runs row by row.
   * Calculated rows are skipped — filling a gap in a computed indicator would
   * write a literal over something the engine owns.
   */
  const preview = useMemo<PreviewEntry[]>(() => {
    if (!open || !range) return []
    const out: PreviewEntry[] = []

    for (let r = range.minRow; r <= range.maxRow; r++) {
      const row = rows[r]
      if (!row || row.isCalculated) continue

      // The series spans the whole workbook width, not just the selection —
      // interpolating inside a narrow selection would ignore the reported
      // values just outside it, which is how you get a straight line through
      // data that was never straight.
      const series: SeriesPoint[] = columns.map((column, index) => ({
        year: index,
        value: getCell(row.key, column.key)?.value ?? null,
      }))

      const filled = fillSeries(series, {
        interpolate,
        extrapolateBackward: backward,
        extrapolateForward: forward,
        method,
      })

      for (let c = range.minColumn; c <= range.maxColumn; c++) {
        const column = columns[c]
        const point = filled[c]
        if (!column || !point || point.value == null) continue
        if (point.origin !== 'interpolated' && point.origin !== 'extrapolated') continue

        const cell = getCell(row.key, column.key)
        if (!cell || cell.isCalculated) continue

        const before = currentSnapshot(cell.observationKey)
        out.push({
          rowLabel: row.label,
          columnKey: column.key,
          value: point.value,
          origin: point.origin,
          change: {
            observationKey: cell.observationKey,
            before,
            after: {
              ...before,
              value: point.value,
              // The provenance is written into the metadata, so a filled figure
              // is never indistinguishable from a reported one downstream.
              metadata: {
                ...cell.observation?.metadata,
                EST_METHOD: point.origin === 'interpolated' ? 'Interpolated' : 'Derived as Estimated',
              },
            },
          },
        })
      }
    }
    return out
  }, [open, range, rows, columns, getCell, interpolate, backward, forward, method])

  const noSelection = range == null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fill and extrapolate</DialogTitle>
          <DialogDescription>
            {noSelection
              ? 'Select a range in the grid first.'
              : `Over ${range.maxRow - range.minRow + 1} rows × ${range.maxColumn - range.minColumn + 1} columns.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Option
            id="series-interpolate"
            checked={interpolate}
            onChange={setInterpolate}
            title="Fill gaps between reported years"
            description="Straight line between the nearest reported points either side. Needs a value on both sides."
          />
          <Option
            id="series-backward"
            checked={backward}
            onChange={setBackward}
            title="Extrapolate backwards"
            description="Project before the first reported year, from the trend of the two nearest points."
          />
          <Option
            id="series-forward"
            checked={forward}
            onChange={setForward}
            title="Extrapolate forwards"
            description="Project beyond the last reported year."
          />

          {backward || forward ? (
            <div className="flex items-center gap-2 pl-6">
              <Label className="text-[length:var(--text-meta)]">Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as ExtrapolationMethod)}>
                <SelectTrigger className="h-8 w-56 text-[length:var(--text-meta)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear — continue the slope</SelectItem>
                  <SelectItem value="cagr">Compound — continue the annual rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-1 flex items-center gap-2 text-[length:var(--text-meta)] font-semibold text-who-heading uppercase">
            Preview
            <Badge variant="secondary">{preview.length} cells</Badge>
          </p>
          <div className="max-h-56 overflow-auto rounded border border-who-border">
            {preview.length === 0 ? (
              <p className="p-3 text-[length:var(--text-meta)] text-who-text-muted">
                Nothing to fill in this selection with these options.
              </p>
            ) : (
              <table className="w-full text-[length:var(--text-body-sm)]">
                <thead className="sticky top-0 bg-who-page-bg text-[length:var(--text-meta)] text-who-text-muted uppercase">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">Variable</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Column</th>
                    <th className="px-3 py-1.5 text-left font-semibold">How</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 200).map((entry, i) => (
                    <tr key={i} className="border-t border-who-border/60 bg-who-surface">
                      <td className="max-w-64 truncate px-3 py-1">{entry.rowLabel}</td>
                      <td className="px-3 py-1 font-mono">{entry.columnKey}</td>
                      <td className="px-3 py-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            entry.origin === 'interpolated'
                              ? 'border-who-primary-blue/50 text-who-primary-blue'
                              : 'border-who-warn/50 text-who-warn',
                          )}
                        >
                          {entry.origin}
                        </Badge>
                      </td>
                      <td className="px-3 py-1 text-right font-mono tabular-nums">
                        {formatValue(entry.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
            Every filled cell is stamped in its <span className="font-mono">EST_METHOD</span>{' '}
            metadata, so a derived figure stays distinguishable from a reported one in exports.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={preview.length === 0}
            onClick={() =>
              onApply(
                preview.map((p) => p.change),
                `Fill ${preview.length} cells`,
              )
            }
          >
            Apply to {preview.length} cells
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Option({
  id,
  checked,
  onChange,
  title,
  description,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  description: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2 rounded border border-who-border px-3 py-2 hover:border-who-primary-blue"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>
        <span className="block text-[length:var(--text-body-sm)] font-semibold text-who-heading">
          {title}
        </span>
        <span className="block text-[length:var(--text-meta)] text-who-text-muted">
          {description}
        </span>
      </span>
    </label>
  )
}
