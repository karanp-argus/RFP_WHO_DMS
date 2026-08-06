/**
 * In-app notifications.
 *
 * Built in Phase 6 because UC042 requires one: *"an In App notification will be
 * sent to the user when the process is completed — success notification if the
 * report was created successfully, with a link to download the file; error
 * notification if the report was not created successfully."* Phase 7 owns the
 * notification **module** (UC058/UC059 — subscribing to events, editing what
 * raises one); this store is the delivery mechanism underneath it, and is
 * deliberately generic so that phase adds senders rather than a second store.
 *
 * **Notifications persist; the payloads they point at do not.** A completed
 * report job holds real `.xlsx` blobs in memory, and a handful of those would
 * fill the same `localStorage` quota the workbook's unsaved edits depend on —
 * the same trade `qcStore` makes for findings. So the notification survives a
 * reload and its download button says the file has expired rather than
 * silently doing nothing, which is the honest failure.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEMO_NOW } from '@/domain/constants'

export type NotificationKind = 'success' | 'error' | 'info'

/** What the notification's button does. Only one action exists so far. */
export interface NotificationAction {
  kind: 'download-report-job'
  /** Job the files belong to; resolved against `reportStore`'s file cache. */
  jobId: string
  label: string
}

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdUtc: string
  isRead: boolean
  action?: NotificationAction
  /** Where clicking the notification navigates. */
  href?: string
}

interface NotificationState {
  notifications: AppNotification[]
  push: (n: Omit<AppNotification, 'id' | 'createdUtc' | 'isRead'>) => string
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
}

/** Enough for a demo session; a real one would page. */
const MAX_NOTIFICATIONS = 50

/**
 * Ids and timestamps from a session counter over `DEMO_NOW`.
 *
 * The same rule the whole seeded corpus follows: `Math.random()` is barred for
 * anything that reaches the screen, and the wall clock would make every
 * screenshot different. The first notification of a session lands on `DEMO_NOW`
 * exactly and each later one a minute after it, so a list of three reads as a
 * sequence rather than three identical stamps.
 */
let counter = 0

function nextStamp(): { id: string; utc: string } {
  const n = counter++
  return {
    id: `ntf-${String(n + 1).padStart(4, '0')}`,
    utc: new Date(DEMO_NOW.getTime() + n * 60_000).toISOString(),
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],

      push: (n) => {
        const stamp = nextStamp()
        set((s) => ({
          notifications: [
            { ...n, id: stamp.id, createdUtc: stamp.utc, isRead: false },
            ...s.notifications,
          ].slice(0, MAX_NOTIFICATIONS),
        }))
        return stamp.id
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((x) => (x.id === id ? { ...x, isRead: true } : x)),
        })),

      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((x) => ({ ...x, isRead: true })) })),

      remove: (id) =>
        set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) })),

      clear: () => set({ notifications: [] }),
    }),
    {
      name: 'dms-notifications',
      version: 1,
      onRehydrateStorage: () => (state) => {
        // Keep the counter ahead of what was restored, so a second session does
        // not mint ids that collide with the first session's.
        const restored = state?.notifications.length ?? 0
        if (restored > counter) counter = restored
      },
    },
  ),
)

export function unreadCount(notifications: readonly AppNotification[]): number {
  return notifications.filter((n) => !n.isRead).length
}
