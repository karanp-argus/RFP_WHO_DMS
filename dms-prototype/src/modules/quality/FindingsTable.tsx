/**
 * The findings table — the thing a reviewer actually works from.
 *
 * Columns are the ones PROTOTYPE_PLAN names for the report: country, year,
 * variable, rule, expected, actual, deviation, severity. Two more earn their
 * place beside them:
 *
 *  · **The note**, which for a seeded defect is the sentence someone wrote
 *    about why the data looks like that. A finding that cannot be explained is
 *    a finding that gets argued about rather than fixed.
 *  · **Open**, which links straight to the workbook positioned on the offending
 *    cell. A quality report whose findings you have to go and look up by hand
 *    is a list of complaints; one you can act on from is a tool.
 *
 * Built on the shared `DataTable`, so sorting, search, column reordering,
 * paging and CSV export come from the same component as Setup and Users rather
 * than being rebuilt with slightly different behaviour.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTable } from '@/components/common/DataTable'
import { QC_DEVIATION_UNITS, type QcFinding } from '@/domain/qc'
import { selectionToSearchParams } from '@/domain/workbook'
import { BLANK } from '@/lib/format'
import { RuleOriginBadge, SeverityBadge } from './QcBadges'

/** Format a deviation with the unit its rule type measures in. */
export function formatDeviation(finding: QcFinding): string {
  const magnitude = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: Math.abs(finding.deviation) >= 100 ? 0 : 1,
  }).format(finding.deviation)

  switch (finding.deviationUnit) {
    case 'percent':
      return `${magnitude}%`
    case 'years':
      return `${magnitude} yr`
    case 'sigma':
      return `${magnitude}σ`
    case 'score':
      return magnitude
    default:
      return magnitude
  }
}

function formatNumber(value: number | null): string {
  if (value == null) return BLANK
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value)
}

/**
 * A link that opens the finding's cell in a country workbook.
 *
 * The selection is a country workbook covering the finding's variable across
 * every year of the run, rather than a single cell: arriving on one isolated
 * value with no series around it tells a reviewer nothing about whether the
 * rule was right.
 */
export function workbookHrefFor(finding: QcFinding, yearFrom: number, yearTo: number): string {
  const years: number[] = []
  for (let y = yearFrom; y <= yearTo; y++) years.push(y)
  const params = selectionToSearchParams(
    { countries: [finding.iso3], variables: [finding.code], years, filters: [] },
    'country',
  )
  return `/workbooks/view?${params.toString()}`
}

export interface FindingsTableProps {
  findings: readonly QcFinding[]
  yearFrom: number
  yearTo: number
  onExport?: (rows: readonly QcFinding[]) => void
  pageSize?: number
}

export function FindingsTable({
  findings,
  yearFrom,
  yearTo,
  onExport,
  pageSize = 25,
}: FindingsTableProps) {
  const columns = useMemo<ColumnDef<QcFinding, unknown>[]>(
    () => [
      {
        id: 'severity',
        header: 'Status',
        accessorFn: (f) => f.severity,
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        id: 'country',
        header: 'Country',
        accessorFn: (f) => `${f.iso3} ${f.countryName}`,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="font-mono text-[length:var(--text-meta)]">{row.original.iso3}</span>
            <span className="ml-2">{row.original.countryName}</span>
          </span>
        ),
      },
      {
        id: 'year',
        header: 'Year',
        accessorFn: (f) => f.year,
        cell: ({ row }) => <span className="tabular-nums">{row.original.year}</span>,
      },
      {
        id: 'variable',
        header: 'Variable',
        accessorFn: (f) => `${f.code} ${f.variableLabel}`,
        cell: ({ row }) => (
          <span className="block max-w-56">
            <span className="block font-mono text-[length:var(--text-meta)]">
              {row.original.code}
            </span>
            <span className="block truncate text-who-text-muted" title={row.original.variableLabel}>
              {row.original.variableLabel}
            </span>
          </span>
        ),
      },
      {
        id: 'rule',
        header: 'Rule',
        accessorFn: (f) => f.ruleName,
        cell: ({ row }) => (
          <span className="block max-w-64 space-y-1">
            <span className="block truncate" title={row.original.ruleName}>
              {row.original.ruleName}
            </span>
            {/* UC053 — the origin travels with the finding, not just the rule
                list, so a reviewer disputing a finding can see at a glance
                whether they are arguing with the product or with a colleague. */}
            <RuleOriginBadge origin={row.original.ruleOrigin} />
          </span>
        ),
      },
      {
        id: 'expected',
        header: 'Expected',
        accessorFn: (f) => f.expected,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.expected)}</span>
        ),
      },
      {
        id: 'actual',
        header: 'Actual',
        accessorFn: (f) => f.actual,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.actual)}</span>
        ),
      },
      {
        id: 'deviation',
        header: 'Deviation',
        accessorFn: (f) => f.deviation,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="tabular-nums font-semibold">{formatDeviation(row.original)}</span>
            </TooltipTrigger>
            <TooltipContent>{QC_DEVIATION_UNITS[row.original.ruleType].hint}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        id: 'message',
        header: 'What was found',
        accessorFn: (f) => `${f.message} ${f.note ?? ''}`,
        cell: ({ row }) => (
          <span className="block max-w-lg">
            <span className="block text-who-text">{row.original.message}</span>
            {row.original.note ? (
              <span className="mt-0.5 block border-l-2 border-who-border pl-2 text-[length:var(--text-meta)] text-who-text-muted italic">
                {row.original.note}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon" className="size-7">
                <Link
                  to={workbookHrefFor(row.original, yearFrom, yearTo)}
                  aria-label={`Open ${row.original.iso3} ${row.original.code} in a workbook`}
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open this series in a workbook</TooltipContent>
          </Tooltip>
        ),
      },
    ],
    [yearFrom, yearTo],
  )

  return (
    <DataTable<QcFinding>
      data={findings}
      columns={columns}
      searchPlaceholder="Search findings by country, variable, rule or text…"
      pageSize={pageSize}
      getRowId={(f) => f.id}
      emptyMessage="No findings match the current filters."
      {...(onExport ? { onExport, exportLabel: 'Download CSV' } : {})}
    />
  )
}
