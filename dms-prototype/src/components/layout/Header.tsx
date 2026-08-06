/**
 * Fixed header, matched to /Reference/html_pages/sass/_layout.scss:
 *   70px tall, white, offset by the 260px sidebar, shadow 0 2px 4px rgba(0,0,0,.4)
 *   rounded search input on the left (20px radius, 1px #A4AFB7, inset icon)
 *   icon row on the right in #BCBCCB
 *   name/role block with a ::before vertical divider and a 38px round avatar
 *
 * The role switcher is a prototype affordance, not a product feature — it
 * stands in for signing out and back in as a different user, and drives the
 * UC007/UC008 permission demo.
 */

import { Bell, ChevronDown, HelpCircle, Menu, RotateCcw, Search, Terminal } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { resetDemoData } from '@/data/db'
import { ThemeToggle } from './ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

export function Header() {
  const user = useAuthStore((s) => s.user)
  const switchRole = useAuthStore((s) => s.switchRole)
  const signOut = useAuthStore((s) => s.signOut)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  // Only for the left offset — the collapse control itself lives on the
  // sidebar's edge, in Sidebar.tsx.
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleDevDrawer = useUiStore((s) => s.toggleDevDrawer)

  return (
    <header
      className={cn(
        // z-20: must stay below the z-50 Radix portal layer, or the header
        // clips the top of every dropdown opened from it. See globals.css.
        'fixed top-0 right-0 z-20 flex h-header items-center bg-who-surface',
        'left-0 md:left-sidebar',
        'px-4 md:pr-6 md:pl-[30px]',
        // Same 300ms curve as the sidebar's width, so the header edge tracks
        // the rail rather than snapping ahead of it.
        'transition-[left] duration-300',
        collapsed && 'md:left-sidebar-rail',
        'shadow-who-header',
      )}
    >
      <button
        type="button"
        aria-label="Open navigation"
        onClick={toggleSidebar}
        className="mr-3 text-who-text md:hidden"
      >
        <Menu className="size-6" />
      </button>

      {/* Search — decorative in Phase 0; wired to global search in a later phase. */}
      <div className="relative hidden w-full max-w-[280px] md:block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-who-icon" />
        <input
          type="search"
          placeholder="Search"
          aria-label="Search"
          className="h-9 w-full rounded-[20px] border border-who-hint pr-3 pl-10 text-[length:var(--text-body-sm)] text-who-text placeholder:text-who-icon focus:border-who-primary-blue focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="xMart API call log"
              onClick={toggleDevDrawer}
              className="p-2 text-who-icon transition-colors hover:text-who-primary-blue"
            >
              <Terminal className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent>xMart API call log</TooltipContent>
        </Tooltip>

        <ThemeToggle />

        <button
          type="button"
          aria-label="Help"
          className="p-2 text-who-icon transition-colors hover:text-who-primary-blue"
        >
          <HelpCircle className="size-[18px]" />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 text-who-icon transition-colors hover:text-who-primary-blue"
        >
          <Bell className="size-[18px]" />
        </button>

        {/* Name / role block. The reference draws a 1px × 30px divider to its
            left via ::before; here it is an explicit element. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative ml-3 flex items-center gap-2 pl-4 text-left before:absolute before:top-1/2 before:left-0 before:h-[30px] before:w-px before:-translate-y-1/2 before:bg-who-icon before:content-['']"
            >
              {/* Hidden below lg, not sm: at the md boundary the sidebar returns
                  while the header is at its narrowest, and the two-line name/role
                  block wraps past the 70px header height. */}
              <span className="hidden text-[length:var(--text-body-sm)] leading-tight whitespace-nowrap text-who-text lg:block">
                {user?.displayName}
                <span className="block text-who-text-muted">{user?.jobTitle}</span>
              </span>
              <ChevronDown className="size-3 shrink-0 text-who-text" />
              <span className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-who-sidebar text-[length:var(--text-body-sm)] font-semibold text-who-on-brand">
                {user ? initials(user.displayName) : ''}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <span className="block font-semibold text-who-heading">{user?.displayName}</span>
              <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
              Demo: view as
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => switchRole('administrator')}
              className={cn(user?.role === 'administrator' && 'font-semibold')}
            >
              Administrator
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => switchRole('regular')}
              className={cn(user?.role === 'regular' && 'font-semibold')}
            >
              Regular user
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                // Seeded observations are derived, not stored, so a reset only
                // has to drop the edit overlay — see data/db.ts.
                resetDemoData()
                window.location.reload()
              }}
            >
              <RotateCcw className="size-4" />
              Reset demo data
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
