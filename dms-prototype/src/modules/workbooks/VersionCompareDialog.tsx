/**
 * Version compare and restore (UC043 / UC044).
 *
 * UC044 sets the bound precisely — *"view up to 10 versions of an observation
 * … compare up to 10 versions … select one of the past 10 versions and restore
 * it as current"* — so the dialog lists at most ten, side by side, with the
 * delta against the current value spelled out rather than left to be eyeballed.
 *
 * Versions come from `Sys_CommitDateUtc`-stamped snapshots rather than a bespoke
 * audit log, which is the same substrate Annex 3's `LastModified` filter uses.
 * Restoring writes a normal edit, so it is itself undoable and itself saved to
 * xMart with the restoring user as author — a restore is a change, not a
 * rewrite of history.
 */

import { useQuery } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { mockXMartClient } from '@/data/xmart/mockClient'
import type { CellChange } from '@/domain/workbook'
import type { WorkbookCell } from '@/hooks/useWorkbookData'
import { currentSnapshot } from '@/stores/workbookStore'
import { BLANK, formatValue } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface VersionCompareDialogProps {
  cell: WorkbookCell | null
  onOpenChange: (open: boolean) => void
  onRestore: (change: CellChange, label: string) => void
}

export function VersionCompareDialog({
  cell,
  onOpenChange,
  onRestore,
}: VersionCompareDialogProps) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ['xmart', 'versions', cell?.observationKey],
    enabled: cell != null,
    queryFn: () => mockXMartClient.getVersions(cell?.observationKey ?? ''),
  })

  const current = cell?.value ?? null

  return (
    <Dialog open={cell != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" aria-hidden />
            Version history
          </DialogTitle>
          <DialogDescription>
            {cell
              ? `${cell.coordinate.iso3} · ${cell.coordinate.year} · ${cell.coordinate.code} — up to 10 prior versions (UC044).`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-who-brand/40 bg-who-brand/5 px-3 py-2">
          <p className="text-[length:var(--text-meta)] text-who-text-muted uppercase">Current</p>
          <p className="font-mono text-[length:var(--text-body)] font-semibold text-who-heading">
            {formatValue(current)}
          </p>
        </div>

        {isLoading ? (
          <p className="text-[length:var(--text-meta)] text-who-text-muted">
            Loading history from xMart…
          </p>
        ) : (versions?.length ?? 0) === 0 ? (
          <p className="rounded border border-who-border bg-who-page-bg px-3 py-4 text-center text-[length:var(--text-body-sm)] text-who-text-muted">
            This observation has never been revised. Roughly a fifth of the corpus carries
            revisions, so the marker means something when it appears.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5 pr-3">
              {[...(versions ?? [])].reverse().map((version) => {
                const delta =
                  current != null && version.value != null ? version.value - current : null
                const percent =
                  delta != null && current !== 0 && current != null
                    ? (delta / current) * 100
                    : null

                return (
                  <div
                    key={version.versionNumber}
                    className="flex flex-wrap items-center gap-3 rounded border border-who-border bg-who-surface px-3 py-2"
                  >
                    <Badge variant="outline" className="shrink-0">
                      v{version.versionNumber}
                    </Badge>

                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                        {version.value == null ? BLANK : formatValue(version.value)}
                        {delta != null ? (
                          <span
                            className={cn(
                              'ml-2 text-[length:var(--text-meta)] font-normal',
                              delta > 0 ? 'text-who-pass' : 'text-who-fail',
                            )}
                          >
                            {delta > 0 ? '+' : ''}
                            {formatValue(delta)}
                            {percent != null
                              ? ` (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)`
                              : ''}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[length:var(--text-meta)] text-who-text-muted">
                        {new Date(version.commitDateUtc).toLocaleDateString('en-GB')} ·{' '}
                        {version.author} · batch {version.batchId}
                      </p>
                      {version.metadata.COMMENT ? (
                        <p className="truncate text-[length:var(--text-meta)] text-who-text">
                          {version.metadata.COMMENT}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        if (!cell) return
                        const before = currentSnapshot(cell.observationKey)
                        onRestore(
                          {
                            observationKey: cell.observationKey,
                            before,
                            after: {
                              ...before,
                              value: version.value,
                              metadata: version.metadata,
                            },
                          },
                          `Restore v${version.versionNumber} of ${cell.coordinate.code}`,
                        )
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          Restoring writes a normal edit — it is undoable, and it goes to xMart with you as the
          author. History is never rewritten.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
