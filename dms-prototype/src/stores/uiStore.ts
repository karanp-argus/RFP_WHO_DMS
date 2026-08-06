import { create } from 'zustand'

interface UiState {
  /** Mobile sidebar drawer (reference: collapses below 767px). */
  sidebarOpen: boolean
  /** The xMart API call log drawer — PROTOTYPE_PLAN.md §5 Phase 7.4. */
  devDrawerOpen: boolean
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  toggleDevDrawer: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  devDrawerOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDevDrawer: () => set((s) => ({ devDrawerOpen: !s.devDrawerOpen })),
}))
