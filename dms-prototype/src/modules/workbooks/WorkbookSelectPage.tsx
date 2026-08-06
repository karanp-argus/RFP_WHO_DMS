import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function WorkbookSelectPage() {
  return (
    <ModulePlaceholder
      title="Workbooks"
      description="Select a country, variables and years to open a workbook. Exactly one axis may be single-valued."
      phase="Phase 4 — Workbook module"
      useCases={['UC031', 'UC024', 'UC043', 'UC044', 'UC046', 'UC032', 'UC033', 'UC034']}
    />
  )
}
