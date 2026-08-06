/**
 * Paste, with the mode chosen at the point of pasting (UC031).
 *
 *   > "Copy and paste values, formulas or metadata for a range of cells,
 *   > including between different workbooks."
 *
 * A confirmation step rather than a silent paste, for two reasons. The three
 * modes produce genuinely different results from the same clipboard and there
 * is no way to infer which was meant. And a **cross-workbook** paste is the
 * case the use case names — pasting Canada's figures into Kenya by accident is
 * the kind of mistake that should require one deliberate click, so the source
 * workbook is named on screen before it happens.
 */

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  cellToText,
  PASTE_MODES,
  PASTE_MODE_DESCRIPTIONS,
  PASTE_MODE_LABELS,
  type Clip,
  type PasteMode,
} from '@/domain/workbook'
import { useWorkbookStore } from '@/stores/workbookStore'
import { cn } from '@/lib/utils'

export interface PasteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clip: Clip | null
  targetLabel: string
  onPaste: (mode: PasteMode) => void
}

export function PasteDialog({ open, onOpenChange, clip, targetLabel, onPaste }: PasteDialogProps) {
  const pasteMode = useWorkbookStore((s) => s.pasteMode)
  const setPasteMode = useWorkbookStore((s) => s.setPasteMode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste {clip ? `${clip.rows} × ${clip.columns}` : ''} cells</DialogTitle>
          <DialogDescription>
            From <span className="font-semibold">{clip?.sourceLabel ?? '—'}</span> into{' '}
            <span className="font-mono">{targetLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={pasteMode} onValueChange={(v) => setPasteMode(v as PasteMode)}>
          {PASTE_MODES.map((mode) => (
            <label
              key={mode}
              htmlFor={`paste-${mode}`}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded border px-3 py-2 transition-colors',
                pasteMode === mode
                  ? 'border-who-brand bg-who-brand/5'
                  : 'border-who-border hover:border-who-primary-blue',
              )}
            >
              <RadioGroupItem value={mode} id={`paste-${mode}`} className="mt-0.5" />
              <span>
                <Label
                  htmlFor={`paste-${mode}`}
                  className="cursor-pointer text-[length:var(--text-body-sm)] font-semibold text-who-heading"
                >
                  {PASTE_MODE_LABELS[mode]}
                </Label>
                <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                  {PASTE_MODE_DESCRIPTIONS[mode]}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>

        {/* What will actually land, in the chosen mode. */}
        {clip ? (
          <div>
            <p className="mb-1 text-[length:var(--text-meta)] font-semibold text-who-heading uppercase">
              Preview
            </p>
            <div className="max-h-32 overflow-auto rounded border border-who-border bg-who-page-bg p-2">
              <table className="font-mono text-[length:var(--text-meta)]">
                <tbody>
                  {clip.cells.slice(0, 6).map((row, r) => (
                    <tr key={r}>
                      {row.slice(0, 6).map((cell, c) => (
                        <td key={c} className="max-w-32 truncate px-2 py-0.5 text-right">
                          {cellToText(cell, pasteMode) || '—'}
                        </td>
                      ))}
                      {row.length > 6 ? <td className="px-2 text-who-text-muted">…</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              {clip.rows > 6 ? (
                <p className="px-2 text-[length:var(--text-meta)] text-who-text-muted">
                  …and {clip.rows - 6} more rows
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          <Badge variant="secondary" className="mr-1.5">
            note
          </Badge>
          Calculated rows are skipped — they belong to the formula engine and are never paste
          targets.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!clip} onClick={() => onPaste(pasteMode)}>
            Paste {PASTE_MODE_LABELS[pasteMode].toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
