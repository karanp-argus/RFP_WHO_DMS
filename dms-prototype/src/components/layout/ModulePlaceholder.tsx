/**
 * Scaffolding for modules not yet built.
 *
 * Each placeholder names the use cases it will satisfy and the phase that
 * builds it, so the shell is a live coverage map while work is in progress.
 * Delete each one as its module lands.
 */

import { PageHeader } from './PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ModulePlaceholderProps {
  title: string
  description?: string
  phase: string
  useCases: string[]
}

export function ModulePlaceholder({
  title,
  description,
  phase,
  useCases,
}: ModulePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="shadow-who-card">
        <CardContent className="p-8">
          <p className="text-[length:var(--text-meta)] font-semibold tracking-wide text-who-text-muted uppercase">
            {phase}
          </p>
          <p className="mt-3 text-[length:var(--text-body-sm)] text-who-text-muted">
            Use cases covered by this module:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {useCases.map((uc) => (
              <Badge
                key={uc}
                variant="secondary"
                className="border border-who-border bg-who-page-bg font-mono text-[length:var(--text-meta)] text-who-heading"
              >
                {uc}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
