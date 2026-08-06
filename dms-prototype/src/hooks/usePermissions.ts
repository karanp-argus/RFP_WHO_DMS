/**
 * Permission checks for the current user.
 *
 * UC007 is the governing rule: administrators hold every regular-user right, and
 * "whenever a Regular user does not have access to edit a specific function, they
 * will have view and export access to the corresponding module / data". So the
 * meaningful question in the UI is almost always `canEdit`, with view assumed.
 */

import { useAuthStore } from '@/stores/authStore'
import {
  canCreatePredefined,
  canEdit,
  canView,
  type ModuleId,
} from '@/domain/permissions'

export function usePermissions() {
  const user = useAuthStore((s) => s.user)
  const permissions = useAuthStore((s) => s.permissions())

  return {
    user,
    isAdmin: user?.role === 'administrator',
    level: (m: ModuleId) => permissions[m],
    canView: (m: ModuleId) => canView(permissions[m]),
    canEdit: (m: ModuleId) => canEdit(permissions[m]),
    /** May author artefacts visible to all users (UC025, UC029, UC036, UC049). */
    canCreatePredefined: (m: ModuleId) => canCreatePredefined(permissions[m]),
    /**
     * UC009 — a regular user may be barred from editing specific countries.
     * Administrators always have access to every country.
     */
    canEditCountry: (m: ModuleId, iso3: string) => {
      if (!canEdit(permissions[m])) return false
      if (user?.role === 'administrator') return true
      return !user?.restrictedCountries.includes(iso3)
    },
  }
}
