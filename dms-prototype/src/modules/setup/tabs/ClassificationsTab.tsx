/**
 * Classifications & Categories (UC013, UC014).
 *
 * The hierarchy is the point here, so this is a tree rather than a flat grid:
 * an HA user thinks in terms of `HF.1 → HF.1.2 → HF.1.2.1`, and a paginated
 * alphabetical list would destroy that.
 *
 * The reported/calculated distinction is surfaced explicitly, because it is the
 * single most important fact about the data model: parents and totals are never
 * country-reported, they are computed by the formula engine from their children.
 * Making that visible here sets up the Phase 3 demo beat.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Calculator, FileInput } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadingState, EmptyState } from '@/components/common/EmptyState'
import { downloadCsv } from '@/lib/exporters'
import { DIMENSION_LABELS, type DimensionCode } from '@/domain/constants'
import type { Variable } from '@/domain/types'
import { useClassifications, useVariables } from '@/hooks/useSetupData'
import { cn } from '@/lib/utils'

export function ClassificationsTab() {
  const { data: classifications, isLoading: loadingC } = useClassifications()
  const { data: variables, isLoading: loadingV } = useVariables()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['HF']))
  const [filter, setFilter] = useState('')

  const byDimension = useMemo(() => {
    const m = new Map<DimensionCode, Variable[]>()
    for (const v of variables ?? []) {
      if (v.dimension == null) continue
      const list = m.get(v.dimension)
      if (list) list.push(v)
      else m.set(v.dimension, [v])
    }
    return m
  }, [variables])

  const needle = filter.trim().toLowerCase()

  /** A dimension matches if its own code/label matches, or any of its variables. */
  function matches(v: Variable): boolean {
    if (!needle) return true
    return v.code.toLowerCase().includes(needle) || v.label.toLowerCase().includes(needle)
  }

  if (loadingC || loadingV) return <LoadingState label="Loading classifications from xMart…" />

  const rows = classifications ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search codes and labels, e.g. HF.1.2 or out-of-pocket"
          className="h-9 max-w-md"
        />
        {/* `flex-wrap` for the same reason as `DataTable`'s toolbar — see the
            note there. An unwrappable button group is what pushed Setup sideways
            at 768. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExpanded(
                expanded.size === rows.length ? new Set() : new Set(rows.map((c) => c.code)),
              )
            }
          >
            {expanded.size === rows.length ? 'Collapse all' : 'Expand all'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                (variables ?? []).map((v) => ({
                  DIMENSION: v.dimension ?? '',
                  CODE: v.code,
                  LABEL: v.label,
                  LEVEL: v.level,
                  PARENT: v.parentCode ?? '',
                  IS_CALCULATED: v.isCalculated ? 'Y' : 'N',
                  UNIT: v.unit,
                })),
                ['DIMENSION', 'CODE', 'LABEL', 'LEVEL', 'PARENT', 'IS_CALCULATED', 'UNIT'],
                'classifications',
              )
            }
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Legend — the reported/calculated split drives the whole formula story. */}
      <div className="flex flex-wrap gap-4 rounded border border-who-border bg-who-page-bg px-4 py-3 text-[length:var(--text-meta)] text-who-text-muted">
        <span className="flex items-center gap-1.5">
          <FileInput className="size-3.5 text-who-primary-blue" aria-hidden />
          Reported by countries
        </span>
        <span className="flex items-center gap-1.5">
          <Calculator className="size-3.5 text-who-warn" aria-hidden />
          Calculated — summed from children or derived by a formula, never reported
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((c) => {
          const vars = byDimension.get(c.code) ?? []
          const visible = vars.filter(matches)
          // When searching, auto-reveal any dimension that has a hit.
          const isOpen = needle ? visible.length > 0 : expanded.has(c.code)
          if (needle && visible.length === 0) return null

          return (
            <div key={c.code} className="overflow-hidden rounded border border-who-border">
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(c.code)) next.delete(c.code)
                    else next.add(c.code)
                    return next
                  })
                }
                className="flex w-full items-center gap-2 bg-who-surface px-3 py-2.5 text-left hover:bg-who-page-bg"
              >
                {isOpen ? (
                  <ChevronDown className="size-4 shrink-0 text-who-icon" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-who-icon" />
                )}
                <span className="font-mono text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                  {c.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-[length:var(--text-body-sm)] text-who-text">
                  {DIMENSION_LABELS[c.code]}
                </span>
                {!c.isIcha ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="shrink-0">
                        DMS
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Not an ICHA classification — maintained in DMS and sourced from the World
                      Bank, IMF and UN
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {visible.length}
                </Badge>
              </button>

              {isOpen ? (
                <div className="border-t border-who-border">
                  {visible.map((v) => (
                    <div
                      key={v.code}
                      className="flex items-center gap-2 border-b border-who-border/50 px-3 py-1.5 last:border-b-0"
                      // Indent by hierarchy level so the tree is legible.
                      style={{ paddingLeft: `${12 + (v.level - 1) * 20}px` }}
                    >
                      {v.isCalculated ? (
                        <Calculator className="size-3.5 shrink-0 text-who-warn" aria-label="Calculated" />
                      ) : (
                        <FileInput
                          className="size-3.5 shrink-0 text-who-primary-blue"
                          aria-label="Reported"
                        />
                      )}
                      <span
                        className={cn(
                          'w-36 shrink-0 font-mono text-[length:var(--text-meta)]',
                          v.isCalculated
                            ? 'font-semibold text-who-heading'
                            : 'text-who-text-muted',
                        )}
                      >
                        {v.code}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[length:var(--text-body-sm)]',
                          v.isCalculated ? 'text-who-heading' : 'text-who-text',
                        )}
                      >
                        {v.label}
                      </span>
                      <span className="hidden shrink-0 text-[length:var(--text-meta)] text-who-hint sm:block">
                        {v.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}

        {needle && rows.every((c) => (byDimension.get(c.code) ?? []).filter(matches).length === 0) ? (
          <EmptyState
            message="No classifications match"
            hint={`Nothing matched "${filter}". Try a code prefix such as HF or HC.`}
          />
        ) : null}
      </div>
    </div>
  )
}
