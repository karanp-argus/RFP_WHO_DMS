/**
 * The UC023 reporting-date sender, wired to the notification module.
 *
 * Phase 6 delivered notifications from exactly one source — UC042's background
 * jobs. A notifications *module* with one sender is a job list with a bell on
 * it, so Phase 7 adds the second: the follow-up log's due dates, turned into
 * events by `dueDateEvents`, filtered by the user's subscriptions, and pushed
 * through the same store.
 *
 * Mounted once in the app shell rather than on the notifications page. A
 * sender that only runs while you are looking at the inbox is not a sender —
 * the whole point is that the bell already has something in it when you
 * arrive.
 */

import { useEffect } from 'react'
import { DEMO_NOW } from '@/domain/constants'
import {
  NOTIFICATION_EVENT_META,
  dueDateEvents,
  matchSubscriptions,
  renderNotification,
  visibleSubscriptions,
} from '@/domain/notify'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { usePermissions } from '@/hooks/usePermissions'
import { useReportingContacts } from '@/hooks/useSetupData'
import { useNotificationStore } from '@/stores/notificationStore'
import { allSubscriptions, useSubscriptionStore } from '@/stores/subscriptionStore'

/**
 * How many due-date notices to raise at once.
 *
 * The seeded round has roughly twenty countries overdue or falling due, and an
 * inbox that opens with twenty identical lines is one nobody reads — the exact
 * failure the delivered subscription set was chosen to avoid. The most urgent
 * are raised (the sender returns them sorted) and the follow-up tab carries
 * the rest, which is where somebody working the list would go anyway.
 */
const MAX_DUE_DATE_NOTICES = 4

/** Titles this sender produces, for recognising its own notices in the inbox. */
const DUE_DATE_LABELS = [
  NOTIFICATION_EVENT_META['reporting-due-soon'].label,
  NOTIFICATION_EVENT_META['reporting-overdue'].label,
]

export function useDueDateNotifications(): void {
  const { user, isAdmin } = usePermissions()
  const { data: contacts } = useReportingContacts()

  const edits = useSubscriptionStore((s) => s.edits)
  const removedIds = useSubscriptionStore((s) => s.removedIds)
  const notifications = useNotificationStore((s) => s.notifications)
  const push = useNotificationStore((s) => s.push)

  useEffect(() => {
    if (!contacts || !user) return

    const subs = visibleSubscriptions(
      allSubscriptions(edits, removedIds),
      user.email,
      isAdmin,
    )

    /**
     * Deduplicate against the **persisted inbox**, not a session flag.
     *
     * The title is `"<event> — <country>"` and is stable for a given country
     * and event, so a notice already in the list is not raised again. A
     * session-scoped "already announced" set looked equivalent and was not:
     * notifications persist across reloads and the flag did not, so every
     * reload added another copy of the same four overdue countries and a few
     * minutes of clicking produced an inbox of sixty duplicates.
     */
    const seen = new Set(notifications.map((n) => n.title))

    /**
     * The cap counts due-date notices **already in the inbox**, not ones
     * raised on this pass.
     *
     * Counting only new ones is the subtler half of the same bug: each pass
     * would skip the four it had already raised, find the next four countries
     * down the list and raise those too — walking the whole overdue set four
     * at a time, and then looping forever once the store's 50-notification cap
     * started dropping the titles `seen` was built from.
     */
    let total = notifications.filter((n) =>
      DUE_DATE_LABELS.some((label) => n.title.startsWith(label)),
    ).length

    for (const event of dueDateEvents(contacts, DEMO_NOW, {
      countryName: (iso3) => COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN,
    })) {
      if (total >= MAX_DUE_DATE_NOTICES) break

      const matched = matchSubscriptions(subs, event)
      if (matched.length === 0) continue

      const rendered = renderNotification(event, matched)
      const title = `${rendered.title} — ${event.countryName ?? event.iso3}`
      if (seen.has(title)) continue

      push({ kind: rendered.kind, title, body: rendered.body, href: rendered.href })
      seen.add(title)
      total++
    }
  }, [contacts, user, isAdmin, edits, removedIds, notifications, push])
}
