/**
 * Country reporting follow-up log (UC023).
 *
 * "As a regular user, I need DMS to have a functionality where I can track the
 * communications with countries when asking for their information, the feedback
 * they provide, due dates and some notifications based on dates created for me."
 *
 * Generated deterministically for every country so the Setup tab is populated,
 * with the status mix skewed to make the follow-up view useful: a realistic
 * reporting round has most countries responded, a meaningful minority awaiting,
 * and a handful overdue — the overdue ones are what drive the UC023 notifications
 * and the dashboard's "upcoming reporting due dates" tile.
 */

import { DEMO_NOW } from '@/domain/constants'
import type { ReportingContact } from '@/domain/types'
import { chance, int, pick, unit } from '../generators/seedRandom'
import { COUNTRIES } from './countries'

const NOTES_AWAITING = [
  'Annual data request sent to the focal point; awaiting acknowledgement.',
  'Reminder issued; country confirmed submission is in preparation.',
  'Focal point on mission, response expected after return.',
  'Country requested the revised JHAQ template before submitting.',
] as const

const NOTES_RECEIVED = [
  'JHAQ received and passed format validation.',
  'HAQ received; two categories queried and clarified by email.',
  'Submission received via eDamis and processed by xMart.',
  'Cross tables received from HAPT; no follow-up required.',
  'Mini questionnaire received for the reduced series.',
] as const

const NOTES_OVERDUE = [
  'No response to two reminders; regional office asked to follow up.',
  'Focal point contact appears out of date — requesting a replacement.',
  'Country reports capacity constraints; new date to be agreed.',
] as const

const NOTES_NOT_REQUESTED = [
  'Not in scope for the current reporting round.',
  'Estimates prepared in-house; no country request issued.',
] as const

function isoDay(offsetDays: number): string {
  return new Date(DEMO_NOW.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function buildFor(iso3: string, index: number): ReportingContact {
  const r = unit(`rc.kind|${iso3}`)
  // ~62% received, ~24% awaiting, ~9% overdue, ~5% not requested.
  const status: ReportingContact['status'] =
    r < 0.62 ? 'received' : r < 0.86 ? 'awaiting' : r < 0.95 ? 'overdue' : 'not-requested'

  const requestedDaysAgo = int(`rc.req|${iso3}`, 40, 150)
  const dueOffset = -requestedDaysAgo + int(`rc.due|${iso3}`, 45, 90)

  const notes =
    status === 'received'
      ? NOTES_RECEIVED
      : status === 'awaiting'
        ? NOTES_AWAITING
        : status === 'overdue'
          ? NOTES_OVERDUE
          : NOTES_NOT_REQUESTED

  return {
    id: `rc-${String(index + 1).padStart(3, '0')}`,
    iso3,
    requestSentOn: status === 'not-requested' ? '' : isoDay(-requestedDaysAgo),
    // Awaiting countries get a future due date; overdue ones a past date.
    responseDueOn:
      status === 'not-requested'
        ? ''
        : status === 'overdue'
          ? isoDay(-int(`rc.od|${iso3}`, 5, 40))
          : isoDay(dueOffset),
    respondedOn:
      status === 'received' ? isoDay(-int(`rc.resp|${iso3}`, 1, requestedDaysAgo - 5)) : null,
    status,
    channel: chance(`rc.ch|${iso3}`, 0.78)
      ? 'email'
      : pick(`rc.chv|${iso3}`, ['call', 'meeting'] as const),
    note: pick(`rc.note|${iso3}`, notes),
    loggedBy: pick(`rc.by|${iso3}`, [
      'dmsuser@who.int',
      'ha.analyst.euro@who.int',
      'ha.analyst.searo@who.int',
      'dmsadmin@who.int',
    ] as const),
  }
}

export const REPORTING_CONTACTS: readonly ReportingContact[] = COUNTRIES.map((c, i) =>
  buildFor(c.CODE_ISO_3, i),
)

export const REPORTING_CONTACT_BY_ISO3: ReadonlyMap<string, ReportingContact> = new Map(
  REPORTING_CONTACTS.map((r) => [r.iso3, r]),
)

/** Overdue countries — drives UC023 notifications and the dashboard tile. */
export const OVERDUE_COUNTRIES: readonly string[] = REPORTING_CONTACTS.filter(
  (r) => r.status === 'overdue',
).map((r) => r.iso3)
