import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function WorkbookPage() {
  return (
    <ModulePlaceholder
      title="Workbook"
      description="Excel-like grid with formulas, copy/paste, undo and per-cell metadata."
      phase="Phase 4 — Workbook module"
      useCases={['UC031', 'UC052']}
    />
  )
}
