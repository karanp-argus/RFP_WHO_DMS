/**
 * Multi-select country picker with attribute-based grouping (UC022).
 *
 * "Regular user selects a group of countries based on one of the country
 * attributes flagged for grouping. The list of available countries is filtered
 * and selection is done only for those that meet the selection."
 *
 * So the grouping shortcuts are not decoration — selecting "EURO" or "OECD = Y"
 * is the specified interaction. The groups offered are derived from attributes
 * flagged groupable in Setup, which is what connects the two use cases.
 *
 * Reused by Workbooks (Phase 4), Reports (Phase 6) and Quality Checks (Phase 5).
 */

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { COUNTRIES } from '@/data/seed/countries'
import {
  WB_INCOME_LABELS,
  WHO_REGIONS,
  WHO_REGION_LABELS,
  WB_INCOME_GROUPS,
} from '@/domain/constants'
import { cn } from '@/lib/utils'

export interface CountryPickerProps {
  selected: string[]
  onChange: (iso3s: string[]) => void
  /** Cap the selection — the Workbook's single-country axis uses 1 (UC031). */
  max?: number
  placeholder?: string
  /** ISO3 codes the user may not select (UC009 country restrictions). */
  disabledCountries?: readonly string[]
}

export function CountryPicker({
  selected,
  onChange,
  max,
  placeholder = 'Select countries…',
  disabledCountries = [],
}: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const disabled = useMemo(() => new Set(disabledCountries), [disabledCountries])

  const byIso = useMemo(() => new Map(COUNTRIES.map((c) => [c.CODE_ISO_3, c])), [])
  const atCapacity = max != null && selected.length >= max

  function toggle(iso3: string) {
    if (disabled.has(iso3)) return
    if (selected.includes(iso3)) {
      onChange(selected.filter((c) => c !== iso3))
      return
    }
    // A single-select axis replaces rather than refusing — refusing to change
    // selection is more annoying than helpful.
    if (max === 1) {
      onChange([iso3])
      setOpen(false)
      return
    }
    if (atCapacity) return
    onChange([...selected, iso3])
  }

  /** Add every country matching a groupable attribute value (UC022). */
  function addGroup(predicate: (iso3: string) => boolean) {
    const additions = COUNTRIES.map((c) => c.CODE_ISO_3)
      .filter((iso3) => !disabled.has(iso3) && predicate(iso3))
      .filter((iso3) => !selected.includes(iso3))
    const next = max != null ? [...selected, ...additions].slice(0, max) : [...selected, ...additions]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-who-text">
              {selected.length === 0
                ? placeholder
                : selected.length === 1
                  ? (byIso.get(selected[0]!)?.NAME_SHORT_EN ?? selected[0])
                  : `${selected.length} countries selected`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 text-who-icon" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
          <Command
            filter={(value, search) => {
              // Match on ISO3 or name, case-insensitively.
              const s = search.toLowerCase()
              return value.toLowerCase().includes(s) ? 1 : 0
            }}
          >
            <CommandInput placeholder="Search by name or ISO3 code…" />
            <CommandList className="max-h-72">
              <CommandEmpty>No country matches.</CommandEmpty>

              {max !== 1 ? (
                <>
                  <CommandGroup heading="WHO region">
                    {WHO_REGIONS.map((r) => (
                      <CommandItem
                        key={r}
                        value={`region ${r} ${WHO_REGION_LABELS[r]}`}
                        onSelect={() => addGroup((iso3) => byIso.get(iso3)?.GRP_WHO_REGION === r)}
                      >
                        <span className="font-mono text-[length:var(--text-meta)]">{r}</span>
                        <span className="ml-2 truncate">{WHO_REGION_LABELS[r]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandGroup heading="World Bank income group">
                    {WB_INCOME_GROUPS.map((g) => (
                      <CommandItem
                        key={g}
                        value={`income ${g} ${WB_INCOME_LABELS[g]}`}
                        onSelect={() => addGroup((iso3) => byIso.get(iso3)?.GRP_WB_INCOME === g)}
                      >
                        <span className="font-mono text-[length:var(--text-meta)]">{g}</span>
                        <span className="ml-2 truncate">{WB_INCOME_LABELS[g]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandGroup heading="Other groups">
                    <CommandItem
                      value="oecd members"
                      onSelect={() => addGroup((iso3) => byIso.get(iso3)?.GRP_OECD === true)}
                    >
                      OECD members
                    </CommandItem>
                  </CommandGroup>

                  <Separator />
                </>
              ) : null}

              <CommandGroup heading="Countries">
                {COUNTRIES.map((c) => {
                  const isSelected = selected.includes(c.CODE_ISO_3)
                  const isDisabled =
                    disabled.has(c.CODE_ISO_3) || (atCapacity && !isSelected && max !== 1)
                  return (
                    <CommandItem
                      key={c.CODE_ISO_3}
                      value={`${c.CODE_ISO_3} ${c.NAME_SHORT_EN}`}
                      disabled={isDisabled}
                      onSelect={() => toggle(c.CODE_ISO_3)}
                    >
                      <Check
                        className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                      />
                      <span className="ml-1 w-10 shrink-0 font-mono text-[length:var(--text-meta)]">
                        {c.CODE_ISO_3}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.NAME_SHORT_EN}</span>
                      <span className="shrink-0 text-[length:var(--text-meta)] text-who-hint">
                        {c.GRP_WHO_REGION}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selection as removable chips — the same affordance §2.4 specifies for
          the workbook, so the interaction is consistent across modules. */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((iso3) => (
            <Badge key={iso3} variant="secondary" className="gap-1 pr-1">
              <span className="font-mono">{iso3}</span>
              <button
                type="button"
                aria-label={`Remove ${iso3}`}
                onClick={() => onChange(selected.filter((c) => c !== iso3))}
                className="rounded-full p-0.5 hover:bg-who-fail/15 hover:text-who-fail"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {selected.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="h-6 px-2 text-[length:var(--text-meta)] text-who-text-muted"
            >
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
