/**
 * The events DMS can raise (UC058).
 *
 * *"As a regular user, I need DMS to have a Notifications module, so that I can
 * subscribe to specific notifications."* Subscribing presupposes a **closed,
 * named set** of things to subscribe to — an open-ended "notify me about
 * anything" is not a subscription, it is a log. So the catalogue below is the
 * contract: a sender may only raise an event that appears here, and a
 * subscription may only name one of these ids.
 *
 * Every entry is anchored to the use case that produces it. Two of them exist
 * already and fire today (UC042's job outcomes); the reporting due-date pair
 * comes from UC023's *"notifications based on dates created for me"*, and is
 * the second sender Phase 7 was asked to add. The rest are raised by modules
 * that already produce the underlying event, so nothing here is speculative.
 */

export const NOTIFICATION_EVENTS = [
  'report-job-completed',
  'report-job-failed',
  'reporting-due-soon',
  'reporting-overdue',
  'qc-run-completed',
  'qc-critical-findings',
  'country-data-received',
  'xmart-push-failed',
] as const

export type NotificationEventId = (typeof NOTIFICATION_EVENTS)[number]

/** Where a notification can be delivered. */
export const NOTIFICATION_CHANNELS = ['in-app', 'email'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  'in-app': 'In app',
  email: 'Email',
}

export interface NotificationEventMeta {
  id: NotificationEventId
  label: string
  /** What raises it, in the reader's terms. */
  description: string
  /** The use case it comes from — shown as a badge, same as the QC rules. */
  useCase: string
  /** Which module the notification links back to. */
  href: string
  /** Whether the event carries a country, so a subscription can scope by it. */
  countryScoped: boolean
  /**
   * Label for the numeric trigger, when the event has one (`null` if not).
   * "Days before the due date", "Minimum critical findings" — a threshold with
   * no unit on the screen is a number nobody can set correctly.
   */
  thresholdLabel: string | null
  thresholdDefault: number | null
  /** Severity the notification lands with. */
  kind: 'success' | 'error' | 'info'
  /** Whether DMS raises this today, or the sender arrives with the module. */
  implemented: boolean
}

export const NOTIFICATION_EVENT_META: Record<NotificationEventId, NotificationEventMeta> = {
  'report-job-completed': {
    id: 'report-job-completed',
    label: 'Background report finished',
    description:
      'A report queued for background generation completed and its files are ready to download.',
    useCase: 'UC042',
    href: '/reports?tab=jobs',
    countryScoped: false,
    thresholdLabel: null,
    thresholdDefault: null,
    kind: 'success',
    implemented: true,
  },
  'report-job-failed': {
    id: 'report-job-failed',
    label: 'Background report failed',
    description: 'A queued report could not be generated. The reason is carried in the message.',
    useCase: 'UC042',
    href: '/reports?tab=jobs',
    countryScoped: false,
    thresholdLabel: null,
    thresholdDefault: null,
    kind: 'error',
    implemented: true,
  },
  'reporting-due-soon': {
    id: 'reporting-due-soon',
    label: 'Country response due soon',
    description:
      'A country has been asked for data and its response date is approaching. Raised once per country per reporting round.',
    useCase: 'UC023',
    href: '/setup?tab=reporting',
    countryScoped: true,
    thresholdLabel: 'Days before the due date',
    thresholdDefault: 14,
    kind: 'info',
    implemented: true,
  },
  'reporting-overdue': {
    id: 'reporting-overdue',
    label: 'Country response overdue',
    description: 'A country has passed its response date without submitting.',
    useCase: 'UC023',
    href: '/setup?tab=reporting',
    countryScoped: true,
    thresholdLabel: 'Days overdue before notifying',
    thresholdDefault: 1,
    kind: 'error',
    implemented: true,
  },
  'qc-run-completed': {
    id: 'qc-run-completed',
    label: 'Quality check run finished',
    description: 'A quality check run completed and its report is available.',
    useCase: 'UC055',
    href: '/quality-checks?tab=reports',
    countryScoped: false,
    thresholdLabel: null,
    thresholdDefault: null,
    kind: 'success',
    implemented: true,
  },
  'qc-critical-findings': {
    id: 'qc-critical-findings',
    label: 'Quality check errors found',
    description:
      'A run produced findings at error severity. Warnings are excluded — a subscription that fires on every warning is one nobody reads.',
    useCase: 'UC053',
    href: '/quality-checks?tab=reports',
    countryScoped: true,
    thresholdLabel: 'Minimum number of errors',
    thresholdDefault: 1,
    kind: 'error',
    implemented: true,
  },
  'country-data-received': {
    id: 'country-data-received',
    label: 'New data received from a country',
    description: 'xMart processed a new import batch for a country you follow.',
    useCase: 'UC039',
    href: '/reports?tab=data-tracking',
    countryScoped: true,
    thresholdLabel: null,
    thresholdDefault: null,
    kind: 'info',
    implemented: true,
  },
  'xmart-push-failed': {
    id: 'xmart-push-failed',
    label: 'Push to xMart failed',
    description: 'DMS could not write one or more changes back to the warehouse.',
    useCase: 'UC046',
    href: '/integration',
    countryScoped: false,
    thresholdLabel: null,
    thresholdDefault: null,
    kind: 'error',
    implemented: true,
  },
}

export function isNotificationEvent(value: string): value is NotificationEventId {
  return (NOTIFICATION_EVENTS as readonly string[]).includes(value)
}

/**
 * An event as a sender raises it.
 *
 * `count` and `daysOffset` are what thresholds compare against; both are
 * optional because most events carry neither.
 */
export interface RaisedEvent {
  event: NotificationEventId
  /** Country the event concerns, when it has one. */
  iso3?: string
  /** Display name for the country, so rendering needs no lookup. */
  countryName?: string
  /** Magnitude — error count, row count. Compared against a subscription threshold. */
  count?: number
  /**
   * Days relative to a date the event is about: negative is overdue, positive
   * is upcoming. Compared against a due-date subscription's threshold.
   */
  daysOffset?: number
  /** Free-text detail appended to the body — a report name, a failure reason. */
  detail?: string
  /** Overrides the event's default link, e.g. a specific run's report. */
  href?: string
}
