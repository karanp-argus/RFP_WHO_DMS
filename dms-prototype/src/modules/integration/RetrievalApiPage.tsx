import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function RetrievalApiPage() {
  return (
    <ModulePlaceholder
      title="Data Retrieval API"
      description="Simulate the Annex 3 retrieval API that xMart calls to pull data from DMS."
      phase="Phase 7 — Users, dashboard, integration"
      useCases={['Annex 3', 'UC045']}
    />
  )
}
