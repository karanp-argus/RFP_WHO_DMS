/**
 * Application home (UC002, UC003).
 *
 * UC002: "As any type of user, I need to be able to access all modules I have
 * access to from the application home site." The tiles below are derived from
 * ROUTES and filtered by permission, so a regular user sees a different set
 * from an administrator.
 *
 * UC003 (the dashboard) is built in Phase 7 — the FR notes its contents "will
 * be defined during the initiation phase of the project", so the tiles come
 * first and the metrics follow.
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/routes'
import { useAuthStore } from '@/stores/authStore'
import { canView, type PermissionLevel } from '@/domain/permissions'

/**
 * Human-readable note shown on a module tile — only when the user's access is
 * narrower than full. Returns null for unrestricted access.
 */
function accessNote(level: PermissionLevel): string | null {
  switch (level) {
    case 'view':
      return 'View and export only'
    case 'edit-selected-countries':
      return 'Editable for your assigned countries'
    case 'country-customized':
      return 'Customisable for your assigned countries'
    case 'no-access':
      return 'No access'
    case 'edit':
    case 'create-predefined':
      return null
  }
}

export function HomePage() {
  const user = useAuthStore((s) => s.user)
  const permissions = useAuthStore((s) => s.permissions())

  const tiles = ROUTES.filter(
    (r) =>
      r.nav &&
      r.path !== '/' &&
      canView(permissions[r.module]) &&
      !(r.adminOnly && user?.role !== 'administrator'),
  )

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.displayName.split(' ')[0] ?? ''}`}
        description={
          user?.role === 'administrator'
            ? 'You have administrator access to all modules and all countries.'
            : 'You have regular user access. Modules you cannot edit remain available in view and export mode.'
        }
      />

      {/* UC003 — dashboard lands in Phase 7. */}
      <Card className="mb-6 border-dashed shadow-none">
        <CardContent className="p-6">
          <p className="text-[length:var(--text-meta)] font-semibold tracking-wide text-who-text-muted uppercase">
            Phase 7 — Dashboard
          </p>
          <p className="mt-2 text-[length:var(--text-body-sm)] text-who-text-muted">
            Countries reported this cycle · observations pending publication · open quality check
            findings by severity · upcoming reporting due dates · data completeness heatmap.
          </p>
          <div className="mt-3 flex gap-2">
            <Badge
              variant="secondary"
              className="border border-who-border bg-who-page-bg font-mono text-[length:var(--text-meta)] text-who-heading"
            >
              UC003
            </Badge>
            <Badge
              variant="secondary"
              className="border border-who-border bg-who-page-bg font-mono text-[length:var(--text-meta)] text-who-heading"
            >
              UC003.1
            </Badge>
          </div>
        </CardContent>
      </Card>

      <h3 className="mb-3 text-[length:var(--text-h5)] font-semibold text-who-heading">
        Modules
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((r) => {
          const Icon = r.icon
          const level = permissions[r.module]
          return (
            <Link key={r.path} to={r.path} className="group">
              <Card className="h-full shadow-who-card transition-colors group-hover:border-who-primary-blue">
                <CardContent className="flex h-full items-start gap-4 p-6">
                  {/* --who-accent-subtle, not --who-page-bg: page-bg is the
                      canvas, which sits BELOW --who-surface in dark, so a chip
                      painted with it reads as a hole punched in the card rather
                      than a badge on it. accent-subtle is a tint of the surface
                      and stays above it in both themes.
                      --who-primary-blue, not --who-sidebar: the sidebar token is
                      a surface (#203350 in dark), so using it as an icon colour
                      measured 1.44:1 there. See the content-vs-surface table in
                      CLAUDE.md. */}
                  <span className="flex size-10 shrink-0 items-center justify-center rounded bg-who-accent-subtle text-who-primary-blue">
                    {Icon ? <Icon className="size-5" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[length:var(--text-body-lg)] font-semibold text-who-heading">
                        {r.label}
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-who-icon transition-colors group-hover:text-who-primary-blue" />
                    </span>
                    {/* Only surface the permission when it constrains the user.
                        Administrators have full access everywhere, so labelling
                        their tiles "Create Predefined" would just leak internal
                        vocabulary into the UI. */}
                    {accessNote(level) ? (
                      <span className="mt-1 block text-[length:var(--text-meta)] text-who-text-muted">
                        {accessNote(level)}
                      </span>
                    ) : null}
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
