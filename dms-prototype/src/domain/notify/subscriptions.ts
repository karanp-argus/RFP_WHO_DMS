/**
 * Subscriptions and matching (UC058, UC059).
 *
 * UC059: *"As a regular user, I need to be able to create and edit
 * notifications, so that I am informed of the events I care about."* A
 * subscription is a filter over the event catalogue — an event fires a
 * notification only if a subscription of the recipient's matches it.
 *
 * The matching is pure and takes both sides as arguments, which is what makes
 * the awkward cases testable: an event with no country against a
 * country-scoped subscription, a threshold that is not met, a disabled
 * subscription, a delivered subscription an administrator has edited.
 */

import {
  NOTIFICATION_EVENT_META,
  type NotificationChannel,
  type NotificationEventId,
  type RaisedEvent,
} from './events'

export interface NotificationSubscription {
  id: string
  event: NotificationEventId
  /** Shown in the list; defaults to the event label when the user leaves it. */
  name: string
  isEnabled: boolean
  channels: NotificationChannel[]
  /** ISO3 codes. Empty means every country the recipient can see. */
  countries: string[]
  /** Compared against the event's `count` or `daysOffset`; null means no test. */
  threshold: number | null
  /**
   * `delivered` subscriptions ship with DMS and can be reset, exactly as the
   * QC rules and the predefined reports can. `custom` ones belong to their
   * author.
   */
  scope: 'delivered' | 'custom'
  /** Email of the owner; `system` for delivered ones. */
  ownerEmail: string
  createdUtc: string
  updatedUtc: string
}

export function emptySubscription(
  event: NotificationEventId,
  ownerEmail: string,
  nowUtc: string,
): NotificationSubscription {
  const meta = NOTIFICATION_EVENT_META[event]
  return {
    id: '',
    event,
    name: meta.label,
    isEnabled: true,
    // In-app by default and email opt-in: DMS can deliver in-app today, and a
    // channel that ticks itself on and then does nothing is the dishonest kind
    // of default. The editor labels email as configured-not-sent.
    channels: ['in-app'],
    countries: [],
    threshold: meta.thresholdDefault,
    scope: 'custom',
    ownerEmail,
    createdUtc: nowUtc,
    updatedUtc: nowUtc,
  }
}

export function subscriptionProblems(sub: NotificationSubscription): string[] {
  const meta = NOTIFICATION_EVENT_META[sub.event]
  const out: string[] = []

  if (sub.name.trim() === '') out.push('Give the subscription a name.')
  if (sub.channels.length === 0) out.push('Choose at least one delivery channel.')
  if (!meta.countryScoped && sub.countries.length > 0) {
    out.push(`“${meta.label}” is not raised per country, so a country filter would never match.`)
  }
  if (meta.thresholdLabel == null && sub.threshold != null) {
    out.push(`“${meta.label}” carries no number to compare a threshold against.`)
  }
  if (meta.thresholdLabel != null && sub.threshold != null && sub.threshold < 0) {
    out.push(`${meta.thresholdLabel} cannot be negative.`)
  }
  return out
}

/* ==========================================================================
   Matching
   ========================================================================== */

/**
 * Does this subscription fire for this event?
 *
 * The threshold comparison depends on which field the event carries, and the
 * two run in opposite directions:
 *
 *  · `count`      — fires at or **above** the threshold (3 errors ≥ 1).
 *  · `daysOffset` — fires at or **within** it (due in 4 days ≤ 14 days notice;
 *    overdue by 9 days is `-9`, and a "notify after 1 day overdue" threshold
 *    means `-daysOffset >= 1`).
 *
 * Getting that backwards yields a subscription that fires on everything or
 * nothing, and both look plausible until somebody checks — hence the tests.
 */
export function subscriptionMatches(
  sub: NotificationSubscription,
  event: RaisedEvent,
): boolean {
  if (!sub.isEnabled) return false
  if (sub.event !== event.event) return false

  if (sub.countries.length > 0) {
    // A country filter on an event with no country cannot be satisfied. The
    // editor refuses this combination; this is the runtime backstop.
    if (!event.iso3) return false
    if (!sub.countries.includes(event.iso3)) return false
  }

  if (sub.threshold != null) {
    if (event.count != null) return event.count >= sub.threshold
    if (event.daysOffset != null) {
      return event.daysOffset < 0
        ? -event.daysOffset >= sub.threshold
        : event.daysOffset <= sub.threshold
    }
  }

  return true
}

export function matchSubscriptions(
  subs: readonly NotificationSubscription[],
  event: RaisedEvent,
): NotificationSubscription[] {
  return subs.filter((s) => subscriptionMatches(s, event))
}

/**
 * The notification an event produces.
 *
 * One notification per *event*, not per matching subscription: two
 * subscriptions covering the same overdue country should not put the same line
 * in the inbox twice. The channels are unioned across the matches instead.
 */
export interface RenderedNotification {
  kind: 'success' | 'error' | 'info'
  title: string
  body: string
  href: string
  channels: NotificationChannel[]
}

export function renderNotification(
  event: RaisedEvent,
  matched: readonly NotificationSubscription[],
): RenderedNotification {
  const meta = NOTIFICATION_EVENT_META[event.event]
  const where = event.countryName ?? event.iso3

  let body: string
  switch (event.event) {
    case 'reporting-due-soon':
      body = `${where} is due to respond in ${event.daysOffset ?? 0} day${event.daysOffset === 1 ? '' : 's'}.`
      break
    case 'reporting-overdue':
      body = `${where} passed its response date ${Math.abs(event.daysOffset ?? 0)} day${Math.abs(event.daysOffset ?? 0) === 1 ? '' : 's'} ago.`
      break
    case 'qc-critical-findings':
      body = `${event.count ?? 0} error-severity finding${event.count === 1 ? '' : 's'}${where ? ` for ${where}` : ''}.`
      break
    case 'country-data-received':
      body = `${where} submitted ${(event.count ?? 0).toLocaleString()} rows.`
      break
    default:
      body = meta.description
  }

  return {
    kind: meta.kind,
    title: meta.label,
    body: event.detail ? `${body} ${event.detail}` : body,
    href: event.href ?? meta.href,
    channels: [...new Set(matched.flatMap((s) => s.channels))],
  }
}

/* ==========================================================================
   Visibility
   ========================================================================== */

/**
 * Whose subscriptions a person sees.
 *
 * This follows **UC050's** shape, not UC037's: a private QC rule is visible to
 * administrators so one can be promoted to the shared set, and a subscription
 * is the same kind of object — an administrator configuring what the team is
 * told needs to see what people have already set up for themselves. UC037's
 * custom reports are the opposite case and stay invisible; the asymmetry is
 * deliberate and recorded in CLAUDE.md.
 */
export function visibleSubscriptions(
  subs: readonly NotificationSubscription[],
  userEmail: string | undefined,
  isAdmin: boolean,
): NotificationSubscription[] {
  if (isAdmin) return [...subs]
  return subs.filter((s) => s.scope === 'delivered' || s.ownerEmail === userEmail)
}
