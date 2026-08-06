/**
 * Mock authentication.
 *
 * The real system authenticates via WHO Single Sign-On in Entra ID (HLR5,
 * UC006) for both internal staff and external guests. There is no password
 * flow to prototype — so this store simulates a completed SSO handshake and
 * exposes a demo role switcher, which doubles as the UC007/UC008 demo control.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ADMIN_PERMISSIONS,
  DEFAULT_REGULAR_PERMISSIONS,
  type PermissionMatrix,
  type Role,
} from '@/domain/permissions'

export interface CurrentUser {
  id: string
  email: string
  displayName: string
  jobTitle: string
  role: Role
  /** WHO staff vs Entra ID guest. Guests are always 'regular' (UC007). */
  isGuest: boolean
  /** Empty = all countries. Populated = restricted (UC009). */
  restrictedCountries: string[]
}

/** Two demo identities, switchable from the header. */
export const DEMO_USERS: Record<Role, CurrentUser> = {
  administrator: {
    id: 'u-dmsadmin',
    email: 'dmsadmin@who.int',
    displayName: 'DMS Administrator',
    jobTitle: 'Health Economist',
    role: 'administrator',
    isGuest: false,
    restrictedCountries: [],
  },
  regular: {
    id: 'u-dmsuser',
    email: 'dmsuser@who.int',
    displayName: 'DMS Regular User',
    jobTitle: 'Consultant',
    role: 'regular',
    isGuest: false,
    restrictedCountries: [],
  },
}

interface AuthState {
  user: CurrentUser | null
  /** Editable in Phase 7 via the UC008 matrix; regular-user defaults for now. */
  regularPermissions: PermissionMatrix
  signIn: (role: Role) => void
  signOut: () => void
  switchRole: (role: Role) => void
  setRegularPermissions: (m: PermissionMatrix) => void
  /** Effective matrix for the signed-in user. */
  permissions: () => PermissionMatrix
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      regularPermissions: DEFAULT_REGULAR_PERMISSIONS,

      signIn: (role) => set({ user: DEMO_USERS[role] }),
      signOut: () => set({ user: null }),
      switchRole: (role) => set({ user: DEMO_USERS[role] }),
      setRegularPermissions: (m) => set({ regularPermissions: m }),

      permissions: () => {
        const { user, regularPermissions } = get()
        if (!user) return DEFAULT_REGULAR_PERMISSIONS
        return user.role === 'administrator' ? ADMIN_PERMISSIONS : regularPermissions
      },
    }),
    {
      name: 'dms-auth',
      // `permissions` is a derived getter, not state — don't persist it.
      partialize: (s) => ({ user: s.user, regularPermissions: s.regularPermissions }),
    },
  ),
)
