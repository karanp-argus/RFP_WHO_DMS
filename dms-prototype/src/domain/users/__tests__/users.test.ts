/**
 * Phase 7 — user administration and the UC008 matrix.
 *
 * The guards are the point of this suite. Every one of them is a rule the FR
 * states and a screen could plausibly break: a guest promoted to
 * administrator, the last administrator disabled or quietly demoted, a
 * country restriction hung on someone who has access to every country anyway,
 * and a permission matrix that can express "no access" for a role UC007
 * guarantees view and export to.
 */

import { describe, expect, it } from 'vitest'
import type { DmsUser } from '@/domain/types'
import {
  ADMIN_PERMISSIONS,
  DEFAULT_REGULAR_PERMISSIONS,
  MODULES,
  type PermissionMatrix,
} from '@/domain/permissions'
import {
  MODULE_PERMISSION_META,
  allowedLevels,
  applyUserChange,
  capabilityPreview,
  describeLevel,
  disableProblem,
  emailProblem,
  enabledAdministrators,
  grantAccess,
  isInternalEmail,
  isLastEnabledAdministrator,
  matrixDiff,
  matrixProblems,
  roleChangeProblem,
  sortDirectory,
  summariseDirectory,
} from '@/domain/users'

const NOW = '2026-08-01T09:00:00.000Z'

function user(partial: Partial<DmsUser> & Pick<DmsUser, 'id' | 'email'>): DmsUser {
  return {
    displayName: partial.email,
    jobTitle: 'Analyst',
    role: 'regular',
    isGuest: false,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: null,
    createdUtc: NOW,
    ...partial,
  }
}

const ADMIN_A = user({ id: 'a1', email: 'admin.one@who.int', role: 'administrator' })
const ADMIN_B = user({ id: 'a2', email: 'admin.two@who.int', role: 'administrator' })
const REGULAR = user({ id: 'r1', email: 'analyst@who.int' })
const GUEST = user({ id: 'g1', email: 'consultant@example.org', isGuest: true })
const DISABLED_ADMIN = user({
  id: 'a3',
  email: 'admin.three@who.int',
  role: 'administrator',
  isEnabled: false,
})

describe('email classification (UC005)', () => {
  it('treats who.int and its subdomains as internal', () => {
    expect(isInternalEmail('someone@who.int')).toBe(true)
    expect(isInternalEmail('analyst@euro.who.int')).toBe(true)
    expect(isInternalEmail('SOMEONE@WHO.INT')).toBe(true)
  })

  it('treats everything else as an Entra ID guest', () => {
    expect(isInternalEmail('consultant@example.org')).toBe(false)
    // Not a subdomain of who.int — the suffix check must not match on a
    // lookalike domain, which is exactly how this kind of test earns its keep.
    expect(isInternalEmail('attacker@notwho.int')).toBe(false)
  })

  it('rejects malformed addresses with a reason', () => {
    expect(emailProblem('')).toMatch(/Enter an email/)
    expect(emailProblem('not-an-email')).toMatch(/does not look like/)
    expect(emailProblem('fine@who.int')).toBeNull()
  })
})

describe('granting access (UC005, UC007)', () => {
  const directory = [ADMIN_A, REGULAR, GUEST]

  it('creates an internal user with the requested role', () => {
    const out = grantAccess(
      { email: 'New.Person@who.int', displayName: 'New Person', jobTitle: 'Economist', role: 'administrator' },
      directory,
      NOW,
    )
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.user.email).toBe('new.person@who.int')
    expect(out.user.isGuest).toBe(false)
    expect(out.user.role).toBe('administrator')
    expect(out.user.isEnabled).toBe(true)
    // Never signed in — the list must be able to say so.
    expect(out.user.lastSeenUtc).toBeNull()
  })

  it('forces a guest to Regular User even when administrator was asked for', () => {
    const out = grantAccess(
      { email: 'external@example.com', displayName: 'External', jobTitle: '', role: 'administrator' },
      directory,
      NOW,
    )
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.user.isGuest).toBe(true)
    expect(out.user.role).toBe('regular')
  })

  it('refuses a duplicate, and points a disabled duplicate at enable rather than recreate', () => {
    const dup = grantAccess(
      { email: 'ANALYST@who.int', displayName: 'Analyst', jobTitle: '', role: 'regular' },
      directory,
      NOW,
    )
    expect(dup.ok).toBe(false)
    if (dup.ok) return
    expect(dup.problem).toMatch(/already has access/)

    const disabled = grantAccess(
      { email: 'former@who.int', displayName: '', jobTitle: '', role: 'regular' },
      [...directory, user({ id: 'x', email: 'former@who.int', isEnabled: false })],
      NOW,
    )
    expect(disabled.ok).toBe(false)
    if (disabled.ok) return
    expect(disabled.problem).toMatch(/UC012/)
  })

  it('falls back to the address when no display name is given', () => {
    const out = grantAccess(
      { email: 'nameless@who.int', displayName: '   ', jobTitle: '', role: 'regular' },
      directory,
      NOW,
    )
    expect(out.ok && out.user.displayName).toBe('nameless@who.int')
  })
})

describe('the last-administrator guard (UC010)', () => {
  it('identifies the only enabled administrator, ignoring disabled ones', () => {
    const directory = [ADMIN_A, DISABLED_ADMIN, REGULAR]
    expect(enabledAdministrators(directory)).toHaveLength(1)
    expect(isLastEnabledAdministrator(directory, 'a1')).toBe(true)
    // A disabled administrator is not "the last enabled" one, whatever the
    // role column says.
    expect(isLastEnabledAdministrator(directory, 'a3')).toBe(false)
  })

  it('refuses to disable the last one', () => {
    const directory = [ADMIN_A, REGULAR]
    expect(disableProblem(directory, ADMIN_A)).toMatch(/only enabled administrator/)
    const out = applyUserChange(directory, 'a1', { kind: 'disable' })
    expect(out.ok).toBe(false)
  })

  it('closes the demotion door too — the role select empties the role just as well', () => {
    const directory = [ADMIN_A, REGULAR]
    const out = applyUserChange(directory, 'a1', { kind: 'role', role: 'regular' })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.problem).toMatch(/UC010/)
  })

  it('allows both once a second administrator exists', () => {
    const directory = [ADMIN_A, ADMIN_B, REGULAR]
    expect(applyUserChange(directory, 'a1', { kind: 'disable' }).ok).toBe(true)
    expect(applyUserChange(directory, 'a1', { kind: 'role', role: 'regular' }).ok).toBe(true)
  })

  it('re-enables without complaint (UC011)', () => {
    const out = applyUserChange([ADMIN_A, DISABLED_ADMIN], 'a3', { kind: 'enable' })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.user.isEnabled).toBe(true)
  })
})

describe('role and country changes (UC007, UC009)', () => {
  it('never lets a guest change role', () => {
    expect(roleChangeProblem(GUEST)).toMatch(/UC007/)
    const out = applyUserChange([ADMIN_A, GUEST], 'g1', { kind: 'role', role: 'administrator' })
    expect(out.ok).toBe(false)
  })

  it('accepts a country restriction on a regular user and de-duplicates it', () => {
    const out = applyUserChange([ADMIN_A, REGULAR], 'r1', {
      kind: 'countries',
      restrictedCountries: ['USA', 'BRA', 'USA'],
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.user.restrictedCountries).toEqual(['BRA', 'USA'])
  })

  it('refuses a country restriction on an administrator', () => {
    const out = applyUserChange([ADMIN_A, ADMIN_B], 'a1', {
      kind: 'countries',
      restrictedCountries: ['USA'],
    })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.problem).toMatch(/every country/)
  })

  it('clearing the restriction is allowed on anyone', () => {
    const out = applyUserChange([ADMIN_A, ADMIN_B], 'a1', {
      kind: 'countries',
      restrictedCountries: [],
    })
    expect(out.ok).toBe(true)
  })
})

describe('directory presentation', () => {
  it('summarises the mix the module header shows', () => {
    const s = summariseDirectory([ADMIN_A, ADMIN_B, REGULAR, GUEST, DISABLED_ADMIN])
    expect(s.total).toBe(5)
    expect(s.enabled).toBe(4)
    expect(s.disabled).toBe(1)
    expect(s.administrators).toBe(3)
    expect(s.guests).toBe(1)
  })

  it('sorts enabled first, administrators before regular users', () => {
    // Within a role the tie-break is the display name, which these fixtures
    // take from the email — so the regular users come out analyst before
    // consultant, and the disabled administrator sorts last whatever its role.
    const sorted = sortDirectory([REGULAR, DISABLED_ADMIN, ADMIN_B, GUEST, ADMIN_A])
    expect(sorted.map((u) => u.id)).toEqual(['a1', 'a2', 'r1', 'g1', 'a3'])
  })
})

describe('the UC008 matrix', () => {
  it('covers every module exactly once', () => {
    const ids = MODULE_PERMISSION_META.map((m) => m.id)
    expect([...ids].sort()).toEqual([...MODULES].sort())
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never offers No Access — UC007 guarantees view and export', () => {
    for (const module of MODULES) {
      expect(allowedLevels(module)).not.toContain('no-access')
    }
  })

  it('reports No Access as a problem if it ever reaches the matrix', () => {
    const broken: PermissionMatrix = { ...DEFAULT_REGULAR_PERMISSIONS, reports: 'no-access' }
    const problems = matrixProblems(broken)
    expect(problems).toHaveLength(1)
    expect(problems[0]?.module).toBe('reports')
    expect(problems[0]?.problem).toMatch(/UC007/)
  })

  it('reports a level that does not apply to its module', () => {
    // Country scoping is meaningless for user administration.
    const broken: PermissionMatrix = {
      ...DEFAULT_REGULAR_PERMISSIONS,
      users: 'edit-selected-countries',
    }
    expect(matrixProblems(broken)).toHaveLength(1)
  })

  it('accepts the delivered regular-user defaults and the admin matrix', () => {
    expect(matrixProblems(DEFAULT_REGULAR_PERMISSIONS)).toEqual([])
    // The administrator matrix is not user-editable, but it must still be a
    // legal matrix — if it were not, the capability preview would disagree
    // with what an administrator can actually do.
    expect(matrixProblems(ADMIN_PERMISSIONS)).toEqual([])
  })

  it('describes every offered level in the module’s own terms', () => {
    for (const meta of MODULE_PERMISSION_META) {
      for (const level of meta.levels) {
        const text = describeLevel(meta.id, level)
        expect(text.length).toBeGreaterThan(10)
      }
    }
  })

  it('diffs two matrices down to the modules that moved', () => {
    const after: PermissionMatrix = { ...DEFAULT_REGULAR_PERMISSIONS, setup: 'edit' }
    const diff = matrixDiff(DEFAULT_REGULAR_PERMISSIONS, after)
    expect(diff).toEqual([{ module: 'setup', from: 'view', to: 'edit' }])
    expect(matrixDiff(DEFAULT_REGULAR_PERMISSIONS, DEFAULT_REGULAR_PERMISSIONS)).toEqual([])
  })

  it('previews capabilities the same way usePermissions computes them', () => {
    const preview = capabilityPreview(DEFAULT_REGULAR_PERMISSIONS)
    const reports = preview.find((p) => p.module === 'reports')
    // Country Customized: may author, may not publish to everyone.
    expect(reports?.canEdit).toBe(true)
    expect(reports?.canCreatePredefined).toBe(false)

    const setup = preview.find((p) => p.module === 'setup')
    expect(setup?.canView).toBe(true)
    expect(setup?.canEdit).toBe(false)
  })

  it('flipping Reports to View removes the create-predefined capability', () => {
    // The 20-second demo beat, asserted: the New-report button is gated on
    // exactly this value.
    const before = capabilityPreview({ ...DEFAULT_REGULAR_PERMISSIONS, reports: 'create-predefined' })
    const after = capabilityPreview({ ...DEFAULT_REGULAR_PERMISSIONS, reports: 'view' })
    expect(before.find((p) => p.module === 'reports')?.canCreatePredefined).toBe(true)
    expect(after.find((p) => p.module === 'reports')?.canCreatePredefined).toBe(false)
    expect(after.find((p) => p.module === 'reports')?.canView).toBe(true)
  })
})
