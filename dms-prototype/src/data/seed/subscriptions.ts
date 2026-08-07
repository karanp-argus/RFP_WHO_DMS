/**
 * The delivered notification subscriptions (UC058).
 *
 * Four, not one per event. A module that arrives with every event subscribed
 * teaches the user to ignore the bell in the first week; a module that arrives
 * with none looks broken. So the delivered set is the events somebody would
 * genuinely want on by default — the two UC042 job outcomes, because a
 * background job that finishes silently is a job nobody collects, and the two
 * UC023 reporting dates, because they are the ones with a deadline attached.
 *
 * Everything else in the catalogue ships available and unsubscribed, which is
 * what makes UC059's "create and edit" a real action on arrival rather than a
 * screen with nothing to do.
 */

import type { NotificationSubscription } from '@/domain/notify'

const SEEDED_UTC = '2026-06-01T09:00:00.000Z'

/** Delivered subscriptions belong to the build, not to a seeded person. */
const SYSTEM = 'system'

export const SEEDED_SUBSCRIPTIONS: readonly NotificationSubscription[] = [
  {
    id: 'sub-job-done',
    event: 'report-job-completed',
    name: 'Background report is ready',
    isEnabled: true,
    channels: ['in-app'],
    countries: [],
    threshold: null,
    scope: 'delivered',
    ownerEmail: SYSTEM,
    createdUtc: SEEDED_UTC,
    updatedUtc: SEEDED_UTC,
  },
  {
    id: 'sub-job-failed',
    event: 'report-job-failed',
    name: 'Background report failed',
    isEnabled: true,
    channels: ['in-app'],
    countries: [],
    threshold: null,
    scope: 'delivered',
    ownerEmail: SYSTEM,
    createdUtc: SEEDED_UTC,
    updatedUtc: SEEDED_UTC,
  },
  {
    id: 'sub-overdue',
    event: 'reporting-overdue',
    name: 'A country has missed its response date',
    isEnabled: true,
    channels: ['in-app'],
    countries: [],
    // One day past the date. UC023's point is the follow-up, and a grace
    // period on a date the country already agreed to just delays the email.
    threshold: 1,
    scope: 'delivered',
    ownerEmail: SYSTEM,
    createdUtc: SEEDED_UTC,
    updatedUtc: SEEDED_UTC,
  },
  {
    id: 'sub-due-soon',
    event: 'reporting-due-soon',
    name: 'A country response falls due within two weeks',
    isEnabled: true,
    channels: ['in-app'],
    countries: [],
    threshold: 14,
    scope: 'delivered',
    ownerEmail: SYSTEM,
    createdUtc: SEEDED_UTC,
    updatedUtc: SEEDED_UTC,
  },
]

export const SUBSCRIPTION_BY_ID: ReadonlyMap<string, NotificationSubscription> = new Map(
  SEEDED_SUBSCRIPTIONS.map((s) => [s.id, s]),
)
