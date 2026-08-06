/**
 * Multi-select variable picker, grouped by classification.
 *
 * The variable list is ~250 codes across 15 dimensions, so a flat list is
 * unusable and a full tree is more interaction than the job needs. Grouping by
 * dimension with a search box over both code and label is the middle: an HA
 * analyst who knows they want `HF.1.2.1` types it, and one who wants "the HF
 * classification" takes it a dimension at a time.
 *
 * "Select the whole dimension" is a first-class action rather than 16 clicks,
 * because opening a country workbook over one classification is the single most
 * common thing this picker is asked to do.
 *
 * Shared with Reports (Phase 6) and Quality Checks (Phase 5).
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
import { DIMENSION_LABELS, type DimensionCode } from '@/domain/constants'
import type { Variable } from '@/domain/types'
import { cn } from '@/lib/utils'

export interface VariablePickerProps {
  variables: readonly Variable[]
  selected: string[]
  onChange: (codes: string[]) => void
  /** Cap the selection — 1 when the UC031 constraint forces this axis single. */
  max?: number
  placeholder?: string
}

export function VariablePicker({
  variables,
  selected,
  onChange,
  max,
  placeholder = 'Select variables…',
}: VariablePickerProps) {
  const [open, setOpen] = useState(false)
  const byCode = useMemo(() => new Map(variables.map((v) => [v.code, v])), [variables])
  const atCapacity = max != null && selected.length >= max

  const byDimension = useMemo(() => {
    const m = new Map<DimensionCode, Variable[]>()
    for (const v of variables) {
      if (v.dimension == null) continue
      const list = m.get(v.dimension)
      if (list) list.push(v)
      else m.set(v.dimension, [v])
    }
    return [...m.entries()]
  }, [variables])

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code))
      return
    }
    if (max === 1) {
      onChange([code])
      setOpen(false)
      return
    }
    if (atCapacity) return
    onChange([...selected, code])
  }

  const selectDimension = (dimension: DimensionCode) => {
    const codes = variables.filter((v) => v.dimension === dimension).map((v) => v.code)
    const next = max === 1 ? codes.slice(0, 1) : [...new Set([...selected, ...codes])]
    onChange(max != null ? next.slice(0, max) : next)
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
            <span className={cn(selected.length === 0 && 'text-who-text-muted')}>
              {selected.length === 0
                ? placeholder
                : `${selected.length} variable${selected.length === 1 ? '' : 's'} selected`}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command
            filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder="Search code or label…" />
            <CommandList className="max-h-80">
              <CommandEmpty>No variable matches.</CommandEmpty>
              {byDimension.map(([dimension, list]) => (
                <CommandGroup
                  key={dimension}
                  heading={
                    <span className="flex items-center justify-between gap-2">
                      <span>{DIMENSION_LABELS[dimension]}</span>
                      {max !== 1 ? (
                        <button
                          type="button"
                          className="text-[length:var(--text-meta)] text-who-primary-blue underline underline-offset-2"
                          onClick={() => selectDimension(dimension)}
                        >
                          select all {list.length}
                        </button>
                      ) : null}
                    </span>
                  }
                >
                  {list.map((v) => {
                    const isSelected = selected.includes(v.code)
                    return (
                      <CommandItem
                        key={v.code}
                        value={`${v.code} ${v.label}`}
                        onSelect={() => toggle(v.code)}
                        disabled={!isSelected && atCapacity && max !== 1}
                      >
                        <Check
                          className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        <span
                          className="font-mono text-[length:var(--text-meta)]"
                          style={{ paddingLeft: `${(v.level - 1) * 10}px` }}
                        >
                          {v.code}
                        </span>
                        <span className="ml-2 truncate text-who-text-muted">{v.label}</span>
                        {v.isCalculated ? (
                          <Badge variant="secondary" className="ml-auto shrink-0">
                            calculated
                          </Badge>
                        ) : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
            {selected.length > 0 ? (
              <>
                <Separator />
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onChange([])}
                  >
                    Clear selection
                  </Button>
                </div>
              </>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.slice(0, 12).map((code) => (
            <Badge key={code} variant="secondary" className="gap-1 font-mono">
              {code}
              <button
                type="button"
                aria-label={`Remove ${code}`}
                onClick={() => onChange(selected.filter((c) => c !== code))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {selected.length > 12 ? (
            <Badge variant="outline">+{selected.length - 12} more</Badge>
          ) : null}
          <span className="sr-only">{byCode.size} variables available</span>
        </div>
      ) : null}
    </div>
  )
}
