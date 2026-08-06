import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function QcListPage() {
  return (
    <ModulePlaceholder
      title="Quality Checks"
      description="View, create, run and export quality check rules, and read their reports."
      phase="Phase 5 — Quality Checks module"
      useCases={['UC047', 'UC048', 'UC050', 'UC052', 'UC053', 'UC054', 'UC055']}
    />
  )
}
