/**
 * Edit one user's access (UC007, UC009, UC010, UC012).
 *
 * Every refusal here comes from `domain/users/access.ts` and is shown as the
 * sentence the domain returned, not paraphrased. That matters for the
 * last-administrator guard in particular: "Save failed" tells an administrator
 * nothing, and the correct next action — grant or enable another
 * administrator — is in the domain's own message.
 */

import { useEffect, useState } from 'react'
import { Ban, RotateCcw, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CountryPicker } from '@/components/common/CountryPicker'
import type { Role } from '@/domain/permissions'
import type { DmsUser } from '@/domain/types'
import { applyUserChange, disableProblem, roleChangeProblem } from '@/domain/users'

export function UserAccessDialog({
  user,
  directory,
  isModified,
  onClose,
  onSave,
  onReset,
}: {
  user: DmsUser | null
  directory: readonly DmsUser[]
  isModified: boolean
  onClose: () => void
  onSave: (user: DmsUser) => void
  onReset: (id: string) => void
}) {
  const [draft, setDraft] = useState<DmsUser | null>(user)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    setDraft(user)
    setProblem(null)
  }, [user])

  if (!user || !draft) return null

  const guestProblem = roleChangeProblem(user)
  const cannotDisable = disableProblem(directory, user)

  /**
   * Run a change through the domain against the *saved* directory, then fold
   * the accepted result into the draft.
   *
   * Validating against the draft instead would let two changes that are each
   * legal in isolation combine into an illegal state — demote the last
   * administrator and disable them in the same dialog, for instance.
   */
  // An arrow rather than a function declaration: declarations are hoisted, so
  // TypeScript drops the `if (!user || !draft) return null` narrowing inside
  // one and `user.id` becomes possibly-null again.
  const change = (...changes: Parameters<typeof applyUserChange>[2][]) => {
    let next = draft
    for (const c of changes) {
      const outcome = applyUserChange(directory, user.id, c)
      if (!outcome.ok) {
        setProblem(outcome.problem)
        return
      }
      next = { ...next, ...outcome.user }
    }
    setProblem(null)
    setDraft(next)
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {user.displayName}
            {user.isGuest ? <Badge variant="secondary">Entra ID guest</Badge> : null}
            {!user.isEnabled ? <Badge variant="destructive">Disabled</Badge> : null}
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-name">Display name</Label>
              <Input
                id="user-name"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-title">Job title</Label>
              <Input
                id="user-title"
                value={draft.jobTitle}
                onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => change({ kind: 'role', role: v as Role })}
              disabled={guestProblem != null}
            >
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular user</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
            {guestProblem ? (
              <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {guestProblem}
              </p>
            ) : null}
          </div>

          {draft.role === 'regular' ? (
            <div className="space-y-1.5">
              <Label>Countries this user may not edit (UC009)</Label>
              <CountryPicker
                selected={draft.restrictedCountries}
                onChange={(iso3s) => change({ kind: 'countries', restrictedCountries: iso3s })}
                placeholder="No restriction — every country is editable"
                ariaLabel="Countries this user may not edit"
              />
            </div>
          ) : (
            <p className="text-[length:var(--text-body-sm)] text-who-text-muted">
              Administrators have access to every country, so there is nothing to restrict (UC007).
            </p>
          )}

          <div className="rounded border border-who-border p-3">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                  Account enabled
                </span>
                <span className="mt-0.5 block text-[length:var(--text-meta)] text-who-text-muted">
                  Users are never deleted (UC012) — a disabled account keeps every log reference,
                  authored rule and version stamp pointing at a real person.
                </span>
              </span>
              <Switch
                checked={draft.isEnabled}
                aria-label="Account enabled"
                disabled={draft.isEnabled && cannotDisable != null}
                onCheckedChange={(v) => change({ kind: v ? 'enable' : 'disable' })}
              />
            </label>
            {draft.isEnabled && cannotDisable ? (
              <p className="mt-2 flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-warn">
                <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {cannotDisable}
              </p>
            ) : null}
          </div>

          {problem ? (
            <p className="rounded border border-who-fail/40 bg-who-fail/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-fail">
              {problem}
            </p>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {isModified ? (
            <Button
              variant="ghost"
              className="gap-1.5"
              onClick={() => {
                onReset(user.id)
                onClose()
              }}
            >
              <RotateCcw className="size-4" />
              Discard local changes
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(draft)
                onClose()
              }}
            >
              Save
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
