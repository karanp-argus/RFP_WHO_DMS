import { ModulePlaceholder } from '@/components/layout/ModulePlaceholder'

export function NotificationsPage() {
  return (
    <ModulePlaceholder
      title="Notifications"
      description="In-app notifications raised by DMS and xMart events."
      phase="Phase 7 — Users, dashboard, integration"
      useCases={['UC058', 'UC059']}
    />
  )
}
