/**
 * Suspense fallback for a lazily-loaded route module (Phase 8 item 1).
 *
 * Shaped like a page rather than a spinner: a page header, a toolbar strip and a
 * grid of rows. Route chunks resolve in tens of milliseconds from a local static
 * host, so what this mostly prevents is the layout *collapsing to nothing* for
 * one frame and snapping back — which reads as a flicker rather than as loading.
 *
 * `aria-busy` with a visually-hidden label rather than a bare set of grey boxes,
 * so a screen reader announces the wait instead of reading nothing.
 */

import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton({ label = 'Loading module…' }: { label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}</span>

      {/* Page header — title and subtitle. */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Toolbar strip. */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Content body. */}
      <div className="space-y-2 rounded border border-who-border bg-who-surface p-4 shadow-who-card">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    </div>
  )
}
