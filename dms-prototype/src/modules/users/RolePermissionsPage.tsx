/**
 * UC008 — *"edit the permissions assigned to each role for each module, so
 * that I can decide the level of access."*
 *
 * Read-only with an Edit button, as the plan specifies, and the saved matrix is
 * the one `usePermissions` reads — not a copy of it. That is the whole demo
 * beat: drop Reports to *View*, switch to the regular user, and the New-report
 * button is gone, because the same value gates both.
 *
 * Only the **Regular user** column is editable. The administrator column is
 * fixed and says why: UC007 states there is no functionality available to a
 * regular user and not to an administrator, so an editable admin column could
 * express a matrix the FR forbids.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Minus, RotateCcw, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  ADMIN_PERMISSIONS,
  DEFAULT_REGULAR_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_LEVELS,
  type PermissionLevel,
  type PermissionMatrix,
} from '@/domain/permissions'
import {
  MODULE_PERMISSION_META,
  allowedLevels,
  capabilityPreview,
  describeLevel,
  matrixDiff,
  matrixProblems,
} from '@/domain/users'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

function Yes() {
  return <Check className="size-4 text-who-pass" aria-label="Yes" />
}

function No() {
  return <Minus className="size-4 text-who-icon" aria-label="No" />
}

export function RolePermissionsPage() {
  const { isAdmin } = usePermissions()
  const saved = useAuthStore((s) => s.regularPermissions)
  const setRegularPermissions = useAuthStore((s) => s.setRegularPermissions)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<PermissionMatrix>(saved)

  const active = editing ? draft : saved
  const problems = useMemo(() => matrixProblems(active), [active])
  const changes = useMemo(() => matrixDiff(saved, active), [saved, active])
  const preview = useMemo(() => capabilityPreview(active), [active])
  const isDefault = matrixDiff(DEFAULT_REGULAR_PERMISSIONS, saved).length === 0

  function startEditing() {
    setDraft(saved)
    setEditing(true)
  }

  return (
    <>
      <PageHeader
        title="Role permissions"
        description="The module × permission matrix from the Functional Requirements. What is saved here is what the application enforces — there is no second copy."
        actions={
          <>
            <Button variant="outline" asChild className="gap-1.5">
              <Link to="/users">
                <ArrowLeft className="size-4" />
                Back to users
              </Link>
            </Button>
            {!isAdmin ? null : editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={problems.length > 0}
                  onClick={() => {
                    setRegularPermissions(draft)
                    setEditing(false)
                  }}
                >
                  Save{changes.length > 0 ? ` (${changes.length})` : ''}
                </Button>
              </>
            ) : (
              <>
                {!isDefault ? (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setRegularPermissions(DEFAULT_REGULAR_PERMISSIONS)}
                  >
                    <RotateCcw className="size-4" />
                    Reset to delivered
                  </Button>
                ) : null}
                <Button onClick={startEditing}>Edit</Button>
              </>
            )}
          </>
        }
      />

      {!isAdmin ? (
        <p className="mb-4 flex items-start gap-2 rounded border border-who-border bg-who-surface px-3 py-2 text-[length:var(--text-body-sm)] text-who-text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Only administrators can change this matrix. You are seeing the levels that apply to you.
        </p>
      ) : null}

      <Card className="mb-5 shadow-who-card">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
            <thead className="border-b border-who-border">
              <tr>
                <th className="px-4 py-3 text-left text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase">
                  Module
                </th>
                <th className="px-4 py-3 text-left text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase">
                  Regular user
                </th>
                <th className="px-4 py-3 text-left text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase">
                  Administrator
                </th>
              </tr>
            </thead>
            <tbody>
              {MODULE_PERMISSION_META.map((meta) => {
                const level = active[meta.id]
                const changed = saved[meta.id] !== level
                const levels = allowedLevels(meta.id)
                return (
                  <tr
                    key={meta.id}
                    className={cn(
                      'border-b border-who-border/60 last:border-b-0',
                      changed && 'bg-who-accent-subtle',
                    )}
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="block font-semibold text-who-heading">{meta.label}</span>
                      <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                        {meta.summary}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {editing && levels.length > 1 ? (
                        <Select
                          value={level}
                          onValueChange={(v) =>
                            setDraft({ ...draft, [meta.id]: v as PermissionLevel })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-[230px]"
                            aria-label={`Regular user permission for ${meta.label}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {levels.map((l) => (
                              <SelectItem key={l} value={l}>
                                {PERMISSION_LABELS[l]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-semibold text-who-heading">
                          {PERMISSION_LABELS[level]}
                        </span>
                      )}
                      <span className="mt-1 block max-w-[380px] text-[length:var(--text-meta)] text-who-text-muted">
                        {describeLevel(meta.id, level)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-who-text">
                        {PERMISSION_LABELS[ADMIN_PERMISSIONS[meta.id]]}
                      </span>
                      <span className="mt-1 block text-[length:var(--text-meta)] text-who-hint">
                        Fixed — UC007
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {problems.length > 0 ? (
        <ul className="mb-5 list-none space-y-1">
          {problems.map((p) => (
            <li
              key={p.module}
              className="rounded border border-who-fail/40 bg-who-fail/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-fail"
            >
              {p.problem}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
              What a regular user can do
            </h3>
            <p className="mt-1 mb-3 text-[length:var(--text-body-sm)] text-who-text-muted">
              Computed the same way <code>usePermissions</code> computes it, so the preview cannot
              claim something the application then refuses.
            </p>
            <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
              <thead>
                <tr className="border-b border-who-border">
                  <th className="py-2 text-left text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                    Module
                  </th>
                  <th className="py-2 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                    View
                  </th>
                  <th className="py-2 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                    Edit
                  </th>
                  <th className="py-2 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                    Publish
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.module} className="border-b border-who-border/60 last:border-b-0">
                    <td className="py-2 text-who-text">{row.label}</td>
                    <td className="py-2 text-center">{row.canView ? <Yes /> : <No />}</td>
                    <td className="py-2 text-center">{row.canEdit ? <Yes /> : <No />}</td>
                    <td className="py-2 text-center">
                      {row.canCreatePredefined ? <Yes /> : <No />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
              The six levels (UC008)
            </h3>
            <p className="mt-1 mb-3 text-[length:var(--text-body-sm)] text-who-text-muted">
              Only the levels that mean something on a given module are offered there — “Edit
              Selected Countries” on Users is not a stricter permission, it is a meaningless one.
            </p>
            <ul className="list-none space-y-2">
              {PERMISSION_LEVELS.map((level) => {
                const modules = MODULE_PERMISSION_META.filter((m) => m.levels.includes(level))
                return (
                  <li key={level} className="flex flex-wrap items-baseline gap-2">
                    <Badge variant={level === 'no-access' ? 'outline' : 'secondary'}>
                      {PERMISSION_LABELS[level]}
                    </Badge>
                    <span className="text-[length:var(--text-meta)] text-who-text-muted">
                      {level === 'no-access'
                        ? 'Never offered to a regular user — UC007 guarantees view and export on every module.'
                        : modules.length === MODULE_PERMISSION_META.length
                          ? 'Available on every module.'
                          : `Available on ${modules.map((m) => m.label).join(', ')}.`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
