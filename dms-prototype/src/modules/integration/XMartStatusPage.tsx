import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function XMartStatusPage() {
  return (
    <ModulePlaceholder
      title="xMart Integration"
      description="Data flow between DMS and xMart, per-source sync status, and the API call log."
      phase="Phase 7 — Users, dashboard, integration"
      useCases={['UC045', 'UC046', 'UC056']}
    />
  )
}
