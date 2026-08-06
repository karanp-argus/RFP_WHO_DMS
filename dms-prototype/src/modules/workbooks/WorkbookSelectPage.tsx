/**
 * Choose a workbook (UC031).
 *
 * The whole screen exists to make one rule visible and unbreakable:
 *
 *   > "the user can select one country and multiple variables and years
 *   > (country workbook), or one variable and multiple countries and years
 *   > (variable workbook), or one year and multiple countries and variables
 *   > (year workbook)"
 *
 * So the constraint is **enforced in the controls, not validated after the
 * fact**: as soon as two axes hold more than one member, the third picker caps
 * itself at one and says why. The workbook type is named on screen as it
 * resolves, because "country workbook" is the RFP's own vocabulary and the
 * demo should use it before the grid appears rather than after.
 *
 * The resulting selection is carried to the grid entirely in the URL, which is
 * what makes a workbook a shareable link (plan §2.4).
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Info, Lock, Table2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CountryPicker } from '@/components/common/CountryPicker'
import { VariablePicker } from '@/components/common/VariablePicker'
import { YearPicker } from '@/components/common/YearPicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/EmptyState'
import { LAST_YEAR, YEARS } from '@/domain/constants'
import {
  AXIS_LABELS,
  candidateTypes,
  emptySelection,
  forcedSingleAxis,
  resolveShape,
  selectionToSearchParams,
  WORKBOOK_TYPE_DESCRIPTIONS,
  WORKBOOK_TYPE_LABELS,
  type AxisId,
  type WorkbookSelection,
  type WorkbookType,
} from '@/domain/workbook'
import { useVariables } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'

/**
 * The §6 walkthrough subject, offered as a one-click opener.
 *
 * Not decoration: the demo script opens Canada 2000–2024 over the HF
 * classification, and a presenter should not have to build that selection by
 * hand on stage.
 */
const DEMO_SHORTCUTS: { label: string; description: string; build: () => WorkbookSelection }[] = [
  {
    label: 'Canada · HF · 2000–2024',
    description: 'The §6 walkthrough — financing schemes over the full span',
    build: () => ({
      countries: ['CAN'],
      variables: [
        'HF.1',
        'HF.1.1',
        'HF.1.2',
        'HF.1.2.1',
        'HF.1.2.2',
        'HF.1.3',
        'HF.2',
        'HF.2.1',
        'HF.2.2',
        'HF.2.3',
        'HF.3',
        'HF.3.1',
        'HF.3.2',
        'HF.4',
        'HF.nec',
        'HF TOT',
      ],
      years: [...YEARS],
      filters: [],
    }),
  },
  {
    label: 'OOP share · 6 countries · 2015–2024',
    description: 'A variable workbook — one indicator compared across countries',
    build: () => ({
      countries: ['CAN', 'FRA', 'KEN', 'IDN', 'THA', 'ARG'],
      variables: ['HF.3'],
      years: YEARS.filter((y) => y >= 2015),
      filters: [],
    }),
  },
]

export function WorkbookSelectPage() {
  const navigate = useNavigate()
  const { data: variables, isLoading } = useVariables()
  const { canEdit } = usePermissions()
  const [selection, setSelection] = useState<WorkbookSelection>(emptySelection())
  const [preferredType, setPreferredType] = useState<WorkbookType | null>(null)

  const forced = forcedSingleAxis(selection)
  const candidates = candidateTypes(selection)
  const { shape, problem } = resolveShape(selection, preferredType ?? undefined)

  /** `max` for one axis's picker: 1 when the constraint has forced it. */
  const maxFor = (axis: AxisId): number | undefined => (forced === axis ? 1 : undefined)

  const open = () => {
    if (!shape) return
    const params = selectionToSearchParams(selection, shape.type)
    navigate(`/workbooks/view?${params.toString()}`)
  }

  if (isLoading) return <LoadingState label="Loading variables from xMart…" />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workbooks"
        description="Pick a country, the variables and the years. Exactly one of the three axes carries a single member — that is what decides the shape of the grid."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Open a workbook</CardTitle>
            <CardDescription>
              Choosing several members on two axes caps the third at one, and names the workbook.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <AxisBlock
              axis="country"
              forced={forced}
              count={selection.countries.length}
              canEdit={canEdit('workbooks')}
            >
              <CountryPicker
                selected={selection.countries}
                onChange={(countries) => setSelection((s) => ({ ...s, countries }))}
                max={maxFor('country')}
              />
            </AxisBlock>

            <AxisBlock
              axis="variable"
              forced={forced}
              count={selection.variables.length}
              canEdit={canEdit('workbooks')}
            >
              <VariablePicker
                variables={variables ?? []}
                selected={selection.variables}
                onChange={(vars) => setSelection((s) => ({ ...s, variables: vars }))}
                max={maxFor('variable')}
              />
            </AxisBlock>

            <AxisBlock
              axis="year"
              forced={forced}
              count={selection.years.length}
              canEdit={canEdit('workbooks')}
            >
              <YearPicker
                selected={selection.years}
                onChange={(years) => setSelection((s) => ({ ...s, years }))}
                max={maxFor('year')}
              />
            </AxisBlock>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ShapeSummary
            shape={shape}
            problem={problem}
            candidates={candidates}
            preferred={preferredType}
            onPrefer={setPreferredType}
            selection={selection}
            onOpen={open}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-[length:var(--text-body)]">Demo shortcuts</CardTitle>
              <CardDescription className="text-[length:var(--text-meta)]">
                Prototype-only — these build a selection so a presenter does not have to.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEMO_SHORTCUTS.map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => {
                    const next = shortcut.build()
                    setSelection(next)
                    setPreferredType(null)
                  }}
                  className="w-full rounded border border-who-border bg-who-surface px-3 py-2 text-left transition-colors hover:border-who-primary-blue"
                >
                  <span className="flex items-center gap-1.5 text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                    <Table2 className="size-3.5" aria-hidden />
                    {shortcut.label}
                  </span>
                  <span className="text-[length:var(--text-meta)] text-who-text-muted">
                    {shortcut.description}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   One axis
   -------------------------------------------------------------------------- */

function AxisBlock({
  axis,
  forced,
  count,
  canEdit,
  children,
}: {
  axis: AxisId
  forced: AxisId | null
  count: number
  canEdit: boolean
  children: React.ReactNode
}) {
  const isForced = forced === axis

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
          {AXIS_LABELS[axis]}
        </Label>
        <span className="flex items-center gap-2">
          {isForced ? (
            <Badge variant="outline" className="gap-1 border-who-warn/50 text-who-warn">
              <Lock className="size-3" aria-hidden />
              single — the other two axes are multi
            </Badge>
          ) : count > 1 ? (
            <Badge variant="secondary">{count} selected</Badge>
          ) : null}
          {!canEdit ? (
            <Badge variant="outline" className="text-[length:var(--text-meta)]">
              view only
            </Badge>
          ) : null}
        </span>
      </div>
      {children}
    </div>
  )
}

/* --------------------------------------------------------------------------
   The resolved shape
   -------------------------------------------------------------------------- */

function ShapeSummary({
  shape,
  problem,
  candidates,
  preferred,
  onPrefer,
  selection,
  onOpen,
}: {
  shape: ReturnType<typeof resolveShape>['shape']
  problem: ReturnType<typeof resolveShape>['problem']
  candidates: WorkbookType[]
  preferred: WorkbookType | null
  onPrefer: (t: WorkbookType) => void
  selection: WorkbookSelection
  onOpen: () => void
}) {
  const cellCount = useMemo(() => {
    if (!shape) return 0
    const rows =
      shape.rowAxis === 'variable'
        ? selection.variables.length
        : shape.rowAxis === 'country'
          ? selection.countries.length
          : selection.years.length
    const columns =
      shape.colAxis === 'year'
        ? selection.years.length
        : shape.colAxis === 'country'
          ? selection.countries.length
          : selection.variables.length
    return rows * columns
  }, [shape, selection])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[length:var(--text-body)]">
          {shape ? WORKBOOK_TYPE_LABELS[shape.type] : 'Not a workbook yet'}
        </CardTitle>
        <CardDescription className="text-[length:var(--text-meta)]">
          {shape ? WORKBOOK_TYPE_DESCRIPTIONS[shape.type] : problem?.message}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Two single axes means the selection is legitimately two workbooks. */}
        {candidates.length > 1 ? (
          <div>
            <p className="mb-1.5 flex items-start gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              This selection reads as more than one workbook. Pick which.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={(preferred ?? shape?.type) === t ? 'default' : 'outline'}
                  onClick={() => onPrefer(t)}
                >
                  {WORKBOOK_TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {shape ? (
          <dl className="space-y-1 text-[length:var(--text-meta)]">
            <Row label="Down the side">{AXIS_LABELS[shape.rowAxis]}</Row>
            <Row label="Across the top">{AXIS_LABELS[shape.colAxis]}</Row>
            <Row label="Cells">
              <span className={cn(cellCount > 20_000 && 'text-who-warn')}>
                {cellCount.toLocaleString('en-GB')}
              </span>
            </Row>
          </dl>
        ) : null}

        <Button className="w-full gap-1.5" disabled={!shape} onClick={onOpen}>
          Open workbook
          <ArrowRight className="size-3.5" />
        </Button>

        {shape && LAST_YEAR ? (
          <p className="text-[length:var(--text-meta)] text-who-text-muted">
            The selection travels in the URL, so this workbook is a shareable link.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-who-text-muted">{label}</dt>
      <dd className="font-semibold text-who-heading">{children}</dd>
    </div>
  )
}
