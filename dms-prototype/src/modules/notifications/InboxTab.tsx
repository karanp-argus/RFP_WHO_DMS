/**
 * The inbox — everything DMS has raised for this user.
 *
 * Built in Phase 6 for UC042's job outcomes; Phase 7 moved it under a tab and
 * added a second sender behind it (the UC023 reporting dates, raised by
 * `useDueDateNotifications` in the app shell), so the list is no longer a job
 * log with a bell on it.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/common/EmptyState'
import {
  NotificationActionButton,
  NotificationIcon,
} from '@/components/layout/NotificationBell'
import { unreadCount, useNotificationStore } from '@/stores/notificationStore'
import { cn } from '@/lib/utils'

export function InboxTab() {
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

        <div className="ml-auto flex gap-2">
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
        </div>
      </div>

      <p className="mb-3 text-[length:var(--text-meta)] text-who-text-muted">
        Notifications persist across reloads; the Excel files a background job produced are held
        for the browser session only, so an older download link offers to rebuild instead.
      </p>

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
