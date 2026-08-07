/**
 * Single source of truth for navigation.
 *
 * The sidebar, page titles and permission gates are all DERIVED from this
 * manifest — never hand-maintained alongside it. See PROTOTYPE_PLAN.md §4,
 * structural rule 3.
 *
 * ## Every page component is lazy (Phase 8 item 1)
 *
 * The single bundle was **2.11 MB / 636 kB gzipped** and Vite warned on it,
 * because `react-datasheet-grid`, SheetJS, Recharts, `@dnd-kit` and the pivot
 * engine all landed in one chunk with the sign-in screen. Splitting on the route
 * boundary is the natural cut: the shell plus the login screen is what a demo
 * loads first, and no module's dependencies reach the wire until the module is
 * opened.
 *
 * Three things keep this honest rather than a bundle-size trick:
 *
 *  · **`lazy()` is called at module scope, never in render.** A `lazy()` created
 *    inside a component returns a new component type every render, which
 *    remounts the page and throws away its state on every keystroke.
 *  · **The icons stay static.** They are a few hundred bytes each and they are
 *    needed by the sidebar *before* any page loads — importing them lazily would
 *    mean an empty sidebar on arrival.
 *  · **`Component` is still a `ComponentType`**, so `AppShell` renders the
 *    manifest unchanged and structural rule 3 holds. The Suspense boundary and
 *    the error boundary live there, once, around the `Outlet`.
 *
 * `LoginPage` is deliberately **not** lazy: it is the first paint, and a
 * skeleton before a sign-in screen buys nothing.
 */

import { lazy, type ComponentType } from 'react'
import { matchPath } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  BookOpen,
  FileSpreadsheet,
  Home,
  Plug,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleId } from '@/domain/permissions'

/*
 * Pages are named exports — `lazy()` wants a module whose `default` is the
 * component, so the named export is mapped onto `default` at the import. Adding a
 * default export to fifteen files instead would give every page two names and let
 * the two drift.
 */

// Recharts (dashboard sparklines + completeness heatmap).
const HomePage = lazy(() =>
  import('@/modules/home/HomePage').then((m) => ({ default: m.HomePage })),
)
// @dnd-kit (UC015 column reorder) + the whole seeded configuration.
const SetupPage = lazy(() =>
  import('@/modules/setup/SetupPage').then((m) => ({ default: m.SetupPage })),
)
// react-datasheet-grid + SheetJS + the formula engine — the heaviest module.
const WorkbookSelectPage = lazy(() =>
  import('@/modules/workbooks/WorkbookSelectPage').then((m) => ({ default: m.WorkbookSelectPage })),
)
const WorkbookPage = lazy(() =>
  import('@/modules/workbooks/WorkbookPage').then((m) => ({ default: m.WorkbookPage })),
)
// Recharts (outlier scatter) + SheetJS + the QC runner.
const QcListPage = lazy(() =>
  import('@/modules/quality/QcListPage').then((m) => ({ default: m.QcListPage })),
)
const QcRuleEditorPage = lazy(() =>
  import('@/modules/quality/QcRuleEditorPage').then((m) => ({ default: m.QcRuleEditorPage })),
)
const QcReportPage = lazy(() =>
  import('@/modules/quality/QcReportPage').then((m) => ({ default: m.QcReportPage })),
)
// @dnd-kit (pivot builder) + SheetJS + the pivot engine.
const ReportsListPage = lazy(() =>
  import('@/modules/reports/ReportsListPage').then((m) => ({ default: m.ReportsListPage })),
)
const ReportBuilderPage = lazy(() =>
  import('@/modules/reports/ReportBuilderPage').then((m) => ({ default: m.ReportBuilderPage })),
)
const ReportRunPage = lazy(() =>
  import('@/modules/reports/ReportRunPage').then((m) => ({ default: m.ReportRunPage })),
)
// PapaParse (Annex 3 CSV) + the architecture diagram.
const XMartStatusPage = lazy(() =>
  import('@/modules/integration/XMartStatusPage').then((m) => ({ default: m.XMartStatusPage })),
)
const RetrievalApiPage = lazy(() =>
  import('@/modules/integration/RetrievalApiPage').then((m) => ({ default: m.RetrievalApiPage })),
)
const UsersListPage = lazy(() =>
  import('@/modules/users/UsersListPage').then((m) => ({ default: m.UsersListPage })),
)
const RolePermissionsPage = lazy(() =>
  import('@/modules/users/RolePermissionsPage').then((m) => ({ default: m.RolePermissionsPage })),
)
const NotificationsPage = lazy(() =>
  import('@/modules/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)

export interface RouteDef {
  /** Path relative to the app shell. */
  path: string
  label: string
  /** Shown as the <h2> page title; falls back to `label`. */
  title?: string
  icon?: LucideIcon
  module: ModuleId
  Component: ComponentType
  /** Whether this appears in the sidebar. Detail routes do not. */
  nav: boolean
  /** Sidebar items pushed to the bottom group (reference: `li.mt-5`). */
  navFooter?: boolean
  /** Administrator-only entries (e.g. the UC008 permission matrix). */
  adminOnly?: boolean
}

export const ROUTES: RouteDef[] = [
  {
    path: '/',
    label: 'Home',
    title: 'Health Accounts DMS',
    icon: Home,
    module: 'home',
    Component: HomePage,
    nav: true,
  },
  {
    path: '/workbooks',
    label: 'Workbooks',
    icon: FileSpreadsheet,
    module: 'workbooks',
    Component: WorkbookSelectPage,
    nav: true,
  },
  {
    path: '/workbooks/view',
    label: 'Workbook',
    module: 'workbooks',
    Component: WorkbookPage,
    nav: false,
  },
  {
    path: '/quality-checks',
    label: 'Quality Checks',
    icon: ShieldCheck,
    module: 'quality',
    Component: QcListPage,
    nav: true,
  },
  {
    // `:ruleId` is `new` on the create path — one route rather than two, so the
    // editor cannot drift between creating and editing.
    path: '/quality-checks/rules/:ruleId',
    label: 'Quality check rule',
    module: 'quality',
    Component: QcRuleEditorPage,
    nav: false,
  },
  {
    path: '/quality-checks/reports/:runId',
    label: 'Quality check report',
    module: 'quality',
    Component: QcReportPage,
    nav: false,
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: BarChart3,
    module: 'reports',
    Component: ReportsListPage,
    nav: true,
  },
  {
    // `:reportId` is the report being laid out. One route for creating and
    // editing, so the builder cannot drift between the two.
    path: '/reports/builder/:reportId',
    label: 'Report builder',
    module: 'reports',
    Component: ReportBuilderPage,
    nav: false,
  },
  {
    path: '/reports/run/:reportId',
    label: 'Run report',
    module: 'reports',
    Component: ReportRunPage,
    nav: false,
  },
  {
    path: '/setup',
    label: 'Setup',
    icon: BookOpen,
    module: 'setup',
    Component: SetupPage,
    nav: true,
  },
  {
    path: '/users',
    label: 'Users',
    icon: Users,
    module: 'users',
    Component: UsersListPage,
    nav: true,
  },
  {
    // Not `adminOnly`: UC007 keeps view access on every module for a regular
    // user, and seeing the matrix that governs your own access is exactly the
    // sort of thing it protects. Only the Edit button is administrator-gated,
    // and the page handles that itself.
    path: '/users/role-permissions',
    label: 'Role Permissions',
    module: 'users',
    Component: RolePermissionsPage,
    nav: false,
  },
  {
    path: '/notifications',
    label: 'Notifications',
    icon: Bell,
    module: 'notifications',
    Component: NotificationsPage,
    nav: true,
  },
  {
    path: '/integration',
    label: 'xMart Integration',
    title: 'xMart Integration',
    icon: Plug,
    module: 'integration',
    Component: XMartStatusPage,
    nav: true,
    navFooter: true,
  },
  {
    path: '/integration/retrieval-api',
    label: 'Data Retrieval API',
    icon: Settings,
    module: 'integration',
    Component: RetrievalApiPage,
    nav: true,
    navFooter: true,
  },
]

/**
 * Title for a *concrete* pathname, not a route pattern.
 *
 * `matchPath` rather than an equality test, because four routes carry parameters
 * (`/reports/run/:reportId`, `/quality-checks/rules/:ruleId`, …) and an exact
 * comparison silently falls through to the app name for all of them — which is
 * how the error boundary came to label a failed report run "Health Accounts DMS".
 */
export function routeTitle(path: string): string {
  const r = ROUTES.find((x) => matchPath(x.path, path) != null)
  return r?.title ?? r?.label ?? 'Health Accounts DMS'
}
