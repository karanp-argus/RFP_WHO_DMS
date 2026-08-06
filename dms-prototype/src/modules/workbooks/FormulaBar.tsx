/**
 * The formula bar.
 *
 * UC031 asks for two things the grid alone cannot do: a cell whose contents
 * "display the terms of the formula" while still showing a computed value, and
 * somewhere to author `=HF.1+HF.2` without the expression fighting the column
 * width. So the bar shows the formula and the grid shows the result — the
 * arrangement every spreadsheet uses, for the same reason.
 *
 * Expressions are validated live by the Phase 3 engine before they can be
 * committed, so an unknown code or a circular reference is refused at the point
 * of entry rather than discovered as a blank cell later.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, FunctionSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCycle, type FormulaEngine } from '@/domain/formula'
import type { WorkbookCell } from '@/hooks/useWorkbookData'
import { formatValue } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface FormulaBarProps {
  cell: WorkbookCell | null
  rowLabel: string
  engine: FormulaEngine | null
  editable: boolean
  onCommit: (text: string) => void
}

export function FormulaBar({ cell, rowLabel, engine, editable, onCommit }: FormulaBarProps) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!cell) {
      setDraft('')
      return
    }
    setDraft(
      cell.formula != null && !cell.isCalculated
        ? cell.formula
        : cell.value == null
          ? ''
          : String(cell.value),
    )
  }, [cell])

  const isFormula = draft.trimStart().startsWith('=')
  const check = isFormula && engine ? engine.validate(draft.trim().slice(1)) : null
  const readOnly = !editable || cell == null || cell.isCalculated

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-who-border bg-who-surface px-3 py-1.5">
      <span className="flex min-w-0 items-center gap-1.5">
        <FunctionSquare className="size-3.5 shrink-0 text-who-text-muted" aria-hidden />
        <span className="truncate font-mono text-[length:var(--text-meta)] text-who-text-muted">
          {cell
            ? `${cell.coordinate.iso3} · ${cell.coordinate.year} · ${cell.coordinate.code}`
            : 'no cell selected'}
        </span>
      </span>

      <span className="hidden max-w-40 truncate text-[length:var(--text-meta)] text-who-text-muted sm:inline">
        {rowLabel}
      </span>

      <Input
        aria-label="Formula bar"
        value={draft}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // The grid listens for Enter at the document level and starts editing
          // the active cell when it sees one. Without this the bar's own commit
          // would immediately drop the grid into edit mode on the same cell.
          if (e.key === 'Enter' || e.key === 'Escape') e.stopPropagation()
          if (e.key === 'Enter' && !(check && !check.ok)) onCommit(draft)
          if (e.key === 'Escape') {
            setDraft(
              cell?.formula != null && !cell.isCalculated
                ? cell.formula
                : cell?.value == null
                  ? ''
                  : String(cell.value),
            )
          }
        }}
        placeholder={
          cell?.isCalculated
            ? 'Calculated by the formula engine — not editable here'
            : 'A number, or =HF.1 + HF.2'
        }
        className={cn(
          'h-7 min-w-48 flex-1 font-mono text-[length:var(--text-body-sm)]',
          check && !check.ok && 'border-who-fail',
        )}
      />

      <Button
        size="sm"
        className="h-7"
        disabled={readOnly || (check != null && !check.ok)}
        onClick={() => onCommit(draft)}
      >
        <Check className="size-3.5" />
        <span className="sr-only">Commit</span>
      </Button>

      {cell?.isCalculated ? (
        <Badge variant="secondary" className="shrink-0">
          calculated · {formatValue(cell.value)}
        </Badge>
      ) : null}

      {check && !check.ok ? (
        <span className="flex w-full items-start gap-1.5 text-[length:var(--text-meta)] text-who-fail">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {check.cycle
            ? `Circular reference: ${formatCycle(check.cycle)}`
            : check.unknownCodes.length > 0
              ? `Unknown code${check.unknownCodes.length === 1 ? '' : 's'}: ${check.unknownCodes.join(', ')}`
              : (check.error?.message ?? 'That expression cannot be read.')}
        </span>
      ) : null}
    </div>
  )
}
