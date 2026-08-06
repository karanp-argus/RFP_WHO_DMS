/**
 * Setup module (UC013).
 *
 * "As an administrator user, I need DMS to have a module to manage data
 * components like Countries, Currencies, Classifications and Categories, Crosses,
 * Metadata and Formulas ... Any user will be able to view the values and setup of
 * all these components. Only administrators will be able to create and edit."
 *
 * The tab set is those six components plus Reporting follow-up, which UC023
 * explicitly places in this module ("Regular user connects to DMS, Setup module
 * and selects Countries").
 *
 * Layout follows the reference page pattern: <h2> title → pill tabs with a 3px
 * blue active underline → content. The active tab is held in the URL so a
 * particular Setup view is a shareable link.
 */

import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleTabs, type ModuleTab } from '@/components/layout/ModuleTabs'
import { ComponentGrid } from './ComponentGrid'
import { ClassificationsTab } from './tabs/ClassificationsTab'
import { CrossesTab } from './tabs/CrossesTab'
import { FormulasTab } from './tabs/FormulasTab'
import { MetadataTab } from './tabs/MetadataTab'
import { ReportingFollowUpTab } from './tabs/ReportingFollowUpTab'
import { COUNTRY_ATTRIBUTES } from '@/data/seed/countries'
import { CURRENCY_ATTRIBUTES } from '@/data/seed/currencies'
import { useCountries, useCurrencies } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'
import type { Country, Currency } from '@/domain/types'

const TABS: ModuleTab[] = [
  { id: 'countries', label: 'Countries' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'classifications', label: 'Classifications' },
  { id: 'crosses', label: 'Crosses' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'reporting', label: 'Reporting follow-up' },
]

function CountriesTab() {
  const { data, isLoading } = useCountries()
  return (
    <ComponentGrid<Country & Record<string, unknown>>
      component="countries"
      label="Countries"
      singular="country"
      rows={data as readonly (Country & Record<string, unknown>)[] | undefined}
      isLoading={isLoading}
      seededAttributes={COUNTRY_ATTRIBUTES}
      idKey="CODE_ISO_3"
      provenance="Imported from the xMart Country/Area List (UC014). Field names match the warehouse columns exactly."
    />
  )
}

function CurrenciesTab() {
  const { data, isLoading } = useCurrencies()
  return (
    <ComponentGrid<Currency & Record<string, unknown>>
      component="currencies"
      label="Currencies"
      singular="currency"
      rows={data as readonly (Currency & Record<string, unknown>)[] | undefined}
      isLoading={isLoading}
      seededAttributes={CURRENCY_ATTRIBUTES}
      idKey="CODE_ISO_3"
      provenance="Imported from the xMart Currency List (UC014). Decimal places drive value formatting in workbooks and reports."
    />
  )
}

export function SetupPage() {
  const [params, setParams] = useSearchParams()
  const { isAdmin } = usePermissions()
  const active = params.get('tab') ?? 'countries'

  return (
    <>
      <PageHeader
        title="Setup"
        description={
          isAdmin
            ? 'Manage the data components DMS shares with xMart. Values you create or edit are sent back to the warehouse.'
            : 'View the data components DMS shares with xMart. Administrators maintain these values.'
        }
      />

      <ModuleTabs
        tabs={TABS}
        active={active}
        onChange={(id) => {
          // `replace` so tab switching does not fill the browser history.
          setParams({ tab: id }, { replace: true })
        }}
      />

      <div className="mt-5">
        {active === 'countries' ? <CountriesTab /> : null}
        {active === 'currencies' ? <CurrenciesTab /> : null}
        {active === 'classifications' ? <ClassificationsTab /> : null}
        {active === 'crosses' ? <CrossesTab /> : null}
        {active === 'metadata' ? <MetadataTab /> : null}
        {active === 'formulas' ? <FormulasTab /> : null}
        {active === 'reporting' ? <ReportingFollowUpTab /> : null}
      </div>
    </>
  )
}
