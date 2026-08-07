/**
 * Notification subscriptions (UC058, UC059).
 *
 * A diff over `SEEDED_SUBSCRIPTIONS`, exactly as `qcStore` holds a diff over
 * the delivered rules: an edited delivered subscription is keyed by its own
 * id and can be reset, one somebody created is appended, and a delivered one
 * can be disabled but not removed. The alternative — copying the delivered set
 * into storage on first load — freezes it at whatever shipped that day, and a
 * later release that adds an event would never reach anyone.
 *
 * `notificationStore` is the *delivery* mechanism and is untouched by this
 * file. Phase 6 built it for UC042; this is the configuration around it, which
 * is what UC058/UC059 actually ask for.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEMO_NOW } from '@/domain/constants'
import type { NotificationSubscription } from '@/domain/notify'
import { SEEDED_SUBSCRIPTIONS, SUBSCRIPTION_BY_ID } from '@/data/seed/subscriptions'

interface SubscriptionState {
  edits: Record<string, NotificationSubscription>
  /** Ids of user-created subscriptions that were removed. Delivered ones never appear. */
  removedIds: string[]

  saveSubscription: (sub: NotificationSubscription) => string
  removeSubscription: (id: string) => void
  resetSubscription: (id: string) => void
  toggleSubscription: (id: string, isEnabled: boolean) => void
}

let created = 0

function nextId(): string {
  created += 1
  return `sub-custom-${String(created).padStart(3, '0')}`
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      edits: {},
      removedIds: [],

      saveSubscription: (sub) => {
        const id = sub.id || nextId()
        set((s) => ({
          edits: {
            ...s.edits,
            [id]: { ...sub, id, updatedUtc: new Date(DEMO_NOW.getTime()).toISOString() },
          },
          removedIds: s.removedIds.filter((x) => x !== id),
        }))
        return id
      },

      removeSubscription: (id) =>
        set((s) => {
          const rest = { ...s.edits }
          delete rest[id]
          return {
            edits: rest,
            // A delivered subscription is disabled, never removed — the same
            // rule the delivered QC rules and reports follow, because a later
            // release must be able to change it.
            removedIds: SUBSCRIPTION_BY_ID.has(id)
              ? s.removedIds
              : [...new Set([...s.removedIds, id])],
          }
        }),

      resetSubscription: (id) =>
        set((s) => {
          const rest = { ...s.edits }
          delete rest[id]
          return { edits: rest }
        }),

      toggleSubscription: (id, isEnabled) => {
        const current = get().edits[id] ?? SUBSCRIPTION_BY_ID.get(id)
        if (!current) return
        set((s) => ({ edits: { ...s.edits, [id]: { ...current, isEnabled } } }))
      },
    }),
    { name: 'dms-subscriptions', version: 1 },
  ),
)

/* --------------------------------------------------------------------------
   Selectors
   -------------------------------------------------------------------------- */

export function allSubscriptions(
  edits: Record<string, NotificationSubscription>,
  removedIds: readonly string[],
): NotificationSubscription[] {
  const removed = new Set(removedIds)
  const out: NotificationSubscription[] = []
  const seen = new Set<string>()

  for (const sub of SEEDED_SUBSCRIPTIONS) {
    if (removed.has(sub.id)) continue
    seen.add(sub.id)
    out.push(edits[sub.id] ?? sub)
  }
  for (const [id, sub] of Object.entries(edits)) {
    if (seen.has(id) || removed.has(id)) continue
    out.push(sub)
  }
  return out
}

/** True when a delivered subscription has been changed and can be reset. */
export function isSubscriptionModified(
  id: string,
  edits: Record<string, NotificationSubscription>,
): boolean {
  return SUBSCRIPTION_BY_ID.has(id) && edits[id] != null
}
