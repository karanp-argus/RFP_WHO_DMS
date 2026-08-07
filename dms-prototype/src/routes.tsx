/**
 * Single source of truth for navigation.
 *
 * The sidebar, page titles and permission gates are all DERIVED from this
 * manifest — never hand-maintained alongside it. See PROTOTYPE_PLAN.md §4,
 * structural rule 3.
 */

import type { ComponentType } from 'react'
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

import { HomePage } from '@/modules/home/HomePage'
import { UsersListPage } from '@/modules/users/UsersListPage'
import { RolePermissionsPage } from '@/modules/users/RolePermissionsPage'
import { SetupPage } from '@/modules/setup/SetupPage'
import { WorkbookSelectPage } from '@/modules/workbooks/WorkbookSelectPage'
import { WorkbookPage } from '@/modules/workbooks/WorkbookPage'
import { ReportsListPage } from '@/modules/reports/ReportsListPage'
import { ReportBuilderPage } from '@/modules/reports/ReportBuilderPage'
import { ReportRunPage } from '@/modules/reports/ReportRunPage'
import { QcListPage } from '@/modules/quality/QcListPage'
import { QcRuleEditorPage } from '@/modules/quality/QcRuleEditorPage'
import { QcReportPage } from '@/modules/quality/QcReportPage'
import { NotificationsPage } from '@/modules/notifications/NotificationsPage'
import { XMartStatusPage } from '@/modules/integration/XMartStatusPage'
import { RetrievalApiPage } from '@/modules/integration/RetrievalApiPage'

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

export function routeTitle(path: string): string {
  const r = ROUTES.find((x) => x.path === path)
  return r?.title ?? r?.label ?? 'Health Accounts DMS'
}
