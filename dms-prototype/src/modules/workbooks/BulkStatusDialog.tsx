/**
 * Publishing status in bulk (UC024).
 *
 * The FR is explicit that this is "treated as a simple workflow" with exactly
 * two values, and that it can be set "for a selection of observations or by
 * classification, category or indicator across a country". So the dialog offers
 * both scopes rather than only the selected range — setting a whole country's
 * `HF` classification ready to publish is the action the use case actually
 * describes, and doing it by dragging a selection over 400 cells is not it.
 */

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  PUBLISHING_STATUSES,
  PUBLISHING_STATUS_LABELS,
  type PublishingStatus,
} from '@/domain/constants'
import type { CellChange, GridColumn, GridRow } from '@/domain/workbook'
import type { WorkbookCell } from '@/hooks/useWorkbookData'
import { currentSnapshot } from '@/stores/workbookStore'
import { cn } from '@/lib/utils'
import type { GridRangeRef } from './WorkbookGrid'

type Scope = 'selection' | 'workbook'

export interface BulkStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: GridRow[]
  columns: GridColumn[]
  range: GridRangeRef | null
  getCell: (rowKey: string, columnKey: string) => WorkbookCell | null
  onApply: (changes: CellChange[], label: string) => void
}

export function BulkStatusDialog({
  open,
  onOpenChange,
  rows,
  columns,
  range,
  getCell,
  onApply,
}: BulkStatusDialogProps) {
  const [status, setStatus] = useState<PublishingStatus>('ready-to-publish')
  const [scope, setScope] = useState<Scope>('selection')

  const changes = useMemo<CellChange[]>(() => {
    if (!open) return []

    const bounds =
      scope === 'workbook' || !range
        ? { minRow: 0, maxRow: rows.length - 1, minColumn: 0, maxColumn: columns.length - 1 }
        : range

    const out: CellChange[] = []
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const row = rows[r]
      // A calculated row has no stored observation to publish — its value is
      // derived at read time, so a publishing flag on it would mean nothing.
      if (!row || row.isCalculated) continue
      for (let c = bounds.minColumn; c <= bounds.maxColumn; c++) {
        const column = columns[c]
        if (!column) continue
        const cell = getCell(row.key, column.key)
        if (!cell || cell.observation == null) continue
        if (cell.publishingStatus === status) continue
        const before = currentSnapshot(cell.observationKey)
        out.push({
          observationKey: cell.observationKey,
          before,
          after: { ...before, publishingStatus: status },
        })
      }
    }
    return out
  }, [open, scope, range, rows, columns, getCell, status])

  const selectionSize = range
    ? (range.maxRow - range.minRow + 1) * (range.maxColumn - range.minColumn + 1)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set publishing status</DialogTitle>
          <DialogDescription>
            UC024 treats publication as a two-value workflow. Only observations that already
            differ from the chosen status are written.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[length:var(--text-meta)]">Status</Label>
            <RadioGroup
              className="mt-1.5"
              value={status}
              onValueChange={(v) => setStatus(v as PublishingStatus)}
            >
              {PUBLISHING_STATUSES.map((s) => (
                <label
                  key={s}
                  htmlFor={`status-${s}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded border px-3 py-2',
                    status === s
                      ? 'border-who-brand bg-who-brand/5'
                      : 'border-who-border hover:border-who-primary-blue',
                  )}
                >
                  <RadioGroupItem value={s} id={`status-${s}`} />
                  <span className="text-[length:var(--text-body-sm)]">
                    {PUBLISHING_STATUS_LABELS[s]}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-[length:var(--text-meta)]">Apply to</Label>
            <RadioGroup
              className="mt-1.5"
              value={scope}
              onValueChange={(v) => setScope(v as Scope)}
            >
              <label
                htmlFor="scope-selection"
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded border px-3 py-2',
                  scope === 'selection'
                    ? 'border-who-brand bg-who-brand/5'
                    : 'border-who-border hover:border-who-primary-blue',
                )}
              >
                <RadioGroupItem value="selection" id="scope-selection" disabled={range == null} />
                <span className="text-[length:var(--text-body-sm)]">
                  The selected range
                  <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                    {range ? `${selectionSize} cells selected` : 'nothing selected in the grid'}
                  </span>
                </span>
              </label>
              <label
                htmlFor="scope-workbook"
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded border px-3 py-2',
                  scope === 'workbook'
                    ? 'border-who-brand bg-who-brand/5'
                    : 'border-who-border hover:border-who-primary-blue',
                )}
              >
                <RadioGroupItem value="workbook" id="scope-workbook" />
                <span className="text-[length:var(--text-body-sm)]">
                  Everything in this workbook
                  <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                    The whole classification for this country — UC024&apos;s "by classification
                    across a country"
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <p className="flex items-center gap-2 rounded border border-who-border bg-who-page-bg px-3 py-2 text-[length:var(--text-meta)]">
            <Badge variant="secondary">{changes.length}</Badge>
            observation{changes.length === 1 ? '' : 's'} will change. Calculated rows are excluded —
            they are derived at read time and carry no stored record to publish.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={changes.length === 0}
            onClick={() =>
              onApply(
                changes,
                `Set ${changes.length} observations to ${PUBLISHING_STATUS_LABELS[status]}`,
              )
            }
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
