/**
 * Application home — module tiles (UC002) and the dashboard (UC003, UC003.1).
 *
 * UC002: *"access all modules I have access to from the application home
 * site."* The tiles are derived from `ROUTES` and filtered by permission, so a
 * regular user sees a different set from an administrator without a second
 * list to maintain.
 *
 * UC003 leaves the dashboard's contents *"to be defined during the initiation
 * phase"*, so each panel here has to justify itself. These five answer the
 * questions a reporting round actually generates — who has reported, what is
 * waiting to be published, what the checks are complaining about, who is late,
 * and where the series are thin — and every number is a live query, not a
 * seeded summary.
 *
 * **UC003.1** is the admin/regular split. It is not a different layout: an
 * administrator gets the directory and the integration health, a regular user
 * gets their own countries and their own work. Same panels, different
 * questions, which is what "role-specific dashboard" means when both roles do
 * the same job on different scopes.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Users as UsersIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/routes'
import { DEMO_NOW } from '@/domain/constants'
import { canView, type PermissionLevel } from '@/domain/permissions'
import {
  completenessGrid,
  dueSoon,
  publicationSummary,
  reportingCycle,
  submissionSummary,
} from '@/domain/home'
import { summariseDirectory } from '@/domain/users'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { usePermissions } from '@/hooks/usePermissions'
import {
  DASHBOARD_COUNTRIES,
  DASHBOARD_HF_LEAVES,
  DASHBOARD_YEARS,
  useDashboardObservations,
} from '@/hooks/useDashboardData'
import { useImportBatches, useReportingContacts, useUsers } from '@/hooks/useSetupData'
import { useAuthStore } from '@/stores/authStore'
import { useQcStore } from '@/stores/qcStore'
import { mergedDirectory, useUserStore } from '@/stores/userStore'
import { CompletenessHeatmap } from './CompletenessHeatmap'

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

function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'warn' | 'fail' | 'pass'
}) {
  const toneClass =
    tone === 'warn'
      ? 'text-who-warn'
      : tone === 'fail'
        ? 'text-who-fail'
        : tone === 'pass'
          ? 'text-who-pass'
          : 'text-who-heading'
  return (
    <div>
      <p className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
        {label}
      </p>
      <p className={`mt-1 text-[length:var(--text-h4)] font-bold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {hint ? <p className="text-[length:var(--text-meta)] text-who-hint">{hint}</p> : null}
    </div>
  )
}

export function HomePage() {
  const { isAdmin } = usePermissions()
  const user = useAuthStore((s) => s.user)
  const permissions = useAuthStore((s) => s.permissions())

  const { data: contacts } = useReportingContacts()
  const { data: observations, isLoading: loadingObs } = useDashboardObservations()
  const { data: batches } = useImportBatches(DASHBOARD_COUNTRIES)
  const { data: directory } = useUsers()
  const userEdits = useUserStore((s) => s.edits)
  const runs = useQcStore((s) => s.runs)

  const tiles = ROUTES.filter(
    (r) =>
      r.nav &&
      r.path !== '/' &&
      canView(permissions[r.module]) &&
      !(r.adminOnly && user?.role !== 'administrator'),
  )

  const cycle = useMemo(() => reportingCycle(contacts ?? []), [contacts])
  const upcoming = useMemo(() => dueSoon(contacts ?? [], DEMO_NOW, 45).slice(0, 6), [contacts])
  const publication = useMemo(
    () => publicationSummary(observations?.rows ?? []),
    [observations],
  )
  const submissions = useMemo(() => submissionSummary(batches ?? []), [batches])
  const grid = useMemo(
    () =>
      completenessGrid(
        observations?.rows ?? [],
        DASHBOARD_COUNTRIES,
        DASHBOARD_YEARS,
        DASHBOARD_HF_LEAVES.length,
      ),
    [observations],
  )
  const people = useMemo(
    () => summariseDirectory(mergedDirectory(directory ?? [], userEdits)),
    [directory, userEdits],
  )

  // Quality: the persisted run history, not live findings. Findings live in
  // memory for the session (qcStore's own trade-off), so a dashboard that
  // counted them would read zero after every reload and look broken.
  const latestRun = runs[0]
  const openErrors = runs.reduce((sum, r) => sum + r.summary.errors, 0)
  const openWarnings = runs.reduce((sum, r) => sum + r.summary.warnings, 0)

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.displayName.split(' ')[0] ?? ''}`}
        description={
          isAdmin
            ? 'Administrator access to all modules and all countries. The panels below cover the whole reporting round.'
            : 'Regular user access. Modules you cannot edit remain available in view and export mode (UC007).'
        }
      />

      {/* ---- Reporting round ------------------------------------------- */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-who-card lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
                Reporting round
              </h3>
              <Badge variant="secondary">UC023</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <Metric
                label="Responded"
                value={cycle.received}
                hint={`${Math.round(cycle.percentReceived)}% of those asked`}
                tone="pass"
              />
              <Metric label="Awaiting" value={cycle.awaiting} hint="Request sent" />
              <Metric
                label="Overdue"
                value={cycle.overdue}
                hint="Past the agreed date"
                tone="fail"
              />
              <Metric
                label="Not in round"
                value={cycle.notRequested}
                hint="Excluded from the percentage"
              />
            </div>

            <Progress value={cycle.percentReceived} className="mt-4" />
            <p className="mt-2 text-[length:var(--text-meta)] text-who-text-muted">
              The percentage counts only the {cycle.received + cycle.awaiting + cycle.overdue}{' '}
              countries actually asked — a country outside the round has not failed to respond.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
                Due soon
              </h3>
              <CalendarClock className="size-4 text-who-icon" aria-hidden />
            </div>
            {upcoming.length === 0 ? (
              <p className="text-[length:var(--text-body-sm)] text-who-text-muted">
                Nothing falls due in the next 45 days.
              </p>
            ) : (
              <ul className="list-none space-y-1.5">
                {upcoming.map(({ contact, daysOffset }) => (
                  <li key={contact.iso3} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[length:var(--text-body-sm)] text-who-text">
                      {COUNTRY_BY_ISO3.get(contact.iso3)?.NAME_SHORT_EN ?? contact.iso3}
                    </span>
                    <span
                      className={`shrink-0 text-[length:var(--text-meta)] tabular-nums ${
                        daysOffset < 0 ? 'text-who-fail' : 'text-who-text-muted'
                      }`}
                    >
                      {daysOffset < 0 ? `${-daysOffset}d overdue` : `in ${daysOffset}d`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" asChild className="mt-3 px-0">
              <Link to="/setup?tab=reporting">
                Open the follow-up log
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---- Publication, quality, submissions, people ------------------ */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <FileSpreadsheet className="mb-2 size-5 text-who-primary-blue" aria-hidden />
            {loadingObs ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <Metric
                label="Ready to publish"
                value={publication.readyToPublish.toLocaleString()}
                hint={`of ${publication.total.toLocaleString()} in the demo scope (UC024)`}
              />
            )}
            <p className="mt-2 text-[length:var(--text-meta)] text-who-hint">
              {publication.metadataOnly.toLocaleString()} carry metadata but no figure — valid
              observations, not gaps.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <AlertTriangle className="mb-2 size-5 text-who-warn" aria-hidden />
            {runs.length === 0 ? (
              <>
                <Metric label="Quality findings" value="—" hint="No checks run this session" />
                <Button variant="ghost" size="sm" asChild className="mt-2 px-0">
                  <Link to="/quality-checks">
                    Run the delivered set
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Metric
                  label="Errors"
                  value={openErrors.toLocaleString()}
                  hint={`${openWarnings.toLocaleString()} warnings across ${runs.length} run${runs.length === 1 ? '' : 's'}`}
                  tone={openErrors > 0 ? 'fail' : 'pass'}
                />
                <Button variant="ghost" size="sm" asChild className="mt-2 px-0">
                  <Link to={`/quality-checks/reports/${latestRun?.summary.id ?? ''}`}>
                    Latest report
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <Database className="mb-2 size-5 text-who-primary-blue" aria-hidden />
            <Metric
              label="Rows received"
              value={submissions.rows.toLocaleString()}
              hint={`${submissions.batches} batches · ${submissions.failed} failed`}
              tone={submissions.failed > 0 ? 'warn' : 'default'}
            />
            <p className="mt-2 text-[length:var(--text-meta)] text-who-hint">
              {submissions.byFormat[0]
                ? `Mostly ${submissions.byFormat[0].format}`
                : 'No submissions in scope'}
            </p>
          </CardContent>
        </Card>

        {/* UC003.1 — the one panel that differs by role. */}
        {isAdmin ? (
          <Card className="shadow-who-card">
            <CardContent className="p-5">
              <UsersIcon className="mb-2 size-5 text-who-primary-blue" aria-hidden />
              <Metric
                label="Users with access"
                value={people.enabled}
                hint={`${people.administrators} administrators · ${people.guests} guests`}
              />
              <Button variant="ghost" size="sm" asChild className="mt-2 px-0">
                <Link to="/users">
                  Manage access
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-who-card">
            <CardContent className="p-5">
              <CheckCircle2 className="mb-2 size-5 text-who-primary-blue" aria-hidden />
              <Metric
                label="Your country access"
                value={
                  user?.restrictedCountries.length
                    ? `${194 - user.restrictedCountries.length} editable`
                    : 'All countries'
                }
                hint="View and export are never restricted (UC007)"
              />
              <Button variant="ghost" size="sm" asChild className="mt-2 px-0">
                <Link to="/workbooks">
                  Open a workbook
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---- Completeness ----------------------------------------------- */}
      <Card className="mb-6 shadow-who-card">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
                Data completeness
              </h3>
              <p className="text-[length:var(--text-body-sm)] text-who-text-muted">
                Reported financing schemes per country-year — the eleven HF leaves countries send,
                not the totals DMS calculates from them.
              </p>
            </div>
            <Badge variant="secondary">UC003</Badge>
          </div>
          {loadingObs ? <Skeleton className="h-56 w-full" /> : <CompletenessHeatmap grid={grid} />}
        </CardContent>
      </Card>

      {/* ---- Modules ---------------------------------------------------- */}
      <h3 className="mb-3 text-[length:var(--text-h5)] font-semibold text-who-heading">Modules</h3>

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
