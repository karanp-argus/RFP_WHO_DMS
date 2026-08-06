/**
 * Fixed sidebar, matched to /Reference/html_pages/sass/_sidebar.scss:
 *   260px wide, full height, #4D7AC4
 *   70px logo block at #446DAF — the reference's letter-spaced wordmark is
 *     replaced by the WHO lockup over a "Data Management System" caption
 *   list items 15px padding / 15px text, 4px transparent left-border
 *   hover + active → #4269A8 with a #3C3B54 left-border
 *   hidden below 767px, revealed as a drawer
 *
 * Three states, which is why the class lists are `md:`-qualified rather than
 * plain:
 *   < 768px  `sidebarOpen`      — off-canvas drawer, always the full 260px.
 *                                 The rail never applies: a 70px drawer would
 *                                 be all cost, no benefit.
 *   ≥ 768px  `sidebarCollapsed` — 70px icon-only rail. Persisted (uiStore).
 *   ≥ 768px  `peeking`          — the rail under the pointer, temporarily back
 *                                 at 260px. Deliberately NOT in the store: the
 *                                 header and content must not reflow for a
 *                                 hover, so the peeked sidebar floats over them
 *                                 (hence the shadow) and nothing else moves.
 *
 * Items are derived from ROUTES and filtered by permission — never hand-listed.
 */

import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WhoEmblem, WhoLogo } from '@/components/common/WhoLogo'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ROUTES } from '@/routes'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { canView } from '@/domain/permissions'

/** True when the sidebar is showing labels: expanded, or a rail being peeked. */
function NavItems({ railed }: { railed: boolean }) {
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

    const link = (
      <NavLink
        to={r.path}
        end={r.path === '/'}
        onClick={() => setSidebarOpen(false)}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 border-l-4 px-[15px] py-[15px] text-[length:var(--text-body)] transition-colors',
            'border-l-who-sidebar hover:border-l-who-sidebar-accent hover:bg-who-sidebar-hover',
            isActive && 'border-l-who-sidebar-accent bg-who-sidebar-hover',
            // Rail: pr matches the 4px left border, so the icon lands on the
            // true 35px centre of the 70px rail rather than 2px right of it.
            railed && 'md:justify-center md:px-0 md:pr-[4px]',
          )
        }
      >
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        <span className={cn('whitespace-nowrap', railed && 'md:hidden')}>{r.label}</span>
      </NavLink>
    )

    return (
      <li key={r.path} className={cn(isFirstFooter && 'mt-8')}>
        {railed ? (
          // The label is the only thing the rail removes, so it has to come
          // back. A pointer gets it from the peek; this covers the keyboard,
          // which deliberately does not peek — tabbing should not throw a
          // 260px panel over the page. Gone during a peek, where the real
          // labels are already on screen.
          //
          // The trigger is a wrapper span, NOT the NavLink via `asChild`:
          // Radix's Slot merges className by string-joining, and NavLink's
          // className is a *function*. asChild stringifies it into the class
          // attribute, and the item silently loses every style it has.
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">{link}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="hidden md:block">
              {r.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          link
        )}
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
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const [peeking, setPeeking] = useState(false)

  // Showing icons only. A peek suspends it without clearing the preference.
  const railed = collapsed && !peeking
  // Where the sidebar's right edge currently is — the toggle rides it.
  const atRail = collapsed && !peeking

  return (
    <>
      {/* Scrim, mobile only. Outside the peek wrapper: it covers the viewport,
          so hovering it would otherwise count as hovering the sidebar. */}
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

      {/* Both fixed children live in one wrapper so travelling between the bar
          and its edge toggle never reads as a mouse-leave. The wrapper has no
          box of its own; it only catches the bubbled enter/leave. */}
      <div
        onMouseEnter={() => collapsed && setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
      >
        <nav
          aria-label="Main navigation"
          className={cn(
            'fixed top-0 left-0 z-40 h-screen w-sidebar overflow-x-hidden overflow-y-auto bg-who-sidebar text-who-on-brand',
            // Width animates on the same 300ms curve as the header offset and
            // content padding, so a collapse reads as one motion.
            'transition-[transform,width] duration-300 md:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            // Narrowing is expressed by ADDING the rail width, never by adding a
            // competing `md:w-sidebar` back on top: two md:w-* utilities on one
            // element are resolved by stylesheet order, not by the order they
            // are passed to cn(), and the rail wins that race.
            railed && 'md:w-sidebar-rail',
            // A peek floats over the header and content rather than reflowing
            // them, so it needs a shadow to read as a layer rather than a jump.
            peeking && 'md:shadow-who-card',
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

          {/* The reference's 70px logo block, kept at 70px so it stays flush
              with the fixed header. The lockup is forced to the white variant:
              this block is WHO blue in light AND dark, so the blue lockup would
              sit at 1.51:1 on it. See WhoLogo. */}
          <div className="flex h-header flex-col items-center justify-center gap-[10px] bg-who-sidebar-logo px-3">
            <WhoLogo variant="white" className={cn('h-[38px] w-auto', railed && 'md:hidden')} />
            <span
              className={cn(
                'text-[length:var(--text-body-sm)] leading-none font-semibold tracking-[1px] whitespace-nowrap uppercase',
                railed && 'md:hidden',
              )}
            >
              Data Management System
            </span>
            {/* Rail only: the lockup is 3.26:1 and would render 18px tall at 70px. */}
            <WhoEmblem className={cn('hidden size-[34px]', railed && 'md:block')} />
          </div>

          <NavItems railed={railed} />
        </nav>

        {/* Collapse toggle, straddling the sidebar's right edge at the 70px seam
            where the logo block and the header both end. It sits on the thing it
            moves and points the way it will go, which the previous header slot
            did not. Rendered as a sibling of <nav>, not a child: the bar clips
            its own overflow, and a button on the edge is half outside it.
            z-40 with the bar, above it by DOM order — never ≥50, which is the
            Radix portal layer (see globals.css). */}
        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
          className={cn(
            'fixed top-[58px] z-40 hidden size-6 -translate-x-1/2 items-center justify-center md:flex',
            'rounded-full border border-who-border bg-who-surface text-who-text shadow-who-card',
            'transition-[left,color] duration-300 hover:text-who-primary-blue',
            atRail ? 'left-sidebar-rail' : 'left-sidebar',
          )}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </div>
    </>
  )
}
