/**
 * Fixed sidebar, matched to /Reference/html_pages/sass/_sidebar.scss:
 *   260px wide, full height, #4D7AC4
 *   70px logo block at #446DAF with 4px letter-spacing
 *   list items 15px padding / 15px text, 4px transparent left-border
 *   hover + active → #4269A8 with a #3C3B54 left-border
 *   hidden below 767px, revealed as a drawer
 *
 * Items are derived from ROUTES and filtered by permission — never hand-listed.
 */

import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { canView } from '@/domain/permissions'

function NavItems() {
  const user = useAuthStore((s) => s.user)
  const permissions = useAuthStore((s) => s.permissions())
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  const visible = ROUTES.filter((r) => {
    if (!r.nav) return false
    if (r.adminOnly && user?.role !== 'administrator') return false
    return canView(permissions[r.module])
  })

  const main = visible.filter((r) => !r.navFooter)
  const footer = visible.filter((r) => r.navFooter)

  const item = (r: (typeof ROUTES)[number], isFirstFooter: boolean) => {
    const Icon = r.icon
    return (
      <li key={r.path} className={cn(isFirstFooter && 'mt-8')}>
        <NavLink
          to={r.path}
          end={r.path === '/'}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 border-l-4 px-[15px] py-[15px] text-[length:var(--text-body)] transition-colors',
              'border-l-who-sidebar hover:border-l-who-sidebar-accent hover:bg-who-sidebar-hover',
              isActive && 'border-l-who-sidebar-accent bg-who-sidebar-hover',
            )
          }
        >
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
          <span>{r.label}</span>
        </NavLink>
      </li>
    )
  }

  return (
    <ul className="list-none">
      {main.map((r) => item(r, false))}
      {footer.map((r, i) => item(r, i === 0))}
    </ul>
  )
}

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <>
      {/* Scrim, mobile only */}
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          // z-30: above the z-20 header, so opening the drawer dims the header
          // too rather than leaving it bright above the scrim.
          className="fixed inset-0 z-30 bg-who-scrim md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <nav
        aria-label="Main navigation"
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-sidebar overflow-y-auto bg-who-sidebar text-who-on-brand',
          'transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="absolute top-[10px] right-[10px] md:hidden"
        >
          <X className="size-5" />
        </button>

        <div className="flex h-header items-center bg-who-sidebar-logo px-6 text-[length:var(--text-body)] font-bold tracking-[4px]">
          HA DMS
        </div>

        <NavItems />
      </nav>
    </>
  )
}
