/**
 * Choosing what to run the checks over.
 *
 * The FR's own example of a run scope is *"Region=EURO or OECD=Y"*, so
 * selecting a group by a country attribute is a first-class choice here rather
 * than something reachable by picking 53 countries by hand. The attributes on
 * offer are the ones flagged groupable in Setup (UC022), which is the join
 * between that use case and this one.
 *
 * The fourth option — the demo set — is labelled as a prototype affordance, per
 * CLAUDE.md, because it is: it exists so the presenter lands on countries that
 * carry known defects without having to remember which ones those are.
 */

import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CountryPicker } from '@/components/common/CountryPicker'
import { COUNTRIES } from '@/data/seed/countries'
import {
  QC_DEMO_COUNTRIES,
  QC_DEMO_SCOPE_HINT,
  QC_DEMO_SCOPE_LABEL,
} from '@/data/qc/demoScope'
import {
  FIRST_YEAR,
  LAST_YEAR,
  WB_INCOME_GROUPS,
  WB_INCOME_LABELS,
  WHO_REGIONS,
  WHO_REGION_LABELS,
  YEARS,
} from '@/domain/constants'
import { QC_GROUP_ATTRIBUTE_LABELS, type QcGroupAttribute, type QcRunScope } from '@/domain/qc'

type ScopeKind = 'demo' | 'attribute' | 'countries'

/** The values each groupable attribute can take, for the second select. */
const ATTRIBUTE_VALUES: Record<QcGroupAttribute, { value: string; label: string }[]> = {
  GRP_WHO_REGION: WHO_REGIONS.map((r) => ({ value: r, label: `${r} — ${WHO_REGION_LABELS[r]}` })),
  GRP_WB_INCOME: WB_INCOME_GROUPS.map((g) => ({
    value: g,
    label: `${g} — ${WB_INCOME_LABELS[g]}`,
  })),
  GRP_OECD: [
    { value: 'true', label: 'OECD members' },
    { value: 'false', label: 'Non-members' },
  ],
}

function countriesForAttribute(attribute: QcGroupAttribute, value: string): string[] {
  return COUNTRIES.filter((c) =>
    attribute === 'GRP_OECD' ? String(c.GRP_OECD) === value : String(c[attribute]) === value,
  ).map((c) => c.CODE_ISO_3)
}

export interface QcRunDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many rules will run — shown so the scope decision has both halves. */
  ruleCount: number
  isRunning: boolean
  onRun: (scope: QcRunScope) => void
}

export function QcRunDialog({
  open,
  onOpenChange,
  ruleCount,
  isRunning,
  onRun,
}: QcRunDialogProps) {
  const [kind, setKind] = useState<ScopeKind>('demo')
  const [attribute, setAttribute] = useState<QcGroupAttribute>('GRP_WHO_REGION')
  const [attributeValue, setAttributeValue] = useState<string>('EUR')
  const [picked, setPicked] = useState<string[]>([])
  const [yearFrom, setYearFrom] = useState(FIRST_YEAR)
  const [yearTo, setYearTo] = useState(LAST_YEAR)

  const scope = useMemo((): QcRunScope => {
    if (kind === 'attribute') {
      const countries = countriesForAttribute(attribute, attributeValue)
      const valueLabel =
        ATTRIBUTE_VALUES[attribute].find((v) => v.value === attributeValue)?.label ??
        attributeValue
      return {
        kind: 'attribute',
        label: `${QC_GROUP_ATTRIBUTE_LABELS[attribute]} = ${valueLabel.split(' — ')[0]}`,
        countries,
        yearFrom,
        yearTo,
      }
    }
    if (kind === 'countries') {
      return {
        kind: 'countries',
        label:
          picked.length === 1
            ? (COUNTRIES.find((c) => c.CODE_ISO_3 === picked[0])?.NAME_SHORT_EN ?? picked[0]!)
            : `${picked.length} countries`,
        countries: picked,
        yearFrom,
        yearTo,
      }
    }
    return {
      kind: 'countries',
      label: QC_DEMO_SCOPE_LABEL,
      countries: [...QC_DEMO_COUNTRIES],
      yearFrom,
      yearTo,
    }
  }, [kind, attribute, attributeValue, picked, yearFrom, yearTo])

  const canRun = scope.countries.length > 0 && ruleCount > 0 && !isRunning

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run quality checks</DialogTitle>
          <DialogDescription>
            {ruleCount} rule{ruleCount === 1 ? '' : 's'} will run over the scope below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as ScopeKind)}>
            {/* --- demo set --------------------------------------------- */}
            <div className="flex items-start gap-2 rounded border border-who-border p-3">
              <RadioGroupItem value="demo" id="scope-demo" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <Label htmlFor="scope-demo" className="flex flex-wrap items-center gap-2">
                  {QC_DEMO_SCOPE_LABEL}
                  <Badge variant="secondary">{QC_DEMO_COUNTRIES.length} countries</Badge>
                  {/* Labelled as a prototype affordance, per CLAUDE.md. */}
                  <Badge variant="outline" className="text-who-text-muted">
                    Prototype
                  </Badge>
                </Label>
                <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                  {QC_DEMO_SCOPE_HINT}
                </p>
              </div>
            </div>

            {/* --- by attribute — the FR's own example -------------------- */}
            <div className="flex items-start gap-2 rounded border border-who-border p-3">
              <RadioGroupItem value="attribute" id="scope-attribute" className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="scope-attribute">By country group</Label>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={attribute}
                    onValueChange={(v) => {
                      const next = v as QcGroupAttribute
                      setAttribute(next)
                      setAttributeValue(ATTRIBUTE_VALUES[next][0]?.value ?? '')
                      setKind('attribute')
                    }}
                  >
                    <SelectTrigger className="w-56" aria-label="Grouping attribute">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(QC_GROUP_ATTRIBUTE_LABELS) as QcGroupAttribute[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          {QC_GROUP_ATTRIBUTE_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={attributeValue}
                    onValueChange={(v) => {
                      setAttributeValue(v)
                      setKind('attribute')
                    }}
                  >
                    <SelectTrigger className="w-64" aria-label="Group value">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTRIBUTE_VALUES[attribute].map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Badge variant="secondary" className="self-center">
                    {countriesForAttribute(attribute, attributeValue).length} countries
                  </Badge>
                </div>
              </div>
            </div>

            {/* --- explicit countries ------------------------------------ */}
            <div className="flex items-start gap-2 rounded border border-who-border p-3">
              <RadioGroupItem value="countries" id="scope-countries" className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="scope-countries">Specific countries</Label>
                <CountryPicker
                  selected={picked}
                  onChange={(next) => {
                    setPicked(next)
                    setKind('countries')
                  }}
                  placeholder="Choose countries…"
                  ariaLabel="Countries in scope"
                />
              </div>
            </div>
          </RadioGroup>

          {/* --- years ---------------------------------------------------- */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="qc-year-from" className="text-[length:var(--text-meta)]">
                From year
              </Label>
              <Select
                value={String(yearFrom)}
                onValueChange={(v) => setYearFrom(Math.min(Number(v), yearTo))}
              >
                <SelectTrigger id="qc-year-from" className="mt-1 w-28">
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
            <div>
              <Label htmlFor="qc-year-to" className="text-[length:var(--text-meta)]">
                To year
              </Label>
              <Select
                value={String(yearTo)}
                onValueChange={(v) => setYearTo(Math.max(Number(v), yearFrom))}
              >
                <SelectTrigger id="qc-year-to" className="mt-1 w-28">
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
            <p className="pb-2 text-[length:var(--text-meta)] text-who-text-muted">
              Rules with their own year window are narrowed to fit inside this one.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canRun} onClick={() => onRun(scope)} className="gap-1.5">
            <Play className="size-3.5" />
            Run over {scope.countries.length} countr{scope.countries.length === 1 ? 'y' : 'ies'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
