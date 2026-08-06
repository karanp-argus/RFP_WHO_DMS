/**
 * The notifications list.
 *
 * Phase 6 gives it real content because UC042 needs somewhere for a job's
 * success or error notification to live beyond the header popover. **Phase 7
 * owns the module proper** — UC058 (a notifications module) and UC059 (creating
 * and editing what raises one) are about subscribing to events and configuring
 * senders, and neither is built here. The page says so rather than implying the
 * module is finished.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  NotificationActionButton,
  NotificationIcon,
} from '@/components/layout/NotificationBell'
import { unreadCount, useNotificationStore } from '@/stores/notificationStore'
import { cn } from '@/lib/utils'

export function NotificationsPage() {
  const navigate = useNavigate()
  const notifications = useNotificationStore((s) => s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const remove = useNotificationStore((s) => s.remove)
  const clear = useNotificationStore((s) => s.clear)

  const [unreadOnly, setUnreadOnly] = useState(false)
  const unread = unreadCount(notifications)
  const shown = unreadOnly ? notifications.filter((n) => !n.isRead) : notifications

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Events DMS raised for you. Background report jobs land here with their download links (UC042); reporting reminders and xMart events join them in Phase 7."
        actions={
          <>
            {unread > 0 ? (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            ) : null}
            {notifications.length > 0 ? (
              <Button variant="outline" size="sm" onClick={clear}>
                Clear all
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-who-text">
          <Switch
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
            aria-label="Show unread only"
          />
          Unread only
          <Badge variant="secondary">{unread}</Badge>
        </label>
        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          Notifications persist across reloads; the Excel files a job produced are held for the
          browser session only, so an older download link offers to rebuild instead.
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          message={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          hint="Run a report for several countries — it goes to the background queue and a notification arrives here when the files are ready."
          action={<Button onClick={() => navigate('/reports')}>Go to Reports</Button>}
        />
      ) : (
        <ul className="list-none space-y-2">
          {shown.map((n) => (
            <li key={n.id}>
              <Card className={cn(!n.isRead && 'border-who-primary-blue/40')}>
                <CardContent className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className="mt-0.5">
                    <NotificationIcon kind={n.kind} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                        {n.title}
                      </span>
                      {!n.isRead ? <Badge variant="secondary">New</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[length:var(--text-meta)] text-who-text-muted">
                      {n.body}
                    </p>
                    <p className="mt-0.5 text-[length:var(--text-meta)] text-who-hint">
                      {new Date(n.createdUtc).toLocaleString('en-GB')}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {n.action ? <NotificationActionButton notification={n} /> : null}
                    {n.href ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          markRead(n.id)
                          navigate(n.href!)
                        }}
                      >
                        Open
                      </Button>
                    ) : null}
                    {!n.isRead ? (
                      <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                        Mark read
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:text-who-fail"
                      onClick={() => remove(n.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
