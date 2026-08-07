/**
 * Phase 7 — the notification module (UC058, UC059) and its UC023 sender.
 *
 * The threshold comparison is what these tests exist for. A subscription's
 * number runs in opposite directions depending on which field the event
 * carries — "at least 3 errors" counts up, "within 14 days of the due date"
 * counts down, and "1 day overdue" counts up again from a negative — and every
 * one of those is a plausible-looking one-liner that fires on everything or on
 * nothing.
 */

import { describe, expect, it } from 'vitest'
import type { ReportingContact } from '@/domain/types'
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_META,
  daysUntil,
  dueDateEvents,
  emptySubscription,
  isNotificationEvent,
  matchSubscriptions,
  renderNotification,
  subscriptionMatches,
  subscriptionProblems,
  visibleSubscriptions,
  type NotificationSubscription,
} from '@/domain/notify'

const NOW = new Date('2026-08-01T09:00:00.000Z')

function sub(partial: Partial<NotificationSubscription> = {}): NotificationSubscription {
  return {
    id: 's1',
    event: 'reporting-overdue',
    name: 'Overdue countries',
    isEnabled: true,
    channels: ['in-app'],
    countries: [],
    threshold: null,
    scope: 'custom',
    ownerEmail: 'analyst@who.int',
    createdUtc: NOW.toISOString(),
    updatedUtc: NOW.toISOString(),
    ...partial,
  }
}

function contact(partial: Partial<ReportingContact> & Pick<ReportingContact, 'iso3'>): ReportingContact {
  return {
    id: `rc-${partial.iso3}`,
    requestSentOn: '2026-05-01',
    responseDueOn: '2026-09-01',
    respondedOn: null,
    status: 'awaiting',
    channel: 'email',
    note: '',
    loggedBy: 'dmsuser@who.int',
    ...partial,
  }
}

describe('the event catalogue (UC058)', () => {
  it('has metadata for every event and no orphan metadata', () => {
    const metaIds = Object.keys(NOTIFICATION_EVENT_META).sort()
    expect(metaIds).toEqual([...NOTIFICATION_EVENTS].sort())
    for (const id of NOTIFICATION_EVENTS) {
      expect(NOTIFICATION_EVENT_META[id].id).toBe(id)
      expect(NOTIFICATION_EVENT_META[id].useCase).toMatch(/^UC\d{3}$/)
    }
  })

  it('gives every threshold a label and a default, or neither', () => {
    for (const id of NOTIFICATION_EVENTS) {
      const meta = NOTIFICATION_EVENT_META[id]
      // A threshold with no label is a number nobody can set correctly; a
      // label with no default puts an empty box in front of the user.
      expect(meta.thresholdLabel == null).toBe(meta.thresholdDefault == null)
    }
  })

  it('narrows unknown strings', () => {
    expect(isNotificationEvent('reporting-overdue')).toBe(true)
    expect(isNotificationEvent('made-up-event')).toBe(false)
  })
})

describe('matching (UC059)', () => {
  it('ignores a disabled subscription and a different event', () => {
    expect(subscriptionMatches(sub({ isEnabled: false }), { event: 'reporting-overdue' })).toBe(false)
    expect(subscriptionMatches(sub(), { event: 'report-job-completed' })).toBe(false)
  })

  it('matches everything when no filters are set', () => {
    expect(subscriptionMatches(sub(), { event: 'reporting-overdue', iso3: 'KEN' })).toBe(true)
  })

  it('applies the country filter, and refuses an event with no country', () => {
    const scoped = sub({ countries: ['KEN', 'ARG'] })
    expect(subscriptionMatches(scoped, { event: 'reporting-overdue', iso3: 'KEN' })).toBe(true)
    expect(subscriptionMatches(scoped, { event: 'reporting-overdue', iso3: 'FRA' })).toBe(false)
    // A country filter on an unscoped event can never be satisfied — silently
    // matching everything would be the wrong way to fail.
    expect(subscriptionMatches(scoped, { event: 'reporting-overdue' })).toBe(false)
  })

  it('counts UP for a count threshold', () => {
    const s = sub({ event: 'qc-critical-findings', threshold: 3 })
    expect(subscriptionMatches(s, { event: 'qc-critical-findings', count: 3 })).toBe(true)
    expect(subscriptionMatches(s, { event: 'qc-critical-findings', count: 9 })).toBe(true)
    expect(subscriptionMatches(s, { event: 'qc-critical-findings', count: 2 })).toBe(false)
  })

  it('counts DOWN for an upcoming due date', () => {
    const s = sub({ event: 'reporting-due-soon', threshold: 14 })
    expect(subscriptionMatches(s, { event: 'reporting-due-soon', daysOffset: 4 })).toBe(true)
    expect(subscriptionMatches(s, { event: 'reporting-due-soon', daysOffset: 14 })).toBe(true)
    // 40 days out is not "due soon" for somebody who asked for two weeks.
    expect(subscriptionMatches(s, { event: 'reporting-due-soon', daysOffset: 40 })).toBe(false)
  })

  it('counts UP again from a negative offset for an overdue date', () => {
    const s = sub({ event: 'reporting-overdue', threshold: 7 })
    expect(subscriptionMatches(s, { event: 'reporting-overdue', daysOffset: -9 })).toBe(true)
    expect(subscriptionMatches(s, { event: 'reporting-overdue', daysOffset: -7 })).toBe(true)
    expect(subscriptionMatches(s, { event: 'reporting-overdue', daysOffset: -2 })).toBe(false)
  })

  it('returns every matching subscription', () => {
    const subs = [
      sub({ id: 'a', countries: ['KEN'] }),
      sub({ id: 'b' }),
      sub({ id: 'c', countries: ['FRA'] }),
      sub({ id: 'd', isEnabled: false }),
    ]
    const matched = matchSubscriptions(subs, { event: 'reporting-overdue', iso3: 'KEN' })
    expect(matched.map((s) => s.id)).toEqual(['a', 'b'])
  })
})

describe('validation (UC059)', () => {
  it('accepts a fresh subscription for any event', () => {
    for (const id of NOTIFICATION_EVENTS) {
      expect(subscriptionProblems(emptySubscription(id, 'a@who.int', NOW.toISOString()))).toEqual([])
    }
  })

  it('rejects a country filter on an event that carries no country', () => {
    const s = sub({ event: 'report-job-completed', countries: ['KEN'], threshold: null })
    expect(subscriptionProblems(s).join(' ')).toMatch(/not raised per country/)
  })

  it('rejects a threshold on an event with nothing to compare', () => {
    const s = sub({ event: 'report-job-completed', threshold: 5 })
    expect(subscriptionProblems(s).join(' ')).toMatch(/no number to compare/)
  })

  it('rejects an empty name and no channels', () => {
    expect(subscriptionProblems(sub({ name: '  ' })).join(' ')).toMatch(/name/)
    expect(subscriptionProblems(sub({ channels: [] })).join(' ')).toMatch(/channel/)
  })

  it('defaults to in-app only — email is configured, not sent', () => {
    expect(emptySubscription('reporting-overdue', 'a@who.int', NOW.toISOString()).channels).toEqual([
      'in-app',
    ])
  })
})

describe('rendering', () => {
  it('names the country and the size of the lateness', () => {
    const rendered = renderNotification(
      { event: 'reporting-overdue', iso3: 'KEN', countryName: 'Kenya', daysOffset: -9 },
      [sub({ channels: ['in-app'] })],
    )
    expect(rendered.kind).toBe('error')
    expect(rendered.body).toContain('Kenya')
    expect(rendered.body).toContain('9 days')
    expect(rendered.href).toBe(NOTIFICATION_EVENT_META['reporting-overdue'].href)
  })

  it('singularises one day', () => {
    const rendered = renderNotification(
      { event: 'reporting-due-soon', countryName: 'France', daysOffset: 1 },
      [sub()],
    )
    expect(rendered.body).toContain('1 day.')
  })

  it('unions the channels across matching subscriptions rather than duplicating', () => {
    const rendered = renderNotification({ event: 'reporting-overdue', iso3: 'KEN' }, [
      sub({ id: 'a', channels: ['in-app'] }),
      sub({ id: 'b', channels: ['in-app', 'email'] }),
    ])
    expect([...rendered.channels].sort()).toEqual(['email', 'in-app'])
  })
})

describe('the UC023 due-date sender', () => {
  it('floors both sides to UTC midnight, so "due today" is 0 and not -1', () => {
    // NOW is 09:00 UTC. A naive subtraction gives -0.375 days, which floors to
    // -1 and reports a country as overdue on the morning it is due.
    expect(daysUntil('2026-08-01', NOW)).toBe(0)
    expect(daysUntil('2026-08-02', NOW)).toBe(1)
    expect(daysUntil('2026-07-25', NOW)).toBe(-7)
    expect(daysUntil('', NOW)).toBeNull()
  })

  it('raises overdue for a past date and due-soon for an upcoming one', () => {
    const events = dueDateEvents(
      [
        contact({ iso3: 'KEN', status: 'overdue', responseDueOn: '2026-07-20' }),
        contact({ iso3: 'FRA', status: 'awaiting', responseDueOn: '2026-08-10' }),
      ],
      NOW,
    )
    expect(events.map((e) => [e.event, e.iso3, e.daysOffset])).toEqual([
      ['reporting-overdue', 'KEN', -12],
      ['reporting-due-soon', 'FRA', 9],
    ])
  })

  it('raises at most one event per country', () => {
    const events = dueDateEvents([contact({ iso3: 'KEN', responseDueOn: '2026-07-20' })], NOW)
    expect(events).toHaveLength(1)
  })

  it('ignores countries with nothing outstanding', () => {
    const events = dueDateEvents(
      [
        contact({ iso3: 'CAN', status: 'received', responseDueOn: '2026-07-01' }),
        contact({ iso3: 'IDN', status: 'not-requested', responseDueOn: '' }),
      ],
      NOW,
    )
    expect(events).toEqual([])
  })

  it('bounds the look-ahead so a year-out date is not raised as due soon', () => {
    const far = [contact({ iso3: 'ARG', responseDueOn: '2027-06-01' })]
    expect(dueDateEvents(far, NOW)).toEqual([])
    expect(dueDateEvents(far, NOW, { horizonDays: 400 })).toHaveLength(1)
  })

  it('sorts most-overdue first', () => {
    const events = dueDateEvents(
      [
        contact({ iso3: 'A', status: 'overdue', responseDueOn: '2026-07-30' }),
        contact({ iso3: 'B', status: 'overdue', responseDueOn: '2026-06-01' }),
        contact({ iso3: 'C', responseDueOn: '2026-08-05' }),
      ],
      NOW,
    )
    expect(events.map((e) => e.iso3)).toEqual(['B', 'A', 'C'])
  })

  it('resolves country names when a resolver is given', () => {
    const events = dueDateEvents([contact({ iso3: 'KEN', responseDueOn: '2026-07-01' })], NOW, {
      countryName: (iso3) => (iso3 === 'KEN' ? 'Kenya' : undefined),
    })
    expect(events[0]?.countryName).toBe('Kenya')
  })
})

describe('visibility', () => {
  const subs = [
    sub({ id: 'd', scope: 'delivered', ownerEmail: 'system' }),
    sub({ id: 'mine', ownerEmail: 'analyst@who.int' }),
    sub({ id: 'theirs', ownerEmail: 'someone.else@who.int' }),
  ]

  it('shows a regular user the delivered set plus their own', () => {
    expect(visibleSubscriptions(subs, 'analyst@who.int', false).map((s) => s.id)).toEqual([
      'd',
      'mine',
    ])
  })

  it('shows an administrator everything — this follows UC050, not UC037', () => {
    expect(visibleSubscriptions(subs, 'admin@who.int', true)).toHaveLength(3)
  })
})
