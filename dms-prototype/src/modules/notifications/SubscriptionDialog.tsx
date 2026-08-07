/**
 * Create or edit a subscription (UC059).
 *
 * The form reshapes itself around the event, because the event decides what
 * can be configured: only a country-scoped event offers a country filter, and
 * only an event carrying a number offers a threshold — with that number's own
 * label, since "14" means nothing without "days before the due date" beside
 * it. Offering every control for every event would let a user save a filter
 * that can never match, which `subscriptionProblems` would then have to
 * reject after the fact.
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CountryPicker } from '@/components/common/CountryPicker'
import {
  CHANNEL_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_META,
  emptySubscription,
  subscriptionProblems,
  type NotificationChannel,
  type NotificationEventId,
  type NotificationSubscription,
} from '@/domain/notify'

export function SubscriptionDialog({
  subscription,
  canPublish,
  onClose,
  onSave,
}: {
  /** `null` closes the dialog; a subscription with an empty id creates one. */
  subscription: NotificationSubscription | null
  /** UC008 — may this user author a subscription everybody receives? */
  canPublish: boolean
  onClose: () => void
  onSave: (sub: NotificationSubscription) => void
}) {
  const [draft, setDraft] = useState<NotificationSubscription | null>(subscription)

  useEffect(() => setDraft(subscription), [subscription])

  if (!subscription || !draft) return null

  const meta = NOTIFICATION_EVENT_META[draft.event]
  const problems = subscriptionProblems(draft)
  const isNew = draft.id === ''

  /**
   * Switching event resets the event-shaped fields.
   *
   * Carrying a country filter across to an event that has no country would
   * produce a subscription that silently never fires, which is the worst kind
   * of configuration bug — everything looks set up.
   */
  function changeEvent(event: NotificationEventId) {
    if (!draft) return
    const fresh = emptySubscription(event, draft.ownerEmail, draft.createdUtc)
    setDraft({
      ...draft,
      event,
      name: draft.name === NOTIFICATION_EVENT_META[draft.event].label ? fresh.name : draft.name,
      countries: [],
      threshold: fresh.threshold,
    })
  }

  function toggleChannel(channel: NotificationChannel, on: boolean) {
    if (!draft) return
    setDraft({
      ...draft,
      channels: on
        ? [...new Set([...draft.channels, channel])]
        : draft.channels.filter((c) => c !== channel),
    })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New subscription' : 'Edit subscription'}</DialogTitle>
          <DialogDescription>
            Choose an event and the conditions under which it reaches you. Delivered subscriptions
            can be disabled and edited but not removed — a later release must still be able to
            change them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sub-event">Event</Label>
            <Select value={draft.event} onValueChange={(v) => changeEvent(v as NotificationEventId)}>
              <SelectTrigger id="sub-event" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_EVENTS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {NOTIFICATION_EVENT_META[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[length:var(--text-meta)] text-who-text-muted">
              <Badge variant="secondary" className="mr-1.5 font-mono">
                {meta.useCase}
              </Badge>
              {meta.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Name</Label>
            <Input
              id="sub-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[length:var(--text-body-sm)] font-medium text-who-heading">
              Delivery
            </legend>
            <div className="flex flex-wrap gap-4">
              {NOTIFICATION_CHANNELS.map((channel) => (
                <label key={channel} className="flex items-center gap-2">
                  <Checkbox
                    checked={draft.channels.includes(channel)}
                    onCheckedChange={(v) => toggleChannel(channel, v === true)}
                    aria-label={CHANNEL_LABELS[channel]}
                  />
                  <span className="text-[length:var(--text-body-sm)] text-who-text">
                    {CHANNEL_LABELS[channel]}
                  </span>
                </label>
              ))}
            </div>
            {draft.channels.includes('email') ? (
              <p className="text-[length:var(--text-meta)] text-who-warn">
                Email delivery is configured here and sent by the server. This prototype has no
                mail transport, so the subscription records the choice and the in-app copy is what
                you will see.
              </p>
            ) : null}
          </fieldset>

          {meta.countryScoped ? (
            <div className="space-y-1.5">
              <Label>Countries</Label>
              <CountryPicker
                selected={draft.countries}
                onChange={(countries) => setDraft({ ...draft, countries })}
                placeholder="Every country you can see"
                ariaLabel="Countries this subscription covers"
              />
            </div>
          ) : null}

          {meta.thresholdLabel ? (
            <div className="space-y-1.5">
              <Label htmlFor="sub-threshold">{meta.thresholdLabel}</Label>
              <Input
                id="sub-threshold"
                type="number"
                min={0}
                className="max-w-[180px]"
                value={draft.threshold ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    threshold: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded border border-who-border p-3">
            <span className="text-[length:var(--text-body-sm)] text-who-text">
              Enabled
              <span className="mt-0.5 block text-[length:var(--text-meta)] text-who-text-muted">
                A disabled subscription keeps its configuration and stops firing.
              </span>
            </span>
            <Switch
              checked={draft.isEnabled}
              aria-label="Subscription enabled"
              onCheckedChange={(v) => setDraft({ ...draft, isEnabled: v })}
            />
          </div>

          {canPublish && draft.scope !== 'delivered' ? (
            <p className="text-[length:var(--text-meta)] text-who-text-muted">
              You hold Create Predefined on Notifications, so this could be published to everyone.
              Subscriptions you create here stay yours; publishing one to the whole team is done by
              editing the delivered set (UC059).
            </p>
          ) : null}

          {problems.length > 0 ? (
            <ul className="list-none space-y-1">
              {problems.map((p) => (
                <li
                  key={p}
                  className="rounded border border-who-fail/40 bg-who-fail/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-fail"
                >
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={problems.length > 0} onClick={() => onSave(draft)}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
