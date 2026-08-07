/**
 * The reporting due-date sender (UC023 → UC058).
 *
 * UC023 asks DMS to track communications with countries *"and some
 * notifications based on dates created for me"*. Phase 2 built the follow-up
 * log; this turns its dates into events the notification module can subscribe
 * to, which is the second sender Phase 7 was asked to add alongside UC042's
 * job outcomes.
 *
 * Pure: it is handed the contacts and a `now`, and returns events. It does not
 * decide who is told — `matchSubscriptions` does that — and it does not push
 * anything.
 */

import type { ReportingContact } from '@/domain/types'
import type { RaisedEvent } from './events'

const MS_PER_DAY = 86_400_000

/**
 * Whole days from `now` to an ISO date, positive for the future.
 *
 * Both sides are floored to UTC midnight first. Comparing a date-only string
 * against a timestamp otherwise makes "due today" come out as −1 day whenever
 * `now` is past midnight, which is every time.
 */
export function daysUntil(isoDay: string, now: Date): number | null {
  if (!isoDay) return null
  const due = Date.parse(`${isoDay.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(due)) return null
  const today = Math.floor(now.getTime() / MS_PER_DAY) * MS_PER_DAY
  return Math.round((due - today) / MS_PER_DAY)
}

export interface DueDateOptions {
  /** How far ahead to look for `reporting-due-soon`. */
  horizonDays?: number
  /** Resolves a display name; falls back to the ISO3 code. */
  countryName?: (iso3: string) => string | undefined
}

/**
 * Every due-date event the follow-up log currently justifies.
 *
 * A country produces at most one event: overdue and due-soon are the same fact
 * on either side of a date, and raising both for one country would double the
 * inbox for no extra information. `not-requested` and `received` produce
 * nothing — there is no outstanding date to be early or late against.
 *
 * The horizon here is a *ceiling*, not the user's setting. Subscriptions carry
 * their own threshold and `subscriptionMatches` applies it; this bound only
 * stops the sender walking 194 countries' worth of dates a year out.
 */
export function dueDateEvents(
  contacts: readonly ReportingContact[],
  now: Date,
  options: DueDateOptions = {},
): RaisedEvent[] {
  const horizon = options.horizonDays ?? 60
  const out: RaisedEvent[] = []

  for (const contact of contacts) {
    if (contact.status !== 'awaiting' && contact.status !== 'overdue') continue

    const offset = daysUntil(contact.responseDueOn, now)
    if (offset == null) continue

    const countryName = options.countryName?.(contact.iso3) ?? contact.iso3

    if (offset < 0) {
      out.push({
        event: 'reporting-overdue',
        iso3: contact.iso3,
        countryName,
        daysOffset: offset,
        detail: contact.note,
      })
    } else if (offset <= horizon) {
      out.push({
        event: 'reporting-due-soon',
        iso3: contact.iso3,
        countryName,
        daysOffset: offset,
      })
    }
  }

  // Most urgent first: overdue (negative) ahead of upcoming, and within each
  // group the closest date first.
  return out.sort((a, b) => (a.daysOffset ?? 0) - (b.daysOffset ?? 0))
}
