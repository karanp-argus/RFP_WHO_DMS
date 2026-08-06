/**
 * Shown when a grid or panel has nothing to display.
 *
 * A prototype that renders a blank pane reads as unfinished, so every surface
 * that can be empty says why it is empty (plan §Phase 8.1).
 */

import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  message,
  hint,
  action,
}: {
  message: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Inbox className="size-8 text-who-icon" aria-hidden />
      <p className="text-[length:var(--text-body-sm)] font-medium text-who-heading">{message}</p>
      {hint ? (
        <p className="max-w-md text-[length:var(--text-meta)] text-who-text-muted">{hint}</p>
      ) : null}
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading from xMart…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span
        className="size-6 animate-spin rounded-full border-2 border-who-border border-t-who-primary-blue"
        aria-hidden
      />
      {/* The label names xMart deliberately: every fetch is an API call, and the
          demo benefits from that being visible rather than implied. */}
      <p className="text-[length:var(--text-meta)] text-who-text-muted">{label}</p>
    </div>
  )
}
