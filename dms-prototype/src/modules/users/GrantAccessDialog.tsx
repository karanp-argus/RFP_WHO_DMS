/**
 * UC005 — *"grant access to a new user, so that they can use the DMS."*
 *
 * The form is one field long until the address is typed, because the address
 * decides everything else: `@who.int` is an internal WHO account and the role
 * select opens; anything else is an Entra ID guest, and UC007 fixes guests to
 * Regular User with the control disabled and the reason on screen. A greyed
 * control with no explanation reads as a bug rather than a rule.
 */

import { useMemo, useState } from 'react'
import { Info, ShieldCheck, UserPlus } from 'lucide-react'
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
import { CountryPicker } from '@/components/common/CountryPicker'
import { DEMO_NOW } from '@/domain/constants'
import type { Role } from '@/domain/permissions'
import type { DmsUser } from '@/domain/types'
import { emailProblem, grantAccess, isInternalEmail } from '@/domain/users'

export function GrantAccessDialog({
  open,
  onOpenChange,
  directory,
  onGranted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  directory: readonly DmsUser[]
  onGranted: (user: DmsUser) => void
}) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState<Role>('regular')
  const [restricted, setRestricted] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)

  const typed = email.trim() !== ''
  const isGuest = typed && !isInternalEmail(email)
  const shapeProblem = typed ? emailProblem(email) : null

  const effectiveRole: Role = isGuest ? 'regular' : role

  const preview = useMemo(
    () =>
      isGuest
        ? 'External address — this person will be invited as a guest in the WHO Entra ID and can only be a Regular User (UC007).'
        : typed
          ? 'WHO internal address — signs in with their existing WHO account through single sign-on (UC006).'
          : 'Type the address DMS should grant access to. WHO staff sign in with their own account; anyone else is invited as an Entra ID guest.',
    [isGuest, typed],
  )

  function reset() {
    setEmail('')
    setDisplayName('')
    setJobTitle('')
    setRole('regular')
    setRestricted([])
    setProblem(null)
  }

  function submit() {
    const outcome = grantAccess(
      { email, displayName, jobTitle, role: effectiveRole, restrictedCountries: restricted },
      directory,
      new Date(DEMO_NOW.getTime()).toISOString(),
    )
    if (!outcome.ok) {
      setProblem(outcome.problem)
      return
    }
    onGranted(outcome.user)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Grant access</DialogTitle>
          <DialogDescription>
            DMS does not create identities — WHO Entra ID does. This grants an address access and
            records the role it holds inside DMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="grant-email">Email address</Label>
            <Input
              id="grant-email"
              type="email"
              value={email}
              autoComplete="off"
              placeholder="name@who.int"
              onChange={(e) => {
                setEmail(e.target.value)
                setProblem(null)
              }}
            />
            <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {preview}
            </p>
            {shapeProblem ? (
              <p className="text-[length:var(--text-meta)] text-who-fail">{shapeProblem}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="grant-name">Display name</Label>
              <Input
                id="grant-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional — defaults to the address"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-title">Job title</Label>
              <Input
                id="grant-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Technical Officer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-role">Role</Label>
            <Select
              value={effectiveRole}
              onValueChange={(v) => setRole(v as Role)}
              disabled={isGuest}
            >
              <SelectTrigger id="grant-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular user</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
            {isGuest ? (
              <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                UC007 — external guests are always Regular Users. The control is disabled rather
                than hidden so the rule is visible.
              </p>
            ) : null}
          </div>

          {effectiveRole === 'regular' ? (
            <div className="space-y-1.5">
              <Label>Countries this user may not edit (UC009)</Label>
              <CountryPicker
                selected={restricted}
                onChange={setRestricted}
                placeholder="No restriction — every country is editable"
                ariaLabel="Countries this user may not edit"
              />
              <p className="text-[length:var(--text-meta)] text-who-text-muted">
                They keep view and export on every country regardless — UC007 guarantees it.
              </p>
            </div>
          ) : null}

          {problem ? (
            <p className="rounded border border-who-fail/40 bg-who-fail/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-fail">
              {problem}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!typed || shapeProblem != null} className="gap-1.5">
            <UserPlus className="size-4" />
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
