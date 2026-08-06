/**
 * Quality Checks module (UC047).
 *
 * *"As a regular user, I need DMS to have a module to manage the quality checks
 * of the data, so that I can view, create, run and export quality check rules
 * and their reports."*
 *
 * Three tabs, following the same pattern as Setup: URL-addressable so a
 * particular view is a shareable link, and only the active one mounted — the
 * reports tab reads the store and the rules tab does not fetch at all, but the
 * habit is what stops the third tab that does from firing a query nobody asked
 * for.
 */

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModuleTabs, type ModuleTab } from '@/components/layout/ModuleTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermissions } from '@/hooks/usePermissions'
import { allRules, useQcStore, visibleRules } from '@/stores/qcStore'
import { RulesTab } from './tabs/RulesTab'
import { ThresholdsTab } from './tabs/ThresholdsTab'
import { ReportsTab } from './tabs/ReportsTab'

export function QcListPage() {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') ?? 'rules'
  const { user, isAdmin } = usePermissions()

  const ruleEdits = useQcStore((s) => s.ruleEdits)
  const removedRuleIds = useQcStore((s) => s.removedRuleIds)
  const runs = useQcStore((s) => s.runs)

  const ruleCount = useMemo(
    () => visibleRules(allRules(ruleEdits, removedRuleIds), user?.email, isAdmin).length,
    [ruleEdits, removedRuleIds, user?.email, isAdmin],
  )

  const tabs: ModuleTab[] = [
    { id: 'rules', label: 'Rules', count: ruleCount },
    { id: 'thresholds', label: 'Thresholds' },
    { id: 'reports', label: 'Reports', count: runs.length },
  ]

  return (
    <>
      <PageHeader
        title="Quality Checks"
        description={
          isAdmin
            ? 'Run the delivered checks over a country or a group, tune what counts as a failure, and read the reports. Rules you create are visible to everyone; rules a regular user creates are private to them.'
            : 'Run the quality checks over a country or a group and read the reports. You can create your own rules, which stay private to you.'
        }
      />

      <ModuleTabs
        tabs={tabs}
        active={active}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />

      <div className="mt-5">
        {active === 'rules' ? <RulesTab /> : null}
        {active === 'thresholds' ? <ThresholdsTab /> : null}
        {active === 'reports' ? <ReportsTab /> : null}
      </div>
    </>
  )
}
