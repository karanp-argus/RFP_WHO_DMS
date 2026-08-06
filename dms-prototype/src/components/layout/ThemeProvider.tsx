/**
 * Theme provider.
 *
 * `next-themes` is framework-agnostic despite the name — it writes a `light` or
 * `dark` class onto <html> and persists the choice. It was already present as a
 * sonner dependency (src/components/ui/sonner.tsx calls useTheme); this mounts
 * the provider it was silently missing, so toasts follow the app theme rather
 * than the operating system's.
 *
 * defaultTheme is 'light', not 'system': a demo must open the same way on every
 * machine regardless of the presenter's OS setting. 'System' remains selectable.
 */

import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export const THEME_STORAGE_KEY = 'dms-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
