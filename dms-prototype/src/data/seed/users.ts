/**
 * Seeded DMS users for the Users module (UC004/005/007/010/011/012).
 *
 * Names are deliberately generic and role-descriptive. The RFP names real WHO
 * staff in its distribution list and RACI matrix; seeding those as demo accounts
 * would be inappropriate in a bid artefact.
 *
 * The set is shaped to exercise the module rather than to look populous:
 *  · both roles present, with more than one administrator so UC010's
 *    "always a minimum of one enabled Administrator" guard is demonstrable
 *  · Entra ID guests, which UC007 fixes to Regular User with a non-editable role
 *  · one disabled account, so UC011 (re-enable) has something to act on
 *  · one country-restricted regular user, for UC009
 */

import { DEMO_NOW } from '@/domain/constants'
import type { DmsUser } from '@/domain/types'

/** Days before DEMO_NOW, as an ISO string. Keeps timestamps deterministic. */
function daysAgo(n: number): string {
  return new Date(DEMO_NOW.getTime() - n * 86_400_000).toISOString()
}

export const SEED_USERS: readonly DmsUser[] = [
  {
    id: 'u-dmsadmin',
    email: 'dmsadmin@who.int',
    displayName: 'DMS Administrator',
    jobTitle: 'Health Economist',
    role: 'administrator',
    isGuest: false,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(0),
    createdUtc: daysAgo(420),
  },
  {
    id: 'u-hqlead',
    email: 'ha.lead@who.int',
    displayName: 'HA Team Lead',
    jobTitle: 'Unit Head',
    role: 'administrator',
    isGuest: false,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(2),
    createdUtc: daysAgo(400),
  },
  {
    id: 'u-dmsuser',
    email: 'dmsuser@who.int',
    displayName: 'DMS Regular User',
    jobTitle: 'Consultant',
    role: 'regular',
    isGuest: false,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(1),
    createdUtc: daysAgo(300),
  },
  {
    id: 'u-euro',
    email: 'ha.analyst.euro@who.int',
    displayName: 'EURO Regional Analyst',
    jobTitle: 'Technical Officer',
    role: 'regular',
    isGuest: false,
    isEnabled: true,
    // UC009 — restricted from editing outside the European Region. Populated
    // with a handful of non-EURO countries to make the restriction visible.
    restrictedCountries: ['USA', 'BRA', 'IND', 'CHN', 'ZAF', 'NGA', 'JPN'],
    lastSeenUtc: daysAgo(5),
    createdUtc: daysAgo(210),
  },
  {
    id: 'u-searo',
    email: 'ha.analyst.searo@who.int',
    displayName: 'SEARO Regional Analyst',
    jobTitle: 'Technical Officer',
    role: 'regular',
    isGuest: false,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(11),
    createdUtc: daysAgo(180),
  },
  {
    id: 'u-consultant-ext',
    email: 'external.consultant@example.org',
    displayName: 'External Consultant',
    jobTitle: 'Health Accounts Consultant',
    // UC007: guests may only ever be Regular User, and the role is not editable.
    role: 'regular',
    isGuest: true,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(19),
    createdUtc: daysAgo(95),
  },
  {
    id: 'u-univ-ext',
    email: 'researcher@example.edu',
    displayName: 'University Researcher',
    jobTitle: 'Visiting Researcher',
    role: 'regular',
    isGuest: true,
    isEnabled: true,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(44),
    createdUtc: daysAgo(88),
  },
  {
    id: 'u-former',
    email: 'former.colleague@who.int',
    displayName: 'Former Team Member',
    jobTitle: 'Consultant (contract ended)',
    role: 'regular',
    isGuest: false,
    // UC010/UC011/UC012: disabled, retained, never deleted — "so that any log
    // references will be kept and there is no impact on data".
    isEnabled: false,
    restrictedCountries: [],
    lastSeenUtc: daysAgo(160),
    createdUtc: daysAgo(500),
  },
]
