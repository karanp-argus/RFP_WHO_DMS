/**
 * Formulas (UC029 predefined, UC030 custom, UC060 legacy).
 *
 * This tab is where the Phase 3 engine becomes visible, so four things the RFP
 * is specific about are surfaced rather than buried:
 *
 *  · **Every formula is evaluated live** against a chosen country and year, so
 *    the 16 seeded indicators are numbers on screen rather than text. Values
 *    come from `useFormulaEngine`, which resolves through `XMartClient`.
 *  · **The null-guard condition** is shown on every formula. "at least one
 *    component not null" and "CHE and GDP not null" behave differently, and a
 *    failed guard yields blank rather than 0 — which shows up in exports, and
 *    is rendered here as a blank with a reason rather than a zero.
 *  · **Per-country overrides** (UC029): "editing/customizing a predefined formula
 *    for a specific country, so that the formula would not be altered for other
 *    countries, but only for the impacted one."
 *  · **Legacy old-DMS formulas** (UC060) are listed read-only in their original
 *    syntax, so the migration gap is explicit rather than glossed over.
 *
 * The inspector and the dependency-graph dialog exist because plan §Phase 3
 * asks for the AST and the graph to be visible in the demo — a claim about
 * engineering depth that a screenshot of a table cannot make.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Globe2,
  Info,
  Network,
  Plus,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadingState } from '@/components/common/EmptyState'
import { CountryPicker } from '@/components/common/CountryPicker'
import { downloadCsv } from '@/lib/exporters'
import { formatValue } from '@/lib/format'
import { UNITS, YEARS } from '@/domain/constants'
import {
  FUNCTION_NAMES,
  formatCycle,
  formatNode,
  type EvaluationResult,
  type FormulaEngine,
  type ValidationResult,
} from '@/domain/formula'
import type { Formula, NullPolicy } from '@/domain/types'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { useFormulas } from '@/hooks/useSetupData'
import { useFormulaEngine } from '@/hooks/useFormulaEngine'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { DependencyGraphDialog } from '../DependencyGraphDialog'
import { FormulaInspectorDialog } from '../FormulaInspectorDialog'

/**
 * The country-year the tab evaluates against on arrival.
 *
 * Canada is the §6 demo walkthrough subject; 2022 rather than 2024 because it
 * is the most recent year a real reporting round would be complete for, which
 * is how the HA team would open this screen.
 */
const DEFAULT_EVAL_ISO3 = 'CAN'
const DEFAULT_EVAL_YEAR = 2022

export function FormulasTab() {
  const { data: formulas, isLoading } = useFormulas()
  const { canEdit, canCreatePredefined, user } = usePermissions()
  const [view, setView] = useState<'active' | 'legacy'>('active')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Formula | null>(null)
  const [local, setLocal] = useState<Formula[]>([])
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({})

  // The country-year every formula on screen is evaluated against.
  const [evalCountries, setEvalCountries] = useState<string[]>([DEFAULT_EVAL_ISO3])
  const [evalYear, setEvalYear] = useState(DEFAULT_EVAL_YEAR)
  const [graphOpen, setGraphOpen] = useState(false)
  const evalIso3 = evalCountries[0] ?? DEFAULT_EVAL_ISO3

  const all = useMemo(() => {
    const base = [...(formulas ?? []), ...local]
    return base.map((f) => {
      const extra = overrides[f.code]
      return extra ? { ...f, countryOverrides: { ...f.countryOverrides, ...extra } } : f
    })
  }, [formulas, local, overrides])

  // Fed the on-screen list rather than only what xMart has committed, so an
  // unsaved draft or a fresh UC029 override is reflected in the values at once.
  const { engine, isLoading: engineLoading } = useFormulaEngine(evalIso3, all)

  const active = all.filter((f) => !f.isLegacy)
  const legacy = all.filter((f) => f.isLegacy)

  /** Grouped by the FR's own folder column: AGGREGATES, FINANCING SOURCES, … */
  const byFolder = useMemo(() => {
    const m = new Map<string, Formula[]>()
    for (const f of active) {
      const list = m.get(f.folder)
      if (list) list.push(f)
      else m.set(f.folder, [f])
    }
    return [...m.entries()]
  }, [active])

  if (isLoading) return <LoadingState label="Loading formulas from xMart…" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="active">Formulas ({active.length})</TabsTrigger>
            <TabsTrigger value="legacy">Old DMS ({legacy.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                all.map((f) => ({
                  FOLDER: f.folder,
                  CODE: f.code,
                  SHORT_CODE: f.shortCode,
                  NAME: f.name,
                  EXPRESSION: f.expression,
                  CONDITION: f.conditionLabel,
                  NULL_POLICY: f.nullPolicy,
                  UNIT: f.unit,
                  SCOPE: f.scope,
                  COUNTRY_OVERRIDES: Object.entries(f.countryOverrides)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | '),
                })),
                [
                  'FOLDER',
                  'CODE',
                  'SHORT_CODE',
                  'NAME',
                  'EXPRESSION',
                  'CONDITION',
                  'NULL_POLICY',
                  'UNIT',
                  'SCOPE',
                  'COUNTRY_OVERRIDES',
                ],
                'formulas',
              )
            }
          >
            Export CSV
          </Button>
          {canEdit('setup') && view === 'active' ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditing(null)
                setEditorOpen(true)
              }}
            >
              <Plus className="size-3.5" />
              New formula
            </Button>
          ) : null}
        </div>
      </div>

      {view === 'active' ? (
        <>
          <div className="rounded border border-who-border bg-who-page-bg px-4 py-3">
            <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Formulas reference other formulas —{' '}
                <span className="font-mono">CHE%GDP</span> depends on{' '}
                <span className="font-mono">CHE</span>, which sums the{' '}
                <span className="font-mono">HF.*</span> categories. Each carries a condition
                governing what happens when an input is missing: when the condition fails the
                result is <strong>blank, not zero</strong>, and that distinction is preserved in
                exports.
              </span>
            </p>
          </div>

          <EvaluationBar
            countries={evalCountries}
            onCountriesChange={setEvalCountries}
            year={evalYear}
            onYearChange={setEvalYear}
            engine={engine}
            isLoading={engineLoading}
            onOpenGraph={() => setGraphOpen(true)}
          />

          <div className="space-y-5">
            {byFolder.map(([folder, list]) => (
              <section key={folder}>
                <h4 className="mb-2 text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase">
                  {folder}
                </h4>
                <div className="overflow-hidden rounded border border-who-border">
                  {list.map((f, i) => (
                    <FormulaRow
                      key={f.id}
                      formula={f}
                      isLast={i === list.length - 1}
                      editable={canEdit('setup')}
                      engine={engine}
                      iso3={evalIso3}
                      year={evalYear}
                      onEdit={() => {
                        setEditing(f)
                        setEditorOpen(true)
                      }}
                      onOverride={(iso3, expression) => {
                        setOverrides((prev) => ({
                          ...prev,
                          [f.code]: { ...prev[f.code], [iso3]: expression },
                        }))
                        toast.success(
                          `${f.code} customised for ${COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN ?? iso3}. Other countries are unaffected.`,
                        )
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <LegacyFormulas formulas={legacy} />
      )}

      <DependencyGraphDialog open={graphOpen} onOpenChange={setGraphOpen} engine={engine} />

      <FormulaEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        engine={engine}
        canCreatePredefined={canCreatePredefined('setup')}
        authorId={user?.id ?? 'unknown'}
        onSave={(f) => {
          setLocal((prev) => {
            const idx = prev.findIndex((x) => x.id === f.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = f
              return next
            }
            return [...prev, f]
          })
          setEditorOpen(false)
          toast.success(editing ? `${f.code} updated.` : `${f.code} created.`)
        }}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Evaluation context — which country-year the numbers on this screen describe
   -------------------------------------------------------------------------- */

function EvaluationBar({
  countries,
  onCountriesChange,
  year,
  onYearChange,
  engine,
  isLoading,
  onOpenGraph,
}: {
  countries: string[]
  onCountriesChange: (iso3s: string[]) => void
  year: number
  onYearChange: (year: number) => void
  engine: FormulaEngine | null
  isLoading: boolean
  onOpenGraph: () => void
}) {
  const cycleCount = engine?.cycles.length ?? 0

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-who-border bg-who-surface px-4 py-3">
      <div className="min-w-[220px]">
        <Label className="text-[length:var(--text-meta)]">Evaluate for</Label>
        <div className="mt-1">
          <CountryPicker selected={countries} onChange={onCountriesChange} max={1} />
        </div>
      </div>

      <div>
        <Label htmlFor="eval-year" className="text-[length:var(--text-meta)]">
          Year
        </Label>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger id="eval-year" className="mt-1 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...YEARS].reverse().map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {isLoading ? (
          <span className="text-[length:var(--text-meta)] text-who-text-muted">
            Resolving values from xMart…
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center gap-1 text-[length:var(--text-meta)]',
              cycleCount > 0 ? 'text-who-fail' : 'text-who-text-muted',
            )}
          >
            {cycleCount > 0 ? (
              <AlertTriangle className="size-3.5" aria-hidden />
            ) : (
              <CheckCircle2 className="size-3.5 text-who-pass" aria-hidden />
            )}
            {cycleCount > 0
              ? `${cycleCount} circular reference${cycleCount === 1 ? '' : 's'}`
              : `${engine?.order.length ?? 0} formulas, no cycles`}
          </span>
        )}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenGraph}>
          <Network className="size-3.5" />
          Dependency graph
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   One formula row
   -------------------------------------------------------------------------- */

function FormulaRow({
  formula: f,
  isLast,
  editable,
  engine,
  iso3,
  year,
  onEdit,
  onOverride,
}: {
  formula: Formula
  isLast: boolean
  editable: boolean
  engine: FormulaEngine | null
  iso3: string
  year: number
  onEdit: () => void
  onOverride: (iso3: string, expression: string) => void
}) {
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const overrideCount = Object.keys(f.countryOverrides).length

  // Memoised on the engine identity: the engine caches internally, so this is
  // cheap, but re-running it on every keystroke elsewhere on the tab is not.
  const result: EvaluationResult | null = useMemo(
    () => engine?.evaluate(f.code, iso3, year) ?? null,
    [engine, f.code, iso3, year],
  )

  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 bg-who-surface px-3 py-2.5',
        !isLast && 'border-b border-who-border/60',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[length:var(--text-body-sm)] font-semibold text-who-heading">
            {f.code}
          </span>
          {f.scope === 'custom' ? (
            <Badge variant="outline" className="border-who-warn/50">
              Custom
            </Badge>
          ) : null}
          {overrideCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <Globe2 className="size-3" />
                  {overrideCount} country override{overrideCount === 1 ? '' : 's'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {Object.entries(f.countryOverrides).map(([iso3, expr]) => (
                  <div key={iso3} className="font-mono text-[length:var(--text-meta)]">
                    {iso3}: {expr}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <p className="mt-0.5 text-[length:var(--text-body-sm)] text-who-text">{f.name}</p>

        {/* The expression, rendered as code — UC031 requires formula cells to be
            visually distinct, and the same treatment is used consistently here. */}
        <p className="mt-1.5 font-mono text-[length:var(--text-body-sm)] text-who-cell-formula italic">
          {f.expression}
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-meta)] text-who-text-muted">
          <span className="flex items-center gap-1">
            <NullPolicyBadge policy={f.nullPolicy} />
            {f.conditionLabel}
          </span>
          <span>·</span>
          <span>{f.unit}</span>
          <span>·</span>
          <span className="font-mono">{f.shortCode}</span>
        </p>
      </div>

      <ValueCell formula={f} result={result} />

      <div className="flex shrink-0 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={result == null}
          onClick={() => setInspectorOpen(true)}
        >
          <Search className="size-3.5" />
          Inspect
        </Button>
        {editable ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setOverrideOpen(true)}>
              Customise per country
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
          </>
        ) : null}
      </div>

      <FormulaInspectorDialog
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        formula={f}
        result={result}
        countryLabel={COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN ?? iso3}
        year={year}
      />

      <CountryOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        formula={f}
        onSave={(overrideIso3, expr) => {
          onOverride(overrideIso3, expr)
          setOverrideOpen(false)
        }}
      />
    </div>
  )
}

/**
 * The computed value.
 *
 * A failed guard renders as a dash with the word "blank" beside it, never as 0
 * — the whole point of `NullPolicy`, and the thing that would be quietly undone
 * here by a `?? 0`.
 */
function ValueCell({ formula, result }: { formula: Formula; result: EvaluationResult | null }) {
  if (result == null) {
    return <div className="w-32 shrink-0 text-right text-who-text-muted">…</div>
  }

  return (
    <div className="w-32 shrink-0 text-right">
      <p
        className={cn(
          'font-mono text-[length:var(--text-body)] font-semibold tabular-nums',
          result.blank ? 'text-who-text-muted' : 'text-who-heading',
        )}
      >
        {formatValue(result.value, formula.unit)}
      </p>
      {result.error ? (
        <p className="text-[length:var(--text-meta)] text-who-fail">{result.error.kind}</p>
      ) : result.guard === 'failed' ? (
        <p className="text-[length:var(--text-meta)] text-who-warn">blank — guard failed</p>
      ) : (
        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          {formula.unit === UNITS.PERCENT ? '%' : formula.unit}
        </p>
      )}
    </div>
  )
}

function NullPolicyBadge({ policy }: { policy: NullPolicy }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'font-mono text-[length:var(--text-meta)]',
            policy === 'any-not-null'
              ? 'border-who-pass/50 text-who-pass'
              : 'border-who-warn/50 text-who-warn',
          )}
        >
          {policy === 'any-not-null' ? 'ANY' : 'ALL'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {policy === 'any-not-null'
          ? 'Evaluates if at least one input has a value; missing inputs are treated as zero.'
          : 'Every input must have a value. If any is missing the result is blank, not zero.'}
      </TooltipContent>
    </Tooltip>
  )
}

/* --------------------------------------------------------------------------
   UC029 — per-country override
   -------------------------------------------------------------------------- */

function CountryOverrideDialog({
  open,
  onOpenChange,
  formula,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  formula: Formula
  onSave: (iso3: string, expression: string) => void
}) {
  const [countries, setCountries] = useState<string[]>([])
  const [expression, setExpression] = useState(formula.expression)
  const iso3 = countries[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customise {formula.code} for one country</DialogTitle>
          <DialogDescription>
            The formula is changed for the selected country only. Every other country continues to
            use the standard definition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[length:var(--text-meta)]">Country</Label>
            <div className="mt-1">
              <CountryPicker selected={countries} onChange={setCountries} max={1} />
            </div>
          </div>

          <div>
            <Label className="text-[length:var(--text-meta)]">Standard definition</Label>
            <p className="mt-1 rounded border border-who-border bg-who-page-bg px-3 py-2 font-mono text-[length:var(--text-body-sm)] text-who-text-muted">
              {formula.expression}
            </p>
          </div>

          <div>
            <Label htmlFor="override-expr" className="text-[length:var(--text-meta)]">
              Definition for this country
            </Label>
            <Input
              id="override-expr"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              className="mt-1 h-9 font-mono"
            />
          </div>

          {iso3 && formula.countryOverrides[iso3] ? (
            <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-warn">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN ?? iso3} already has an override:{' '}
              <span className="font-mono">{formula.countryOverrides[iso3]}</span>. Saving replaces
              it.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!iso3 || expression.trim() === ''}
            onClick={() => iso3 && onSave(iso3, expression.trim())}
          >
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------------------
   UC060 — migrated legacy formulas
   -------------------------------------------------------------------------- */

function LegacyFormulas({ formulas }: { formulas: readonly Formula[] }) {
  return (
    <div className="space-y-3">
      <div className="rounded border border-who-warn/40 bg-who-warn/5 px-4 py-3">
        <p className="flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-who-warn" aria-hidden />
          <span>
            Migrated from the old DMS as plain text and stored in xMart as metadata (UC060). They
            are shown in their original syntax for reference and are not evaluated. Translating
            them into working DMS formulas is tracked separately as UC060.1 and is out of Pilot
            scope.
          </span>
        </p>
      </div>

      <div className="overflow-hidden rounded border border-who-border">
        {formulas.map((f, i) => (
          <div
            key={f.id}
            className={cn(
              'bg-who-surface px-3 py-2.5',
              i < formulas.length - 1 && 'border-b border-who-border/60',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                {f.code}
              </span>
              <Badge variant="secondary">Read-only</Badge>
            </div>
            <p className="mt-0.5 text-[length:var(--text-body-sm)] text-who-text">{f.name}</p>
            <p className="mt-1.5 font-mono text-[length:var(--text-body-sm)] text-who-text-muted">
              {f.expression}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Create / edit
   -------------------------------------------------------------------------- */

function FormulaEditorDialog({
  open,
  onOpenChange,
  initial,
  engine,
  canCreatePredefined,
  authorId,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: Formula | null
  engine: FormulaEngine | null
  canCreatePredefined: boolean
  authorId: string
  onSave: (f: Formula) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [expression, setExpression] = useState('')
  const [policy, setPolicy] = useState<NullPolicy>('all-not-null')
  const [unit, setUnit] = useState<string>(UNITS.PERCENT)
  const [scope, setScope] = useState<'predefined' | 'custom'>(
    canCreatePredefined ? 'predefined' : 'custom',
  )
  const [countries, setCountries] = useState<string[]>([])

  // Load the record being edited when the dialog opens. An effect rather than a
  // memo: this is synchronising state to props, not computing a value.
  useEffect(() => {
    if (!open) return
    setCode(initial?.code ?? '')
    setName(initial?.name ?? '')
    setExpression(initial?.expression ?? '')
    setPolicy(initial?.nullPolicy ?? 'all-not-null')
    setUnit(initial?.unit ?? UNITS.PERCENT)
    setScope(initial?.scope ?? (canCreatePredefined ? 'predefined' : 'custom'))
    setCountries(initial?.countryScope ?? [])
  }, [open, initial, canCreatePredefined])

  /**
   * Live validation against the real engine: syntax, unknown references, and
   * — the one that matters — whether saving this expression would close a
   * cycle. UC029/UC030 let an administrator edit formulas freely, so the
   * circular-reference check has to happen here, before the save, rather than
   * as an error the workbook discovers later.
   */
  const check = useMemo(() => {
    const trimmed = expression.trim()
    if (!engine || trimmed === '') return null
    return engine.validate(trimmed, { code: code.trim() || undefined })
  }, [engine, expression, code])

  const valid =
    code.trim() !== '' &&
    name.trim() !== '' &&
    expression.trim() !== '' &&
    (scope === 'predefined' || countries.length > 0) &&
    (check?.ok ?? true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.code}` : 'New formula'}</DialogTitle>
          <DialogDescription>
            Reference variables by their code — <span className="font-mono">HF.1 + HF.2</span> — or
            other formulas by theirs, such as <span className="font-mono">CHE / GDP * 100</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-code" className="text-[length:var(--text-meta)]">
                Indicator code
              </Label>
              <Input
                id="f-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. OOPS%CHE_SHA2011"
                className="mt-1 h-9 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="f-unit" className="text-[length:var(--text-meta)]">
                Unit
              </Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="f-unit" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UNITS).map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="f-name" className="text-[length:var(--text-meta)]">
              Indicator name
            </Label>
            <Input
              id="f-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-9"
            />
          </div>

          <div>
            <Label htmlFor="f-expr" className="text-[length:var(--text-meta)]">
              Expression
            </Label>
            <Input
              id="f-expr"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="HF.3 / CHE * 100"
              className="mt-1 h-9 font-mono"
            />
            <ExpressionFeedback check={check} />
          </div>

          <div>
            <Label className="text-[length:var(--text-meta)]">
              When an input is missing
            </Label>
            <Select value={policy} onValueChange={(v) => setPolicy(v as NullPolicy)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any-not-null">
                  Evaluate if at least one input has a value
                </SelectItem>
                <SelectItem value="all-not-null">
                  Require every input — otherwise blank
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[length:var(--text-meta)]">Availability</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as typeof scope)}
              disabled={!canCreatePredefined}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="predefined" disabled={!canCreatePredefined}>
                  Predefined — all users, all countries
                </SelectItem>
                <SelectItem value="custom">Custom — specific countries only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === 'custom' ? (
            <div>
              <Label className="text-[length:var(--text-meta)]">Countries</Label>
              <div className="mt-1">
                <CountryPicker selected={countries} onChange={setCountries} />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave({
                id: initial?.id ?? `f-local-${Date.now()}`,
                code: code.trim(),
                shortCode: code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                name: name.trim(),
                folder: initial?.folder ?? 'CUSTOM',
                expression: expression.trim(),
                nullPolicy: policy,
                conditionLabel:
                  policy === 'any-not-null'
                    ? 'at least one component not null'
                    : 'all components not null',
                unit,
                scope,
                countryOverrides: initial?.countryOverrides ?? {},
                countryScope: scope === 'custom' ? countries : [],
                createdBy: initial?.createdBy ?? authorId,
                isLegacy: false,
              })
            }
          >
            {initial ? 'Save changes' : 'Create formula'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What the engine makes of what has been typed so far.
 *
 * Three outcomes, in the order they can occur: the parser could not read it;
 * it parsed but names codes that do not exist; it parses and resolves but would
 * create a circular reference. Only the last needs the cycle path spelled out,
 * because it is the one an administrator cannot diagnose by re-reading the text.
 */
function ExpressionFeedback({ check }: { check: ValidationResult | null }) {
  if (!check) {
    return (
      <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
        Reference variables and other formulas by code. Functions: {FUNCTION_NAMES.join(', ')}.
      </p>
    )
  }

  if (check.error && !check.cycle) {
    return (
      <p className="mt-1 flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-fail">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {check.error.message}
      </p>
    )
  }

  if (check.cycle) {
    return (
      <p className="mt-1 flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-fail">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Circular reference: <span className="font-mono">{formatCycle(check.cycle)}</span>. A
        formula cannot depend on itself, directly or through another formula.
      </p>
    )
  }

  if (check.unknownCodes.length > 0) {
    return (
      <p className="mt-1 flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-warn">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Unknown code{check.unknownCodes.length === 1 ? '' : 's'}:{' '}
        <span className="font-mono">{check.unknownCodes.join(', ')}</span>
      </p>
    )
  }

  return (
    <p className="mt-1 flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-pass">
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      Parses cleanly —{' '}
      <span className="font-mono">{check.ast ? formatNode(check.ast) : ''}</span>
    </p>
  )
}
