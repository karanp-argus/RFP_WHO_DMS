/**
 * The xMart integration module (UC045, UC046, UC056) plus UC044's
 * dataset-level restore, which is an administrator action against the
 * warehouse and belongs here rather than bolted onto the grid.
 *
 * Tabs are URL-addressable and only the active one mounts — the same pattern
 * as Setup, Quality Checks and Reports. The restore tab in particular must not
 * mount speculatively: it holds a scan result that costs real work to produce.
 */

import { useSearchParams } from 'react-router-dom'
import { ModuleTabs, type ModuleTab } from '@/components/layout/ModuleTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { ApiLogTable, clearApiLog, useApiLog } from './ApiLogTable'
import { OverviewTab } from './tabs/OverviewTab'
import { DatasetRestoreTab } from './tabs/DatasetRestoreTab'

export function XMartStatusPage() {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') ?? 'overview'
  const calls = useApiLog()

  const tabs: ModuleTab[] = [
    { id: 'overview', label: 'Architecture and sync' },
    { id: 'log', label: 'API call log', count: calls.length },
    { id: 'restore', label: 'Dataset restore' },
  ]

  return (
    <>
      <PageHeader
        title="xMart Integration"
        description="DMS owns no master data. This is the boundary — what comes in, what goes back, and every call this session has made."
      />

      <ModuleTabs
        tabs={tabs}
        active={active}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />

      <div className="mt-5">
        {active === 'overview' ? <OverviewTab /> : null}
        {active === 'log' ? <ApiLogTable calls={calls} onClear={clearApiLog} /> : null}
        {active === 'restore' ? <DatasetRestoreTab /> : null}
      </div>
    </>
  )
}
