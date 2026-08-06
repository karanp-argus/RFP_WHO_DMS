import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function UsersListPage() {
  return (
    <ModulePlaceholder
      title="Users"
      description="Manage access to DMS, assign roles, and enable or disable accounts. Users are never deleted."
      phase="Phase 7 — Users, dashboard, integration"
      useCases={['UC004', 'UC005', 'UC007', 'UC012', 'UC010', 'UC011']}
    />
  )
}
