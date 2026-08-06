/**
 * Filter chips — plan §2.4's first replacement.
 *
 * The legacy DMS carries a permanent row of dropdowns (Countries / Language /
 * Scale / Show contacts) that eats vertical space whether or not it is in use,
 * on a screen whose whole purpose is to show as much grid as possible. This
 * replaces it with a wrapping row of removable chips:
 *
 *  · the three axes render as chips showing what is selected;
 *  · clicking a chip reopens **its own picker** in a popover, so changing the
 *    selection never leaves the grid;
 *  · `+ Add filter` appends an attribute filter, and multiple filters AND
 *    together as UC031 requires — which is legible as a row of chips and is not
 *    legible as a row of dropdowns;
 *  · every chip is in the URL, so the workbook is a shareable link.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, Filter, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CountryPicker } from '@/components/common/CountryPicker'
import { VariablePicker } from '@/components/common/VariablePicker'
import { YearPicker } from '@/components/common/YearPicker'
import {
  WB_INCOME_LABELS,
  WHO_REGION_LABELS,
  WB_INCOME_GROUPS,
  WHO_REGIONS,
} from '@/domain/constants'
import type { Variable } from '@/domain/types'
import {
  AXIS_LABELS,
  yearRangeLabel,
  type AttributeFilter,
  type AxisId,
  type WorkbookSelection,
} from '@/domain/workbook'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { cn } from '@/lib/utils'

/**
 * Attributes offered as filters.
 *
 * UC022 governs the list — an attribute is offered here because it is flagged
 * groupable in Setup, which is the connection the two use cases are meant to
 * have. Region, income group and OECD membership are the three seeded that way.
 */
const COUNTRY_ATTRIBUTES: {
  key: string
  label: string
  options: { value: string; label: string }[]
  match: (iso3: string, values: string[]) => boolean
}[] = [
  {
    key: 'GRP_WHO_REGION',
    label: 'WHO region',
    options: WHO_REGIONS.map((r) => ({ value: r, label: WHO_REGION_LABELS[r] })),
    match: (iso3, values) => values.includes(COUNTRY_BY_ISO3.get(iso3)?.GRP_WHO_REGION ?? ''),
  },
  {
    key: 'GRP_WB_INCOME',
    label: 'Income group',
    options: WB_INCOME_GROUPS.map((g) => ({ value: g, label: WB_INCOME_LABELS[g] })),
    match: (iso3, values) => values.includes(COUNTRY_BY_ISO3.get(iso3)?.GRP_WB_INCOME ?? ''),
  },
  {
    key: 'GRP_OECD',
    label: 'OECD',
    options: [
      { value: 'Y', label: 'OECD member' },
      { value: 'N', label: 'Not OECD' },
    ],
    match: (iso3, values) =>
      values.includes(COUNTRY_BY_ISO3.get(iso3)?.GRP_OECD ? 'Y' : 'N'),
  },
]

/** Apply the AND-ed attribute filters to a country list (UC031). */
export function applyCountryFilters(
  iso3s: readonly string[],
  filters: readonly AttributeFilter[],
): string[] {
  const countryFilters = filters.filter((f) => f.axis === 'country')
  if (countryFilters.length === 0) return [...iso3s]
  return iso3s.filter((iso3) =>
    countryFilters.every((f) => {
      const attribute = COUNTRY_ATTRIBUTES.find((a) => a.key === f.key)
      return attribute ? attribute.match(iso3, f.values) : true
    }),
  )
}

export interface WorkbookFilterChipsProps {
  selection: WorkbookSelection
  onChange: (selection: WorkbookSelection) => void
  variables: readonly Variable[]
  /** The axis pinned to one member — its chip offers a single-select picker. */
  singleAxis: AxisId
  editable: boolean
}

export function WorkbookFilterChips({
  selection,
  onChange,
  variables,
  singleAxis,
  editable,
}: WorkbookFilterChipsProps) {
  const countryLabel = useMemo(() => {
    if (selection.countries.length === 1) {
      const iso3 = selection.countries[0] ?? ''
      return COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN ?? iso3
    }
    return `${selection.countries.length} countries`
  }, [selection.countries])

  const variableLabel =
    selection.variables.length === 1
      ? (selection.variables[0] ?? '')
      : `${selection.variables.length} variables`

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AxisChip
        axis="country"
        value={countryLabel}
        isSingle={singleAxis === 'country'}
        editable={editable}
      >
        <CountryPicker
          selected={selection.countries}
          onChange={(countries) => onChange({ ...selection, countries })}
          max={singleAxis === 'country' ? 1 : undefined}
        />
      </AxisChip>

      <AxisChip
        axis="variable"
        value={variableLabel}
        isSingle={singleAxis === 'variable'}
        editable={editable}
      >
        <VariablePicker
          variables={variables}
          selected={selection.variables}
          onChange={(vars) => onChange({ ...selection, variables: vars })}
          max={singleAxis === 'variable' ? 1 : undefined}
        />
      </AxisChip>

      <AxisChip
        axis="year"
        value={yearRangeLabel(selection.years)}
        isSingle={singleAxis === 'year'}
        editable={editable}
      >
        <YearPicker
          selected={selection.years}
          onChange={(years) => onChange({ ...selection, years })}
          max={singleAxis === 'year' ? 1 : undefined}
        />
      </AxisChip>

      {selection.filters.map((filter, i) => (
        <FilterChip
          key={`${filter.axis}-${filter.key}-${i}`}
          filter={filter}
          onRemove={() =>
            onChange({ ...selection, filters: selection.filters.filter((_, j) => j !== i) })
          }
          onChangeValues={(values) =>
            onChange({
              ...selection,
              filters: selection.filters.map((f, j) => (j === i ? { ...f, values } : f)),
            })
          }
        />
      ))}

      {editable ? (
        <AddFilterButton
          existing={selection.filters}
          onAdd={(filter) => onChange({ ...selection, filters: [...selection.filters, filter] })}
        />
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------------------
   One axis chip
   -------------------------------------------------------------------------- */

function AxisChip({
  axis,
  value,
  isSingle,
  editable,
  children,
}: {
  axis: AxisId
  value: string
  isSingle: boolean
  editable: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!editable}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--text-meta)] transition-colors',
            'border-who-border bg-who-surface hover:border-who-primary-blue',
            isSingle && 'border-who-brand/40 bg-who-brand/5',
            !editable && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="text-who-text-muted">{AXIS_LABELS[axis]}</span>
          <span className="font-semibold text-who-heading">{value || '—'}</span>
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96">
        <p className="mb-2 text-[length:var(--text-meta)] font-semibold text-who-heading uppercase">
          {AXIS_LABELS[axis]}
          {isSingle ? (
            <span className="ml-2 font-normal text-who-warn normal-case">
              pinned to one — the other two axes carry several members
            </span>
          ) : null}
        </p>
        {children}
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------------------------------------------------------
   One attribute filter chip
   -------------------------------------------------------------------------- */

function FilterChip({
  filter,
  onRemove,
  onChangeValues,
}: {
  filter: AttributeFilter
  onRemove: () => void
  onChangeValues: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const attribute = COUNTRY_ATTRIBUTES.find((a) => a.key === filter.key)
  const label = attribute?.label ?? filter.label

  return (
    <span className="flex items-center rounded-full border border-who-primary-blue/40 bg-who-primary-blue/5 pr-1 text-[length:var(--text-meta)]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="flex items-center gap-1.5 px-2.5 py-1">
            <Filter className="size-3 text-who-primary-blue" aria-hidden />
            <span className="text-who-text-muted">{label}</span>
            <span className="font-semibold text-who-heading">{filter.values.join(', ')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandList>
              <CommandGroup heading={label}>
                {(attribute?.options ?? []).map((option) => {
                  const on = filter.values.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() =>
                        onChangeValues(
                          on
                            ? filter.values.filter((v) => v !== option.value)
                            : [...filter.values, option.value],
                        )
                      }
                    >
                      <span className={cn('mr-2', on ? 'opacity-100' : 'opacity-0')}>✓</span>
                      {option.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-who-border"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

/* --------------------------------------------------------------------------
   + Add filter
   -------------------------------------------------------------------------- */

function AddFilterButton({
  existing,
  onAdd,
}: {
  existing: readonly AttributeFilter[]
  onAdd: (filter: AttributeFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const available = COUNTRY_ATTRIBUTES.filter((a) => !existing.some((f) => f.key === a.key))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-full border border-dashed border-who-border px-2.5 text-[length:var(--text-meta)]"
          disabled={available.length === 0}
        >
          <Plus className="size-3" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Filter on…" />
          <CommandList>
            <CommandEmpty>Every available attribute is already filtered.</CommandEmpty>
            <CommandGroup heading="Country attributes">
              {available.map((a) => (
                <CommandItem
                  key={a.key}
                  onSelect={() => {
                    const first = a.options[0]
                    if (!first) return
                    onAdd({ axis: 'country', key: a.key, label: a.label, values: [first.value] })
                    setOpen(false)
                  }}
                >
                  {a.label}
                  <Badge variant="secondary" className="ml-auto">
                    {a.options.length}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
