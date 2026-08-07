/**
 * UC058 / UC059 — the notifications module proper.
 *
 * Phase 6 delivered the inbox because UC042's job notification needed
 * somewhere to arrive. This is what makes it a *module*: the catalogue of
 * events DMS can raise, the subscriptions that decide which of them reach you,
 * and the ability to create and edit them.
 *
 * Delivered subscriptions and ones people created are visibly distinct, the
 * same convention the QC rules use — an administrator has to be able to tell
 * at a glance which of these DMS shipped with.
 */

import { useMemo, useState } from 'react'
import { BellPlus, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/common/EmptyState'
import { DEMO_NOW } from '@/domain/constants'
import {
  CHANNEL_LABELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_META,
  emptySubscription,
  visibleSubscriptions,
  type NotificationSubscription,
} from '@/domain/notify'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { usePermissions } from '@/hooks/usePermissions'
import {
  allSubscriptions,
  isSubscriptionModified,
  useSubscriptionStore,
} from '@/stores/subscriptionStore'
import { cn } from '@/lib/utils'
import { SubscriptionDialog } from './SubscriptionDialog'

function describeScope(sub: NotificationSubscription): string {
  const meta = NOTIFICATION_EVENT_META[sub.event]
  const parts: string[] = []

  if (meta.countryScoped) {
    parts.push(
      sub.countries.length === 0
        ? 'all countries'
        : sub.countries.length <= 3
          ? sub.countries
              .map((iso3) => COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN ?? iso3)
              .join(', ')
          : `${sub.countries.length} countries`,
    )
  }
  if (meta.thresholdLabel && sub.threshold != null) {
    parts.push(`${meta.thresholdLabel.toLowerCase()}: ${sub.threshold}`)
  }
  parts.push(sub.channels.map((c) => CHANNEL_LABELS[c]).join(' + '))
  return parts.join(' · ')
}

export function SubscriptionsTab() {
  const { user, isAdmin, canEdit, canCreatePredefined } = usePermissions()
  const edits = useSubscriptionStore((s) => s.edits)
  const removedIds = useSubscriptionStore((s) => s.removedIds)
  const save = useSubscriptionStore((s) => s.saveSubscription)
  const remove = useSubscriptionStore((s) => s.removeSubscription)
  const reset = useSubscriptionStore((s) => s.resetSubscription)
  const toggle = useSubscriptionStore((s) => s.toggleSubscription)

  const [editing, setEditing] = useState<NotificationSubscription | null>(null)

  const mine = useMemo(
    () => visibleSubscriptions(allSubscriptions(edits, removedIds), user?.email, isAdmin),
    [edits, removedIds, user?.email, isAdmin],
  )
  const delivered = mine.filter((s) => s.scope === 'delivered')
  const custom = mine.filter((s) => s.scope !== 'delivered')

  const mayEdit = canEdit('notifications')

  function renderRow(sub: NotificationSubscription) {
    const meta = NOTIFICATION_EVENT_META[sub.event]
    const modified = isSubscriptionModified(sub.id, edits)
    const isDelivered = sub.scope === 'delivered'
    return (
      <li key={sub.id}>
        <Card className={cn(!sub.isEnabled && 'opacity-70')}>
          <CardContent className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                  {sub.name}
                </span>
                <Badge
                  variant={isDelivered ? 'secondary' : 'outline'}
                  className={cn(!isDelivered && 'border-who-primary-blue text-who-primary-blue')}
                >
                  {isDelivered ? 'Delivered with DMS' : 'Created by you'}
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  {meta.useCase}
                </Badge>
                {modified ? <Badge variant="outline">Edited</Badge> : null}
              </div>
              <p className="mt-0.5 text-[length:var(--text-meta)] text-who-text-muted">
                {meta.label} — {describeScope(sub)}
              </p>
              {isAdmin && !isDelivered && sub.ownerEmail !== user?.email ? (
                <p className="mt-0.5 text-[length:var(--text-meta)] text-who-hint">
                  Owned by {sub.ownerEmail}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {mayEdit ? (
                <Switch
                  checked={sub.isEnabled}
                  aria-label={`${sub.isEnabled ? 'Disable' : 'Enable'} ${sub.name}`}
                  onCheckedChange={(v) => toggle(sub.id, v)}
                />
              ) : (
                <span className="text-[length:var(--text-meta)] text-who-text-muted">
                  {sub.isEnabled ? 'On' : 'Off'}
                </span>
              )}
              {mayEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setEditing(sub)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              ) : null}
              {mayEdit && modified ? (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => reset(sub.id)}>
                  <RotateCcw className="size-3.5" />
                  Reset
                </Button>
              ) : null}
              {mayEdit && !isDelivered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 hover:text-who-fail"
                  onClick={() => remove(sub.id)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[length:var(--text-body-sm)] text-who-text-muted">
          DMS raises a closed set of {NOTIFICATION_EVENTS.length} events. A subscription decides
          which of them reach you, for which countries and above what threshold. Everything not
          subscribed still happens — it just does not put a line in your inbox.
        </p>
        {mayEdit ? (
          <Button
            className="gap-1.5"
            onClick={() =>
              setEditing(
                emptySubscription(
                  'qc-critical-findings',
                  user?.email ?? '',
                  new Date(DEMO_NOW.getTime()).toISOString(),
                ),
              )
            }
          >
            <BellPlus className="size-4" />
            New subscription
          </Button>
        ) : null}
      </div>

      <section>
        <h3 className="mb-2 text-[length:var(--text-h5)] font-semibold text-who-heading">
          Delivered with DMS
          <span className="ml-2 text-[length:var(--text-body-sm)] font-normal text-who-text-muted">
            {delivered.length}
          </span>
        </h3>
        <ul className="list-none space-y-2">{delivered.map(renderRow)}</ul>
      </section>

      <section>
        <h3 className="mb-2 text-[length:var(--text-h5)] font-semibold text-who-heading">
          {isAdmin ? 'Created by users' : 'Created by you'}
          <span className="ml-2 text-[length:var(--text-body-sm)] font-normal text-who-text-muted">
            {custom.length}
          </span>
        </h3>
        {custom.length === 0 ? (
          <EmptyState
            message="No subscriptions of your own yet"
            hint="Subscribe to quality-check errors for the countries you work on, or to new data arriving from a country you follow."
          />
        ) : (
          <ul className="list-none space-y-2">{custom.map(renderRow)}</ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[length:var(--text-h5)] font-semibold text-who-heading">
          Events DMS can raise
        </h3>
        <ul className="grid list-none gap-2 md:grid-cols-2">
          {NOTIFICATION_EVENTS.map((id) => {
            const meta = NOTIFICATION_EVENT_META[id]
            const subscribed = mine.some((s) => s.event === id && s.isEnabled)
            return (
              <li
                key={id}
                className="rounded border border-who-border bg-who-surface p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                    {meta.label}
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {meta.useCase}
                  </Badge>
                  {subscribed ? (
                    <Badge className="bg-who-pass text-who-on-brand">Subscribed</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                  {meta.description}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <SubscriptionDialog
        subscription={editing}
        canPublish={canCreatePredefined('notifications')}
        onClose={() => setEditing(null)}
        onSave={(sub) => {
          save(sub)
          setEditing(null)
        }}
      />
    </div>
  )
}
