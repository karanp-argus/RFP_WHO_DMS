import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  /** Mobile sidebar drawer (reference: collapses below 767px). */
  sidebarOpen: boolean
  /** Desktop rail mode — icon-only sidebar at --spacing-sidebar-rail. */
  sidebarCollapsed: boolean
  /** The xMart API call log drawer — PROTOTYPE_PLAN.md §5 Phase 7.4. */
  devDrawerOpen: boolean
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  toggleSidebarCollapsed: () => void
  toggleDevDrawer: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      devDrawerOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleDevDrawer: () => set((s) => ({ devDrawerOpen: !s.devDrawerOpen })),
    }),
    {
      name: 'dms-ui',
      // Only the rail preference survives a reload. `sidebarOpen` and
      // `devDrawerOpen` are transient — restoring them would reopen a drawer
      // over the page on arrival, which is never what the user meant.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
