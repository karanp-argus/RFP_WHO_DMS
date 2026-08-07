/**
 * Users module state (UC004, UC005, UC007, UC009, UC010, UC011, UC012).
 *
 * A **diff over the directory xMart returns**, not a copy of it. The same
 * shape `setupStore`, `qcStore` and `reportStore` use, and for the same
 * reason: the directory is master data DMS does not own, so holding a full
 * copy would freeze a user at whatever the last read said and quietly diverge
 * from Entra ID.
 *
 * `removedIds` is deliberately absent. UC012 forbids deleting a user, and
 * `domain/users/access.ts` has no `deleteUser` for the same reason — there is
 * no code path to remove one, only to disable.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DmsUser } from '@/domain/types'

interface UserState {
  /**
   * Changes to directory users, keyed by id, and users granted access in this
   * session. Merged over what xMart returned by `mergedDirectory`.
   */
  edits: Record<string, DmsUser>
  saveUser: (user: DmsUser) => void
  /** Drop a local change, restoring what the directory says. */
  resetUser: (id: string) => void
  resetAll: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      edits: {},

      saveUser: (user) => set((s) => ({ edits: { ...s.edits, [user.id]: user } })),

      resetUser: (id) =>
        set((s) => {
          const rest = { ...s.edits }
          delete rest[id]
          return { edits: rest }
        }),

      resetAll: () => set({ edits: {} }),
    }),
    { name: 'dms-users', version: 1 },
  ),
)

/**
 * The directory with local changes applied and granted users appended.
 *
 * Pure and taking its state as an argument — the same convention as
 * `effectiveAttributes` and `allRules` — so a component's `useMemo` gets
 * honest dependencies and the merge is testable without a store.
 */
export function mergedDirectory(
  directory: readonly DmsUser[],
  edits: Record<string, DmsUser>,
): DmsUser[] {
  const seen = new Set<string>()
  const out = directory.map((u) => {
    seen.add(u.id)
    return edits[u.id] ?? u
  })
  for (const [id, user] of Object.entries(edits)) {
    if (!seen.has(id)) out.push(user)
  }
  return out
}

/** True when this user differs from what the directory returned. */
export function isUserModified(id: string, edits: Record<string, DmsUser>): boolean {
  return edits[id] != null
}
