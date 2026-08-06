import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function ReportsListPage() {
  return (
    <ModulePlaceholder
      title="Reports"
      description="Predefined and custom reports, plus data submission tracking."
      phase="Phase 6 — Reports module"
      useCases={['UC035', 'UC036', 'UC039', 'UC042', 'UC037', 'UC038', 'UC040']}
    />
  )
}
