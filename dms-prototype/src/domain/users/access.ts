/**
 * User administration rules (UC005, UC007, UC009, UC010, UC011, UC012).
 *
 * Pure: takes the directory as an argument and returns either the changed user
 * or a stated reason it refused. The store applies the result; nothing here
 * knows a store exists.
 *
 * **There is deliberately no `deleteUser` in this module, and there never
 * should be.** UC012: *"As an administrator, I need to be able to disable a
 * user, so that any log references will be kept and there is no impact on
 * data."* Every observation carries `Sys_FirstLoadUser`, every version carries
 * an author and every QC rule and report carries `createdBy` — all of them
 * plain email strings pointing at rows in this directory. Removing a user
 * turns those into dangling references, which is exactly what the use case is
 * written to prevent. Making the absence structural rather than a disabled
 * button means a later screen cannot reintroduce it by accident.
 */

import type { DmsUser } from '@/domain/types'
import type { Role } from '@/domain/permissions'

/**
 * Domains treated as WHO-internal.
 *
 * Everyone else is an Entra ID **guest**: UC005 distinguishes *"internal WHO
 * users"* from *"external users that will be guests in the WHO Entra ID"*, and
 * UC007 fixes guests to Regular User. The subdomain form (`euro.who.int`) is
 * matched too — WHO regional offices use them and a regional analyst is not an
 * external consultant.
 */
export const WHO_INTERNAL_DOMAINS = ['who.int'] as const

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function emailDomain(email: string): string {
  const at = normaliseEmail(email).lastIndexOf('@')
  return at < 0 ? '' : normaliseEmail(email).slice(at + 1)
}

export function isInternalEmail(email: string): boolean {
  const domain = emailDomain(email)
  return WHO_INTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

/**
 * Deliberately permissive: one `@`, something either side, a dot in the domain.
 *
 * A stricter regex would reject addresses that are legal and in use, and this
 * form is not the system of record — Entra ID is. DMS grants access to an
 * address; the invitation either resolves there or it does not.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailProblem(email: string): string | null {
  const value = normaliseEmail(email)
  if (value === '') return 'Enter an email address.'
  if (!EMAIL_SHAPE.test(value)) return 'That does not look like an email address.'
  return null
}

/* ==========================================================================
   Granting access (UC005)
   ========================================================================== */

export interface GrantRequest {
  email: string
  displayName: string
  jobTitle: string
  /** Ignored for guests — UC007 fixes them to Regular User. */
  role: Role
  /** UC009 — countries this user may not edit. Empty means all are editable. */
  restrictedCountries?: readonly string[]
}

export type UserOutcome =
  | { ok: true; user: DmsUser }
  | { ok: false; problem: string }

/**
 * Build the directory entry for a newly granted user.
 *
 * The real flow is an Entra ID invitation; DMS holds only the role mapping
 * (see `XMartClient.getUsers`). So this validates and shapes the record — it
 * does not pretend to have created an identity.
 */
export function grantAccess(
  request: GrantRequest,
  directory: readonly DmsUser[],
  nowUtc: string,
): UserOutcome {
  const email = normaliseEmail(request.email)
  const problem = emailProblem(email)
  if (problem) return { ok: false, problem }

  const existing = directory.find((u) => normaliseEmail(u.email) === email)
  if (existing) {
    return {
      ok: false,
      problem: existing.isEnabled
        ? `${existing.displayName} already has access.`
        : `${existing.displayName} already exists but is disabled. Enable the account instead — users are never recreated (UC012).`,
    }
  }

  const isGuest = !isInternalEmail(email)
  const displayName = request.displayName.trim()

  return {
    ok: true,
    user: {
      // Derived from the address rather than a counter: two grants of the same
      // address in one session must collide, not create a second row.
      id: `u-${email.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      email,
      displayName: displayName === '' ? email : displayName,
      jobTitle: request.jobTitle.trim(),
      // UC007: "external users ... will always be regular users". Not a default
      // the caller can override — the caller's `role` is discarded for guests.
      role: isGuest ? 'regular' : request.role,
      isGuest,
      isEnabled: true,
      restrictedCountries: [...(request.restrictedCountries ?? [])],
      // Never signed in yet. `null` rather than the grant date, so the Users
      // list can say "never" instead of implying activity that has not happened.
      lastSeenUtc: null,
      createdUtc: nowUtc,
    },
  }
}

/* ==========================================================================
   Changing an existing user
   ========================================================================== */

export type UserChange =
  | { kind: 'enable' }
  | { kind: 'disable' }
  | { kind: 'role'; role: Role }
  | { kind: 'countries'; restrictedCountries: readonly string[] }
  | { kind: 'profile'; displayName: string; jobTitle: string }

export function enabledAdministrators(directory: readonly DmsUser[]): DmsUser[] {
  return directory.filter((u) => u.isEnabled && u.role === 'administrator')
}

/**
 * UC010's guard: *"there will always be a minimum of one enabled
 * Administrator"*.
 *
 * Note it covers **two** doors, not one. Disabling the last administrator is
 * the obvious one; demoting them to Regular User empties the role just as
 * completely and is the door a permission screen walks through by accident.
 */
export function isLastEnabledAdministrator(directory: readonly DmsUser[], id: string): boolean {
  const admins = enabledAdministrators(directory)
  return admins.length === 1 && admins[0]?.id === id
}

const LAST_ADMIN_PROBLEM =
  'This is the only enabled administrator. DMS must always have at least one (UC010) — grant or enable another administrator first.'

/**
 * UC007 — a guest's role is not editable, in the UI or anywhere else.
 *
 * Returned as a reason rather than a boolean so the dialog can *show* why the
 * control is disabled. A greyed-out select with no explanation reads as a bug.
 */
export function roleChangeProblem(user: DmsUser): string | null {
  if (user.isGuest) {
    return 'External guests are always Regular Users (UC007). Their role cannot be changed.'
  }
  return null
}

export function disableProblem(directory: readonly DmsUser[], user: DmsUser): string | null {
  if (!user.isEnabled) return 'This account is already disabled.'
  if (isLastEnabledAdministrator(directory, user.id)) return LAST_ADMIN_PROBLEM
  return null
}

/** Apply one change, or refuse it with a reason the UI can display verbatim. */
export function applyUserChange(
  directory: readonly DmsUser[],
  id: string,
  change: UserChange,
): UserOutcome {
  const user = directory.find((u) => u.id === id)
  if (!user) return { ok: false, problem: 'That user is no longer in the directory.' }

  switch (change.kind) {
    case 'enable':
      // UC011 — the counterpart to UC010, and the reason disable is not delete.
      return { ok: true, user: { ...user, isEnabled: true } }

    case 'disable': {
      const problem = disableProblem(directory, user)
      return problem ? { ok: false, problem } : { ok: true, user: { ...user, isEnabled: false } }
    }

    case 'role': {
      const guest = roleChangeProblem(user)
      if (guest) return { ok: false, problem: guest }
      if (
        change.role === 'regular' &&
        user.isEnabled &&
        isLastEnabledAdministrator(directory, user.id)
      ) {
        return { ok: false, problem: LAST_ADMIN_PROBLEM }
      }
      return { ok: true, user: { ...user, role: change.role } }
    }

    case 'countries': {
      // UC009 is about *regular* users. An administrator has access to every
      // country by definition (UC007), so a restriction on one would be state
      // that nothing reads — worse than refusing it, because it looks applied.
      if (user.role === 'administrator' && change.restrictedCountries.length > 0) {
        return {
          ok: false,
          problem:
            'Administrators have access to every country (UC007). Change the role to Regular User first.',
        }
      }
      return {
        ok: true,
        user: { ...user, restrictedCountries: [...new Set(change.restrictedCountries)].sort() },
      }
    }

    case 'profile':
      return {
        ok: true,
        user: {
          ...user,
          displayName: change.displayName.trim() || user.displayName,
          jobTitle: change.jobTitle.trim(),
        },
      }
  }
}

/* ==========================================================================
   Presentation helpers (still pure)
   ========================================================================== */

export type UserKind = 'internal-admin' | 'internal-regular' | 'guest'

export function userKind(user: DmsUser): UserKind {
  if (user.isGuest) return 'guest'
  return user.role === 'administrator' ? 'internal-admin' : 'internal-regular'
}

/** Counts for the module header — enabled/disabled/guests/administrators. */
export interface DirectorySummary {
  total: number
  enabled: number
  disabled: number
  administrators: number
  guests: number
  countryRestricted: number
}

export function summariseDirectory(directory: readonly DmsUser[]): DirectorySummary {
  return {
    total: directory.length,
    enabled: directory.filter((u) => u.isEnabled).length,
    disabled: directory.filter((u) => !u.isEnabled).length,
    administrators: directory.filter((u) => u.role === 'administrator').length,
    guests: directory.filter((u) => u.isGuest).length,
    countryRestricted: directory.filter((u) => u.restrictedCountries.length > 0).length,
  }
}

/** Sort for the list: enabled first, administrators before regular, then name. */
export function sortDirectory(directory: readonly DmsUser[]): DmsUser[] {
  return [...directory].sort((a, b) => {
    if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1
    if (a.role !== b.role) return a.role === 'administrator' ? -1 : 1
    return a.displayName.localeCompare(b.displayName)
  })
}
