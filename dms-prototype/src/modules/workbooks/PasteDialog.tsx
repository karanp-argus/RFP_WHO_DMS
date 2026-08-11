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
 *
 * **Layout note — `DialogContent` is a CSS grid.** Its children are grid items,
 * and a grid item's default `min-width: auto` means its *min-content* width
 * inflates the column track. A clipboard preview holds unbreakable strings
 * (`SOURCES=Household expenditure survey`), so without `min-w-0` the track grows
 * past `sm:max-w-xl`, every sibling stretches with it, and the whole stack paints
 * outside the dialog's own rounded background. That is what a wide surface
 * scrolling inside its own container buys here: the preview scrolls, the dialog
 * keeps its width.
 */

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
import { ArrowRight, Info } from 'lucide-react'
import { useCallback, useState } from 'react'

/** How much of the clip the preview shows before it starts counting the rest. */
const PREVIEW_ROWS = 6
const PREVIEW_COLUMNS = 8

/** The footer verb. `Paste values only` reads badly; the modes need their own. */
const PASTE_ACTION_LABELS: Record<PasteMode, string> = {
  values: 'Paste values',
  formulas: 'Paste formulas',
  metadata: 'Paste metadata',
}

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

  const previewRows = clip?.cells.slice(0, PREVIEW_ROWS) ?? []
  const hiddenRows = clip ? Math.max(0, clip.rows - PREVIEW_ROWS) : 0
  const hiddenColumns = clip ? Math.max(0, clip.columns - PREVIEW_COLUMNS) : 0

  /**
   * Whether the preview actually overflows its box, measured rather than guessed.
   * Platform scrollbars are overlay-drawn on Windows and macOS, so a cell clipped
   * at the right edge otherwise reads as a rendering fault.
   *
   * A `ResizeObserver` rather than a layout effect, for two reasons a layout effect
   * gets wrong: inside a Radix portal the box measures 0 × 0 at mount, so the cue
   * never appeared on the first open; and the *content* width changes with the mode
   * (a metadata string is four times a value) while the box does not, so the
   * observer watches the table as well as its container.
   */
  const [scrollsSideways, setScrollsSideways] = useState(false)
  const attachPreview = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new ResizeObserver(() =>
      setScrollsSideways(node.scrollWidth > node.clientWidth + 1),
    )
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    return () => observer.disconnect()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle>
            Paste {clip ? `${clip.rows} × ${clip.columns}` : ''} cells
          </DialogTitle>
          <DialogDescription>
            The same clipboard produces three different results, so the mode is chosen here
            rather than inferred.
          </DialogDescription>
        </DialogHeader>

        {/* Source and target, one per line. A cross-workbook paste — the case UC031
            names — has to be readable at a glance, not buried in a sentence. */}
        <dl className="grid min-w-0 gap-1 rounded border border-who-border bg-who-page-bg px-3 py-2">
          {[
            { term: 'From', value: clip?.sourceLabel ?? '—', mono: false },
            { term: 'Into', value: targetLabel, mono: true },
          ].map(({ term, value, mono }) => (
            <div key={term} className="flex min-w-0 gap-3">
              <dt className="w-9 shrink-0 pt-px text-[length:var(--text-meta)] text-who-text-muted uppercase">
                {term}
              </dt>
              <dd
                className={cn(
                  'min-w-0 flex-1 text-[length:var(--text-body-sm)] break-words text-who-heading',
                  mono ? 'font-mono' : 'font-semibold',
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <RadioGroup
          className="min-w-0"
          value={pasteMode}
          onValueChange={(v) => setPasteMode(v as PasteMode)}
        >
          {PASTE_MODES.map((mode) => (
            <label
              key={mode}
              htmlFor={`paste-${mode}`}
              className={cn(
                'flex min-w-0 cursor-pointer items-start gap-3 rounded border px-3 py-2 transition-colors',
                pasteMode === mode
                  ? 'border-who-brand bg-who-brand/5'
                  : 'border-who-border hover:border-who-primary-blue',
              )}
            >
              <RadioGroupItem value={mode} id={`paste-${mode}`} className="mt-0.5" />
              <span className="min-w-0">
                <Label
                  htmlFor={`paste-${mode}`}
                  className="cursor-pointer text-[length:var(--text-body-sm)] font-semibold text-who-heading"
                >
                  {PASTE_MODE_LABELS[mode]}
                </Label>
                <span className="mt-0.5 block text-[length:var(--text-meta)] leading-snug text-who-text-muted">
                  {PASTE_MODE_DESCRIPTIONS[mode]}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>

        {/* What will actually land, in the chosen mode. `min-w-0` on the wrapper is
            what keeps the strings below from widening the dialog — see the header. */}
        {clip ? (
          <div className="min-w-0">
            <p className="mb-1 flex items-baseline gap-2 text-[length:var(--text-meta)] font-semibold text-who-heading uppercase">
              Preview
              <span className="font-normal text-who-text-muted normal-case">
                as {PASTE_MODE_LABELS[pasteMode].toLowerCase()}
              </span>
              {scrollsSideways ? (
                <span className="ml-auto inline-flex items-center gap-1 font-normal text-who-text-muted normal-case">
                  scroll for the rest
                  <ArrowRight className="size-3" aria-hidden />
                </span>
              ) : null}
            </p>

            {/* A slim scrollbar where the platform draws one, and the measured
                "scroll for the rest" cue above where it does not. */}
            <div
              ref={attachPreview}
              className="max-h-40 overflow-auto rounded border border-who-border bg-who-page-bg [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-who-border [&::-webkit-scrollbar]:size-1.5"
            >
              <table className="w-max border-collapse text-[length:var(--text-meta)]">
                <tbody className="divide-y divide-who-border/60">
                  {previewRows.map((row, r) => (
                    <tr key={r} className="divide-x divide-who-border/60">
                      {row.slice(0, PREVIEW_COLUMNS).map((cell, c) => {
                        const text = cellToText(cell, pasteMode)
                        // Per cell, not per mode: `formulas` falls back to the value
                        // wherever the source cell has no formula, so a numeric string
                        // turns up in two of the three modes.
                        const numeric = text !== '' && !Number.isNaN(Number(text))
                        return (
                          <td key={c} className="p-0 align-top">
                            {/* The width lives on a block inside the cell: `max-width`
                                does not apply to table cells under auto layout.
                                **Numbers are never truncated** — `19851.6436…` is a
                                different figure from the one that will paste, and the
                                clipboard carries full precision. Text — a metadata
                                string, a formula — truncates, with the whole of it on
                                hover. */}
                            <span
                              title={text || undefined}
                              className={cn(
                                'block px-2 py-1 font-mono',
                                numeric
                                  ? 'min-w-20 text-right whitespace-nowrap tabular-nums'
                                  : 'w-44 truncate text-left',
                                text ? 'text-who-text' : 'text-who-text-muted',
                              )}
                            >
                              {text || '—'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hiddenRows > 0 || hiddenColumns > 0 ? (
              <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                Showing {previewRows.length} of {clip.rows}{' '}
                {clip.rows === 1 ? 'row' : 'rows'} and{' '}
                {Math.min(clip.columns, PREVIEW_COLUMNS)} of {clip.columns} columns — the whole
                clip pastes, not just what is shown.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="flex min-w-0 items-start gap-2 text-[length:var(--text-meta)] text-who-text-muted">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">
            Calculated rows are skipped — they belong to the formula engine and are never paste
            targets.
          </span>
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!clip} onClick={() => onPaste(pasteMode)}>
            {PASTE_ACTION_LABELS[pasteMode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
