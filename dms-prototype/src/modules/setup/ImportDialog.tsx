/**
 * Re-import an edited export (UC021).
 *
 * "Administrator edits the exported file, can modify some values ... and can
 * create some values. Administrator imports the modified file. During import
 * process, DMS will check the imported files for viruses and will verify the
 * format of the file."
 *
 * The format and schema check is real. The virus scan is not something a
 * front-end can do, so it is labelled as a server-side step rather than mimed —
 * overstating what the prototype does is the one thing that loses a WHO bid.
 */

import { useRef, useState } from 'react'
import { AlertTriangle, FileUp, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { readSpreadsheet, type ImportResult } from '@/lib/exporters'
import { cn } from '@/lib/utils'

export function ImportDialog({
  open,
  onOpenChange,
  label,
  expectedHeaders,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  expectedHeaders: readonly string[]
  onApply: (rows: Record<string, string>[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setFileName(file.name)
    try {
      setResult(await readSpreadsheet(file, expectedHeaders))
    } catch (e) {
      setResult({
        headers: [],
        rows: [],
        errors: [e instanceof Error ? e.message : 'The file could not be read.'],
      })
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setResult(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const blocked = result != null && result.errors.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Upload a previously exported .xlsx or .csv. Existing rows are matched on their key
            column and updated; unrecognised keys are created as new values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-who-hint/60 px-4 py-8 text-center transition-colors',
              'hover:border-who-primary-blue hover:bg-who-page-bg',
            )}
          >
            <FileUp className="size-6 text-who-icon" aria-hidden />
            <span className="text-[length:var(--text-body-sm)] font-medium text-who-heading">
              {fileName || 'Choose a file'}
            </span>
            <span className="text-[length:var(--text-meta)] text-who-text-muted">
              .xlsx or .csv
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
          </label>

          {/* Honest about the boundary. */}
          <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Format and schema are validated here. Virus scanning happens server-side on the real
              system and is not simulated in this prototype.
            </span>
          </p>

          {busy ? (
            <p className="text-[length:var(--text-body-sm)] text-who-text-muted">Reading file…</p>
          ) : null}

          {result ? (
            blocked ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Import blocked</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-32">
                    <ul className="list-inside list-disc space-y-0.5">
                      {result.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <ShieldCheck className="size-4" />
                <AlertTitle>Ready to import</AlertTitle>
                <AlertDescription>
                  {result.rows.length.toLocaleString()} data row
                  {result.rows.length === 1 ? '' : 's'} across {result.headers.length} columns. All
                  required columns are present.
                </AlertDescription>
              </Alert>
            )
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={result == null || blocked || busy}
            onClick={() => result && onApply(result.rows)}
          >
            Import {result && !blocked ? `${result.rows.length} rows` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
