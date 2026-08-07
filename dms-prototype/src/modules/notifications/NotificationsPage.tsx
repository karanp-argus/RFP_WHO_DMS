/**
 * The Notifications module (UC058, UC059).
 *
 * Phase 6 built the delivery half — the store, the header bell and this list —
 * because UC042's job-completion notification needed somewhere to arrive.
 * Phase 7 adds what makes it a module: a second sender (UC023's reporting
 * dates), a catalogue of the events DMS can raise, and subscriptions that
 * decide which of them reach whom.
 */

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModuleTabs, type ModuleTab } from '@/components/layout/ModuleTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { visibleSubscriptions } from '@/domain/notify'
import { usePermissions } from '@/hooks/usePermissions'
import { unreadCount, useNotificationStore } from '@/stores/notificationStore'
import { allSubscriptions, useSubscriptionStore } from '@/stores/subscriptionStore'
import { InboxTab } from './InboxTab'
import { SubscriptionsTab } from './SubscriptionsTab'

export function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') ?? 'inbox'
  const { user, isAdmin } = usePermissions()

  const notifications = useNotificationStore((s) => s.notifications)
  const edits = useSubscriptionStore((s) => s.edits)
  const removedIds = useSubscriptionStore((s) => s.removedIds)

  const subscriptionCount = useMemo(
    () => visibleSubscriptions(allSubscriptions(edits, removedIds), user?.email, isAdmin).length,
    [edits, removedIds, user?.email, isAdmin],
  )

  const tabs: ModuleTab[] = [
    { id: 'inbox', label: 'Inbox', count: unreadCount(notifications) },
    { id: 'subscriptions', label: 'Subscriptions', count: subscriptionCount },
  ]

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Events DMS raised for you, and the subscriptions that decide which events reach you at all."
      />

      <ModuleTabs
        tabs={tabs}
        active={active}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />

      <div className="mt-5">
        {active === 'inbox' ? <InboxTab /> : null}
        {active === 'subscriptions' ? <SubscriptionsTab /> : null}
      </div>
    </>
  )
}
