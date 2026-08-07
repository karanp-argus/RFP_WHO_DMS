/**
 * Esc closes a panel that is not a Radix overlay.
 *
 * Phase 8 item 3 asks that Esc close *every* drawer and dialog. Radix already
 * does this for `Dialog`, `Sheet`, `Popover`, `Select` and `DropdownMenu`, so the
 * gap is the two panels that are deliberately **not** portals — the workbook's
 * metadata drawer and its QC findings panel, both flex siblings of the grid so
 * that opening them cannot lose your place in the data (plan §2.4).
 *
 * Two details that make this behave the way a user expects:
 *
 *  · **Registered on `document` in the bubble phase.** A Radix overlay opened on
 *    top of the panel stops Esc propagating (it closes itself and calls
 *    `preventDefault`), so a dropdown inside the drawer closes first and the
 *    drawer survives — which is the correct nesting order. Capture phase would
 *    invert it and close the drawer out from under the open dropdown.
 *  · **Ignored while a text field holds focus and carries a draft edit.** In the
 *    metadata drawer, Esc in a textarea should abandon the field, not the panel.
 *    That is the caller's decision, so it is exposed as `enabled` rather than
 *    guessed here.
 */

import { useEffect } from 'react'

export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, onEscape])
}
