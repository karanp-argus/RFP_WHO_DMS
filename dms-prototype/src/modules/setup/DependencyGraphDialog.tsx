/**
 * The dependency graph, as the engine actually holds it.
 *
 * Formulas reference formulas — `CHE%GDP_SHA2011` → `CHE` → `HF.*` — so the
 * engine cannot evaluate them in list order and cannot expand them textually.
 * It topologically sorts them and detects cycles up front. This dialog shows
 * that ordering, the edges behind it, and any cycle by name, because "we handle
 * circular references" is a claim and a named cycle path is evidence.
 */

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCycle, type FormulaEngine } from '@/domain/formula'

export interface DependencyGraphDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  engine: FormulaEngine | null
}

export function DependencyGraphDialog({ open, onOpenChange, engine }: DependencyGraphDialogProps) {
  const order = engine?.order ?? []
  const cycles = engine?.cycles ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Formula dependency graph</DialogTitle>
          <DialogDescription>
            Evaluation order derived by topological sort. A formula is only evaluated once
            everything it reads has a value.
          </DialogDescription>
        </DialogHeader>

        {cycles.length === 0 ? (
          <p className="flex items-center gap-1.5 rounded border border-who-pass/40 bg-who-pass/5 px-3 py-2 text-[length:var(--text-meta)] text-who-text">
            <CheckCircle2 className="size-3.5 shrink-0 text-who-pass" aria-hidden />
            No circular references. All {order.length} formulas are orderable.
          </p>
        ) : (
          <div className="rounded border border-who-fail/40 bg-who-fail/5 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[length:var(--text-meta)] font-semibold text-who-fail">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {cycles.length} circular reference{cycles.length === 1 ? '' : 's'} — these formulas
              are reported rather than evaluated.
            </p>
            {cycles.map((cycle, i) => (
              <p key={i} className="mt-1 font-mono text-[length:var(--text-meta)] text-who-text">
                {formatCycle(cycle)}
              </p>
            ))}
          </div>
        )}

        <ScrollArea className="max-h-[55vh] pr-3">
          <ol className="space-y-1">
            {order.map((code, i) => {
              const deps = engine?.graph.dependencies.get(code) ?? []
              return (
                <li
                  key={code}
                  className="flex flex-wrap items-center gap-2 rounded border border-who-border bg-who-surface px-3 py-1.5"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-[length:var(--text-meta)] text-who-text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <span className="font-mono text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                    {code}
                  </span>
                  {deps.length === 0 ? (
                    <span className="text-[length:var(--text-meta)] text-who-text-muted">
                      reads variables only
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1 text-[length:var(--text-meta)] text-who-text-muted">
                      reads
                      {deps.map((d) => (
                        <Badge key={d} variant="secondary" className="font-mono">
                          {d}
                        </Badge>
                      ))}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
