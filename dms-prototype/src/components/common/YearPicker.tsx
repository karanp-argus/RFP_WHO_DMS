/**
 * Year axis picker.
 *
 * Years are the axis a user almost always wants as a *range* — "2000 to 2024",
 * "the last decade" — and only occasionally as a set. So the primary control is
 * a from/to pair with presets, and individual toggling is available underneath
 * for the rarer case. A 25-item multi-select as the primary control would make
 * the common action cost 25 clicks.
 *
 * When the UC031 constraint forces this axis to a single year (`max = 1`) the
 * range controls collapse to a single select, because a range picker that can
 * only ever produce one year reads as broken.
 */

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FIRST_YEAR, LAST_YEAR, YEARS } from '@/domain/constants'
import { cn } from '@/lib/utils'

export interface YearPickerProps {
  selected: number[]
  onChange: (years: number[]) => void
  max?: number
}

function range(from: number, to: number): number[] {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  return YEARS.filter((y) => y >= lo && y <= hi)
}

const PRESETS: { label: string; years: () => number[] }[] = [
  { label: 'All years', years: () => [...YEARS] },
  { label: 'Last 10', years: () => range(LAST_YEAR - 9, LAST_YEAR) },
  { label: 'Last 5', years: () => range(LAST_YEAR - 4, LAST_YEAR) },
]

export function YearPicker({ selected, onChange, max }: YearPickerProps) {
  const sorted = [...selected].sort((a, b) => a - b)
  const from = sorted[0] ?? LAST_YEAR - 4
  const to = sorted[sorted.length - 1] ?? LAST_YEAR

  if (max === 1) {
    // No value rather than a defaulted one when nothing is selected: showing
    // "2024" while `selection.years` is empty would claim a choice the user has
    // not made, and the workbook would refuse to resolve for reasons the screen
    // contradicts.
    return (
      <Select
        value={sorted[0] == null ? undefined : String(sorted[0])}
        onValueChange={(v) => onChange([Number(v)])}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a year" />
        </SelectTrigger>
        <SelectContent>
          {[...YEARS].reverse().map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="year-from" className="text-[length:var(--text-meta)]">
            From
          </Label>
          <Select value={String(from)} onValueChange={(v) => onChange(range(Number(v), to))}>
            <SelectTrigger id="year-from" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="year-to" className="text-[length:var(--text-meta)]">
            To
          </Label>
          <Select value={String(to)} onValueChange={(v) => onChange(range(from, Number(v)))}>
            <SelectTrigger id="year-to" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="h-7 text-[length:var(--text-meta)]"
            onClick={() => onChange(p.years())}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Individual toggling, for the gappy selections a range cannot express. */}
      <div className="flex flex-wrap gap-1">
        {YEARS.map((y) => {
          const isOn = selected.includes(y)
          return (
            <button
              key={y}
              type="button"
              aria-pressed={isOn}
              onClick={() =>
                onChange(isOn ? selected.filter((s) => s !== y) : [...selected, y].sort((a, b) => a - b))
              }
              className={cn(
                'rounded border px-1.5 py-0.5 font-mono text-[length:var(--text-meta)] tabular-nums transition-colors',
                isOn
                  ? 'border-who-brand bg-who-brand text-who-on-brand'
                  : 'border-who-border bg-who-surface text-who-text-muted hover:border-who-primary-blue',
              )}
            >
              {String(y).slice(2)}
            </button>
          )
        })}
      </div>
      <p className="text-[length:var(--text-meta)] text-who-text-muted">
        {selected.length === 0
          ? `No years selected — ${FIRST_YEAR}–${LAST_YEAR} available.`
          : `${selected.length} year${selected.length === 1 ? '' : 's'} selected.`}
      </p>
    </div>
  )
}
