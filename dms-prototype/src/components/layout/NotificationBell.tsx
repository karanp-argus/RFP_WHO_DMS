/**
 * The header bell and its panel.
 *
 * Built in Phase 6 because UC042's notification has to arrive somewhere the
 * user can see it without leaving the page they are on — a background job whose
 * completion is only visible on a page you have to navigate to is not much of
 * an improvement on waiting. Phase 7 adds the notification module around it
 * (UC058/UC059); this is the delivery surface.
 *
 * The panel is a Radix popover, so it renders into the z-50 portal layer and
 * sits above the header rather than being clipped by it (CLAUDE.md stacking
 * order).
 */

import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Bell, CheckCircle2, Download, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  unreadCount,
  useNotificationStore,
  type AppNotification,
} from '@/stores/notificationStore'
import { useReportStore, hasJobFiles } from '@/stores/reportStore'
import { downloadJobFiles } from '@/modules/reports/jobFiles'
import { cn } from '@/lib/utils'

export function NotificationIcon({ kind }: { kind: AppNotification['kind'] }) {
  if (kind === 'success') return <CheckCircle2 className="size-4 shrink-0 text-who-pass" />
  if (kind === 'error') return <AlertTriangle className="size-4 shrink-0 text-who-fail" />
  return <Info className="size-4 shrink-0 text-who-primary-blue" />
}

/**
 * The action a notification carries (UC042: *"with a link to download the
 * file"*).
 *
 * Exported because the notifications page renders the same button, and a second
 * copy of the "is the payload still in memory" logic is exactly how the two
 * would drift apart.
 */
export function NotificationActionButton({
  notification,
  size = 'sm',
}: {
  notification: AppNotification
  size?: 'sm' | 'default'
}) {
  const jobs = useReportStore((s) => s.jobs)
  const action = notification.action
  if (!action) return null

  const job = jobs.find((j) => j.id === action.jobId)
  const available = job != null && hasJobFiles(job.id)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button
            size={size}
            variant="outline"
            className="gap-1.5"
            disabled={!available}
            onClick={() => {
              if (!job) return
              const saved = downloadJobFiles(job)
              toast.success(`Downloading ${saved} file${saved === 1 ? '' : 's'}.`)
            }}
          >
            <Download className="size-3.5" />
            {action.label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {available
          ? 'Saves the files this job produced.'
          : 'The generated files were held for this browser session only. Run the report again to rebuild them.'}
      </TooltipContent>
    </Tooltip>
  )
}

export function NotificationBell() {
  const navigate = useNavigate()
  const notifications = useNotificationStore((s) => s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const remove = useNotificationStore((s) => s.remove)

  const unread = unreadCount(notifications)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread'
          }
          className="relative p-2 text-who-icon transition-colors hover:text-who-primary-blue"
        >
          <Bell className="size-[18px]" />
          {unread > 0 ? (
            <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-who-fail px-1 text-[length:var(--text-micro)] leading-4 font-semibold text-who-on-brand">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-who-border px-3 py-2">
          <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
            Notifications
          </span>
          <div className="flex items-center gap-1">
            {unread > 0 ? (
              <Button variant="ghost" size="sm" className="h-7" onClick={markAllRead}>
                Mark all read
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm" className="h-7">
              <Link to="/notifications">See all</Link>
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-[length:var(--text-meta)] text-who-text-muted">
              Nothing yet. Background report jobs and reporting reminders land here.
            </p>
          ) : (
            <ul className="list-none">
              {notifications.slice(0, 8).map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex gap-2 border-b border-who-border/60 px-3 py-2 last:border-b-0',
                    !n.isRead && 'bg-who-accent-subtle',
                  )}
                >
                  <NotificationIcon kind={n.kind} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="block w-full text-left"
                      onClick={() => {
                        markRead(n.id)
                        if (n.href) navigate(n.href)
                      }}
                    >
                      <span className="block text-[length:var(--text-body-sm)] font-medium text-who-heading">
                        {n.title}
                      </span>
                      <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                        {n.body}
                      </span>
                      <span className="mt-0.5 block text-[length:var(--text-meta)] text-who-hint">
                        {new Date(n.createdUtc).toLocaleString('en-GB')}
                      </span>
                    </button>
                    {n.action ? (
                      <div className="mt-1.5">
                        <NotificationActionButton notification={n} />
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`Dismiss “${n.title}”`}
                    onClick={() => remove(n.id)}
                    className="h-fit rounded p-0.5 text-who-icon hover:text-who-fail"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
