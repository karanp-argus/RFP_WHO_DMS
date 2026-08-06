/**
 * Page title block. The reference overrides h2 to 28px inside `.content`
 * (_layout.scss) and colours it $violet-dark.
 */

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Right-aligned actions (primary buttons, exports). */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[length:var(--text-page-title)] leading-tight font-bold text-who-heading">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-[length:var(--text-body-sm)] text-who-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
