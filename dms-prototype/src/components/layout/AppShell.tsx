/**
 * App shell. Content padding matches _layout.scss `.content`:
 *   padding: 110px 40px 80px 300px  (desktop)
 *   left/right padding collapse below 767px
 *
 * Redirects to the mock SSO screen when no session exists (UC006).
 */

import { Navigate, Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { ApiLogDrawer } from './ApiLogDrawer'
import { cn } from '@/lib/utils'
import { useDueDateNotifications } from '@/hooks/useDueDateNotifications'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  // UC023 → UC058. Mounted on the shell, not on the notifications page: a
  // sender that only runs while you are looking at the inbox is not a sender.
  // The hook no-ops until the contacts query resolves, so it is safe above the
  // sign-in guard's early return in terms of ordering — it is called before it.
  useDueDateNotifications()

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-who-page-bg">
      <Sidebar />
      <Header />
      <main
        className={cn(
          'px-4 pt-content-top pb-20 md:pr-10 md:pl-content-left',
          // Same 300ms curve as the sidebar width and header offset — the three
          // move together or the reflow reads as a jump.
          'transition-[padding] duration-300',
          collapsed && 'md:pl-content-left-rail',
        )}
      >
        <Outlet />
      </main>
      <ApiLogDrawer />
    </div>
  )
}
