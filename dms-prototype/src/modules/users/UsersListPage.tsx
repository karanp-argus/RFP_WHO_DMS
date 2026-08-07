/**
 * The Users module (UC004).
 *
 * *"As an administrator, I need DMS to have a Users module, so that I can
 * manage the users that have access to the application."*
 *
 * Built on the reference's account-management table almost verbatim (plan
 * §2.2.3): a composite identity cell, an inline active switch, an inline role
 * select and a trailing `⋮` for row actions. **There is no delete action
 * anywhere on this page** — not disabled, not hidden behind a confirmation.
 * UC012 says a user is disabled and retained so log references survive, and
 * the domain layer has no function that could remove one.
 *
 * A regular user sees the same list read-only and keeps Export CSV, per UC007.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreVertical, RotateCcw, ShieldCheck, SlidersHorizontal, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { DEMO_NOW } from '@/domain/constants'
import type { Role } from '@/domain/permissions'
import type { DmsUser } from '@/domain/types'
import {
  applyUserChange,
  disableProblem,
  roleChangeProblem,
  sortDirectory,
  summariseDirectory,
} from '@/domain/users'
import { useUsers } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'
import { downloadCsv } from '@/lib/exporters'
import { isUserModified, mergedDirectory, useUserStore } from '@/stores/userStore'
import { cn } from '@/lib/utils'
import { GrantAccessDialog } from './GrantAccessDialog'
import { UserAccessDialog } from './UserAccessDialog'

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Whole days between two instants, both floored to UTC midnight. */
function daysAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const days = Math.round((DEMO_NOW.getTime() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}

export function UsersListPage() {
  const { canEdit, user: signedIn } = usePermissions()
  const { data, isLoading } = useUsers()
  const edits = useUserStore((s) => s.edits)
  const saveUser = useUserStore((s) => s.saveUser)
  const resetUser = useUserStore((s) => s.resetUser)

  const [granting, setGranting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const mayManage = canEdit('users')

  const directory = useMemo(
    () => sortDirectory(mergedDirectory(data ?? [], edits)),
    [data, edits],
  )
  const summary = useMemo(() => summariseDirectory(directory), [directory])
  const editingUser = directory.find((u) => u.id === editing) ?? null

  /** Run an inline change through the domain, surfacing any refusal. */
  function change(id: string, c: Parameters<typeof applyUserChange>[2]) {
    const outcome = applyUserChange(directory, id, c)
    if (!outcome.ok) {
      // The refusal is an inline alert, not a toast: UC010's last-administrator
      // guard is a *rule about the directory*, and it has to stay on screen next
      // to the control that tried to break it rather than fade after four
      // seconds.
      setProblem(outcome.problem)
      return
    }
    setProblem(null)
    saveUser(outcome.user)
    // The success does toast. An inline select changing from "Administrator" to
    // "Regular user" is a two-word visual change in a table of thirty rows, and
    // it is the change that decides what that person can do.
    const u = outcome.user
    toast.success(
      c.kind === 'role'
        ? `${u.displayName} is now ${u.role === 'administrator' ? 'an administrator' : 'a regular user'}.`
        : c.kind === 'enable'
          ? `${u.displayName} re-enabled.`
          : c.kind === 'disable'
            ? `${u.displayName} disabled — the account is retained, per UC012.`
            : c.kind === 'countries'
              ? `Country access updated for ${u.displayName}.`
              : `${u.displayName} updated.`,
    )
  }

  const columns = useMemo<ColumnDef<DmsUser, unknown>[]>(
    () => [
      {
        id: 'identity',
        header: 'User',
        accessorFn: (u) => `${u.displayName} ${u.email}`,
        cell: ({ row }) => {
          const u = row.original
          return (
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-[length:var(--text-meta)] font-semibold',
                  u.isEnabled
                    ? 'bg-who-sidebar text-who-on-brand'
                    : // A disabled account must be legible at a glance in a list
                      // of thirty — the row is not removed, so the avatar carries
                      // the state too.
                      'bg-who-page-bg text-who-text-muted',
                )}
                aria-hidden
              >
                {initials(u.displayName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-who-heading">
                  {u.displayName}
                  {u.id === signedIn?.id ? (
                    <span className="ml-1.5 text-[length:var(--text-meta)] font-normal text-who-text-muted">
                      (you)
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[length:var(--text-meta)] text-who-text-muted">
                  {u.email}
                </span>
              </span>
            </span>
          )
        },
      },
      {
        id: 'jobTitle',
        header: 'Job title',
        accessorFn: (u) => u.jobTitle,
      },
      {
        id: 'account',
        header: 'Account',
        accessorFn: (u) => (u.isGuest ? 'Entra ID guest' : 'WHO internal'),
        cell: ({ row }) =>
          row.original.isGuest ? (
            <Badge variant="secondary">Entra ID guest</Badge>
          ) : (
            <span className="text-who-text-muted">WHO internal</span>
          ),
      },
      {
        id: 'role',
        header: 'Role',
        accessorFn: (u) => u.role,
        cell: ({ row }) => {
          const u = row.original
          const locked = roleChangeProblem(u)
          if (!mayManage) {
            return <span>{u.role === 'administrator' ? 'Administrator' : 'Regular user'}</span>
          }
          const control = (
            <Select
              value={u.role}
              disabled={locked != null}
              onValueChange={(v) => change(u.id, { kind: 'role', role: v as Role })}
            >
              <SelectTrigger size="sm" className="w-[150px]" aria-label={`Role for ${u.displayName}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular user</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
          )
          return locked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">{control}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">{locked}</TooltipContent>
            </Tooltip>
          ) : (
            control
          )
        },
      },
      {
        id: 'countries',
        header: 'Country access',
        accessorFn: (u) => u.restrictedCountries.length,
        cell: ({ row }) => {
          const n = row.original.restrictedCountries.length
          return n === 0 ? (
            <span className="text-who-text-muted">All countries</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted">
                  {n} restricted
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                Cannot edit: {row.original.restrictedCountries.join(', ')}. View and export remain
                available on all countries (UC007).
              </TooltipContent>
            </Tooltip>
          )
        },
      },
      {
        id: 'lastSeen',
        header: 'Last seen',
        accessorFn: (u) => u.lastSeenUtc ?? '',
        cell: ({ row }) => (
          <span className="text-who-text-muted">{daysAgo(row.original.lastSeenUtc)}</span>
        ),
      },
      {
        id: 'enabled',
        header: 'Active',
        accessorFn: (u) => (u.isEnabled ? 'Active' : 'Disabled'),
        cell: ({ row }) => {
          const u = row.original
          if (!mayManage) {
            return u.isEnabled ? (
              <span className="text-who-pass">Active</span>
            ) : (
              <span className="text-who-text-muted">Disabled</span>
            )
          }
          const blocked = u.isEnabled ? disableProblem(directory, u) : null
          const control = (
            <Switch
              checked={u.isEnabled}
              disabled={blocked != null}
              aria-label={`${u.isEnabled ? 'Disable' : 'Enable'} ${u.displayName}`}
              onCheckedChange={(v) => change(u.id, { kind: v ? 'enable' : 'disable' })}
            />
          )
          return blocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">{control}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">{blocked}</TooltipContent>
            </Tooltip>
          ) : (
            control
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original
          const modified = isUserModified(u.id, edits)
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Actions for ${u.displayName}`}
                  className="px-2"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setEditing(u.id)}>
                  {mayManage ? 'Edit access' : 'View access'}
                </DropdownMenuItem>
                {mayManage ? (
                  <DropdownMenuItem
                    disabled={u.isEnabled && disableProblem(directory, u) != null}
                    onSelect={() => change(u.id, { kind: u.isEnabled ? 'disable' : 'enable' })}
                  >
                    {u.isEnabled ? 'Disable account (UC010)' : 'Enable account (UC011)'}
                  </DropdownMenuItem>
                ) : null}
                {mayManage && modified ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => resetUser(u.id)}>
                      <RotateCcw className="size-4" />
                      Discard local changes
                    </DropdownMenuItem>
                  </>
                ) : null}
                {/* No delete item. UC012 — see the file header. */}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    // `change` and `directory` are recreated each render by design; the memo
    // only needs to re-run when what the cells display actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mayManage, directory, edits, signedIn?.id],
  )

  return (
    <>
      <PageHeader
        title="Users"
        description={
          mayManage
            ? 'Grant access by email, assign roles and enable or disable accounts. Users are never deleted — a disabled account keeps every log reference intact (UC012).'
            : 'Who has access to DMS and at what level. Your permission level on this module is view and export (UC007).'
        }
        actions={
          <>
            <Button variant="outline" asChild className="gap-1.5">
              <Link to="/users/role-permissions">
                <SlidersHorizontal className="size-4" />
                Role permissions
              </Link>
            </Button>
            {mayManage ? (
              <Button className="gap-1.5" onClick={() => setGranting(true)}>
                <UserPlus className="size-4" />
                Grant access
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Users with access', value: summary.enabled, hint: `${summary.disabled} disabled` },
          {
            label: 'Administrators',
            value: summary.administrators,
            hint: 'At least one must stay enabled (UC010)',
          },
          { label: 'Entra ID guests', value: summary.guests, hint: 'Always regular users (UC007)' },
          {
            label: 'Country-restricted',
            value: summary.countryRestricted,
            hint: 'Edit limited by UC009',
          },
        ].map((tile) => (
          <Card key={tile.label} className="shadow-who-card">
            <CardContent className="p-4">
              <p className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                {tile.label}
              </p>
              <p className="mt-1 text-[length:var(--text-h4)] font-bold text-who-heading tabular-nums">
                {tile.value}
              </p>
              <p className="mt-0.5 text-[length:var(--text-meta)] text-who-hint">{tile.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {problem ? (
        <p
          role="alert"
          className="mb-3 rounded border border-who-fail/40 bg-who-fail/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-fail"
        >
          {problem}
        </p>
      ) : null}

      {!mayManage ? (
        <p className="mb-3 flex items-start gap-2 rounded border border-who-border bg-who-surface px-3 py-2 text-[length:var(--text-body-sm)] text-who-text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Read-only. Export stays available on every module a regular user cannot edit (UC007) —
          change the Users level on the Role permissions page to see the controls appear.
        </p>
      ) : null}

      <DataTable
        data={directory}
        columns={columns}
        getRowId={(u) => u.id}
        searchPlaceholder="Search name, email or job title"
        pageSize={10}
        emptyMessage={isLoading ? 'Loading the directory from xMart…' : 'No users match.'}
        onExport={(rows) =>
          downloadCsv(
            rows.map((u) => ({
              Email: u.email,
              Name: u.displayName,
              'Job title': u.jobTitle,
              Role: u.role,
              Account: u.isGuest ? 'Entra ID guest' : 'WHO internal',
              Status: u.isEnabled ? 'Active' : 'Disabled',
              'Restricted countries': u.restrictedCountries.join(' '),
              'Last seen (UTC)': u.lastSeenUtc ?? '',
              'Created (UTC)': u.createdUtc,
            })),
            [
              'Email',
              'Name',
              'Job title',
              'Role',
              'Account',
              'Status',
              'Restricted countries',
              'Last seen (UTC)',
              'Created (UTC)',
            ],
            'dms-users',
          )
        }
      />

      <GrantAccessDialog
        open={granting}
        onOpenChange={setGranting}
        directory={directory}
        onGranted={saveUser}
      />

      <UserAccessDialog
        user={editingUser}
        directory={directory}
        isModified={editingUser ? isUserModified(editingUser.id, edits) : false}
        onClose={() => setEditing(null)}
        onSave={saveUser}
        onReset={resetUser}
      />
    </>
  )
}
