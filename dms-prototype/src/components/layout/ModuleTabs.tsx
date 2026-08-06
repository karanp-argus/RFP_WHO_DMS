/**
 * Pill tabs, matched to the reference's `.custom-tab`
 * (/Reference/html_pages/sass/_layout.scss):
 *
 *   min-width 160px · 600 weight · muted label · active gets the
 *   $primary-blue colour and a 3px bottom border · 1px container underline
 *
 * A plain button row rather than Radix Tabs, because the panel content is
 * routed by URL rather than mounted as sibling panels — mounting seven Setup
 * tabs at once would fire seven xMart queries on arrival.
 */

import { cn } from '@/lib/utils'

export interface ModuleTab {
  id: string
  label: string
  /** Optional count badge, e.g. rule or report totals. */
  count?: number
}

export function ModuleTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly ModuleTab[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Module sections"
      className="flex flex-wrap gap-x-1 border-b border-who-border"
    >
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px border-b-[3px] px-4 py-2.5 text-left text-[length:var(--text-body)] font-semibold transition-colors',
              isActive
                ? 'border-who-primary-blue text-who-primary-blue'
                : 'border-transparent text-who-text-muted hover:text-who-heading',
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className="ml-1.5 text-[length:var(--text-meta)] tabular-nums opacity-70">
                {t.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
