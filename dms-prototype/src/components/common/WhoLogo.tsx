/**
 * The WHO "World Health Organization" lockup (emblem + wordmark), copied
 * verbatim from /Reference/images/logo-{blue,white}.svg. Only the lying
 * `encoding="utf-16"` XML declaration was stripped — the bytes were ASCII, and
 * browsers reject the mismatch when the file is loaded through <img>.
 *
 * Two source files rather than one recoloured SVG: the reference ships both,
 * and `<img>` cannot reach inside the file to override `.cls-1 { fill }`.
 *
 * `variant` names the *surface* the logo sits on, not the theme:
 *   'auto'  — blue on light surfaces, white on dark. Swapped in CSS via the
 *             `.dark` class so there is no theme-hook flash on first paint.
 *   'white' — for a surface that is dark in BOTH themes. The sidebar is one:
 *             it stays WHO blue in dark mode (--who-sidebar-logo #446DAF light,
 *             #1A2B45 dark), so 'auto' would put the blue lockup on blue at
 *             1.51:1 — effectively invisible. White reads 5.2:1 / 14.2:1.
 *   'blue'  — for a surface that is light in both themes.
 */

import blueLogo from '@/assets/who-logo-blue.svg'
import whiteLogo from '@/assets/who-logo-white.svg'
import { cn } from '@/lib/utils'

const ALT = 'World Health Organization'

export function WhoLogo({
  variant = 'auto',
  className,
}: {
  variant?: 'auto' | 'blue' | 'white'
  className?: string
}) {
  if (variant !== 'auto') {
    return (
      <img
        src={variant === 'blue' ? blueLogo : whiteLogo}
        alt={ALT}
        className={className}
      />
    )
  }

  // Both are rendered; exactly one is displayed. The hidden one carries an
  // empty alt so screen readers announce the lockup once, not twice.
  return (
    <>
      <img src={blueLogo} alt={ALT} className={cn('dark:hidden', className)} />
      <img src={whiteLogo} alt="" aria-hidden className={cn('hidden dark:block', className)} />
    </>
  )
}

/**
 * The emblem alone, for spaces too narrow for the 3.26:1 lockup — the collapsed
 * sidebar rail is 70px wide, where the lockup would render 18px tall.
 *
 * Drawn as a mask over a token background rather than as an <img>, because
 * who-emblem.png ships in WHO blue only and the rail's surface is blue in both
 * themes. Masking keeps the colour in `bg-*` where the token rules can reach it
 * (CLAUDE.md: no hex outside globals.css); the inline style carries geometry,
 * not colour. Reuses the favicon copy in /public rather than a second asset.
 */
export function WhoEmblem({ className }: { className?: string }) {
  const mask = {
    maskImage: 'url(/who-emblem.png)',
    WebkitMaskImage: 'url(/who-emblem.png)',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  } as const

  return (
    <span
      role="img"
      aria-label={ALT}
      style={mask}
      className={cn('block bg-who-on-brand', className)}
    />
  )
}
