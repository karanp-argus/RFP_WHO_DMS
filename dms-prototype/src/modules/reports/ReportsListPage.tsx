/**
 * Reports module (UC035).
 *
 * *"As a Regular user, I need DMS to have a Reports module, where reports can
 * be created, edited or deleted, viewed and exported ... User can view reports
 * grouped into a) Predefined and Custom reports and b) Data Tracking Report."*
 *
 * That grouping is the tab split, with a third for the UC042 background queue —
 * a job needs somewhere to be watched while it runs and somewhere for the
 * notification's link to land. Tabs are URL-addressable and only the active one
 * mounts, the same pattern as Setup and Quality Checks: the data tracking tab
 * fires an xMart query on arrival and there is no reason for it to do that when
 * somebody opened the report list.
 */

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModuleTabs, type ModuleTab } from '@/components/layout/ModuleTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermissions } from '@/hooks/usePermissions'
import { allReports, useReportStore, visibleReports } from '@/stores/reportStore'
import { ReportsTab } from './tabs/ReportsTab'
import { DataTrackingTab } from './tabs/DataTrackingTab'
import { JobsTab } from './tabs/JobsTab'

export function ReportsListPage() {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') ?? 'reports'
  const { user, canCreatePredefined } = usePermissions()

  const definitionEdits = useReportStore((s) => s.definitionEdits)
  const removedIds = useReportStore((s) => s.removedIds)
  const jobs = useReportStore((s) => s.jobs)

  const reportCount = useMemo(
    () => visibleReports(allReports(definitionEdits, removedIds), user?.email).length,
    [definitionEdits, removedIds, user?.email],
  )

  const tabs: ModuleTab[] = [
    { id: 'reports', label: 'Predefined and custom', count: reportCount },
    { id: 'data-tracking', label: 'Data tracking' },
    { id: 'jobs', label: 'Background jobs', count: jobs.length },
  ]

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          canCreatePredefined('reports')
            ? 'Build a report the way an Excel pivot table is built — rows, columns, values, filters and groupings — and save it for everyone to run. Reports you create are predefined and shared; a regular user’s are custom and private to them.'
            : 'Run any predefined report over the countries, variables and years you need, in the unit, currency and scale you want. Reports you build yourself stay private to you.'
        }
      />

      <ModuleTabs
        tabs={tabs}
        active={active}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />

      <div className="mt-5">
        {active === 'reports' ? <ReportsTab /> : null}
        {active === 'data-tracking' ? <DataTrackingTab /> : null}
        {active === 'jobs' ? <JobsTab /> : null}
      </div>
    </>
  )
}
