/**
 * The report builder (UC036, UC037).
 *
 * *"Administrator can build a report by selecting rows, columns, values,
 * filters and groupings, similar to Excel Pivot Tables functionality."* So the
 * screen is an Excel field list: a palette on the left, four buckets on the
 * right, drag between them.
 *
 * Two things it does that a naive pivot builder does not, both because the
 * observation model here is not a flat table:
 *
 *  · **Values are measures, not fields.** Every observation carries exactly one
 *    number, so dragging `Country` into Values would be meaningless. The
 *    palette therefore offers the five aggregations of that one measure as
 *    draggable items of their own, and the Values bucket accepts only those.
 *    Pretending otherwise would give the user four ways to build the same
 *    column and no way to build an average.
 *  · **Grouping is a property of a placed field**, not a fifth bucket. UC036's
 *    *"groupings"* is an Excel subtotal break, which in Excel is a checkbox on
 *    the field you already placed — so it is a toggle on the chip.
 *
 * The preview is live and deliberately small: three countries and five years,
 * refreshed shortly after the layout stops changing. A full-scope preview on
 * every drag would fire an xMart query per gesture, and the shape of the table
 * is what a preview is for.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  Filter,
  GripVertical,
  Info,
  RefreshCw,
  Save,
  Sigma,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CountryPicker } from '@/components/common/CountryPicker'
import { EmptyState, LoadingState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { VariablePicker } from '@/components/common/VariablePicker'
import { YEARS } from '@/domain/constants'
import {
  REPORT_AGGREGATION_LABELS,
  REPORT_AGGREGATIONS,
  REPORT_FIELD_DEFS,
  REPORT_FIELD_SOURCE_LABELS,
  fieldsBySource,
  isReportField,
  placement,
  reportProblems,
  type ReportAggregation,
  type ReportDefinition,
  type ReportFieldId,
  type ReportFieldPlacement,
  type ReportValueField,
} from '@/domain/report'
import { REPORT_DEMO_COUNTRIES } from '@/data/seed/reports'
import { usePermissions } from '@/hooks/usePermissions'
import { useReportRun } from '@/hooks/useReportRun'
import { useCountries, useFormulas, useVariables } from '@/hooks/useSetupData'
import { allReports, useReportStore } from '@/stores/reportStore'
import { cn } from '@/lib/utils'
import { PivotTableView } from './PivotTableView'
import { filterOptions } from './filterOptions'
import { PresentationControls } from './PresentationControls'

type BucketId = 'rows' | 'columns' | 'values' | 'filters'

const BUCKET_LABELS: Record<BucketId, string> = {
  rows: 'Rows',
  columns: 'Columns',
  values: 'Values',
  filters: 'Filters',
}

const BUCKET_HINTS: Record<BucketId, string> = {
  rows: 'Down the side. Nest a second field inside the first and switch on its subtotal.',
  columns: 'Across the top. Years belong here — it is the layout the HA team reads in.',
  values: 'What each cell shows. One measure, five ways of combining it.',
  filters: 'Narrows what the report reads before anything is aggregated.',
}

/* ==========================================================================
   PALETTE
   ========================================================================== */

function PaletteItem({
  id,
  label,
  hint,
  disabled,
  icon,
}: {
  id: string
  label: string
  hint: string
  disabled: boolean
  icon?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'flex w-full cursor-grab items-start gap-2 rounded border border-who-border bg-who-surface px-2.5 py-1.5 text-left',
        'hover:border-who-primary-blue active:cursor-grabbing',
        disabled && 'cursor-not-allowed opacity-45 hover:border-who-border',
        isDragging && 'z-50 opacity-80 shadow-who-card',
      )}
      {...attributes}
      {...listeners}
    >
      {icon ?? <GripVertical className="mt-0.5 size-3.5 shrink-0 text-who-icon" />}
      <span className="min-w-0">
        <span className="block truncate text-[length:var(--text-body-sm)] text-who-text">
          {label}
        </span>
        <span className="block truncate text-[length:var(--text-meta)] text-who-text-muted">
          {hint}
        </span>
      </span>
    </button>
  )
}

/* ==========================================================================
   CHIPS INSIDE A BUCKET
   ========================================================================== */

function FieldChip({
  bucket,
  placementValue,
  onSort,
  onSubtotal,
  onRemove,
}: {
  bucket: BucketId
  placementValue: ReportFieldPlacement
  onSort: () => void
  onSubtotal: (on: boolean) => void
  onRemove: () => void
}) {
  const id = `${bucket}:${placementValue.field}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const def = REPORT_FIELD_DEFS[placementValue.field]

  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-who-border bg-who-surface py-1 pr-1 pl-2',
        isDragging && 'z-50 opacity-80 shadow-who-card',
      )}
    >
      <button
        type="button"
        aria-label={`Move ${def.label}`}
        className="cursor-grab text-who-icon hover:text-who-primary-blue active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      <span className="text-[length:var(--text-body-sm)] text-who-text">{def.label}</span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSort}
            aria-label={`Sort ${def.label} ${placementValue.sort === 'asc' ? 'descending' : 'ascending'}`}
            className="rounded p-0.5 text-who-icon hover:text-who-primary-blue"
          >
            {placementValue.sort === 'asc' ? (
              <ArrowUpAZ className="size-3.5" />
            ) : (
              <ArrowDownAZ className="size-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Sorted {placementValue.sort === 'asc' ? 'ascending' : 'descending'} — click to reverse
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSubtotal(!placementValue.subtotal)}
            aria-label={`${placementValue.subtotal ? 'Remove' : 'Add'} subtotal after each ${def.label}`}
            aria-pressed={placementValue.subtotal}
            className={cn(
              'rounded p-0.5',
              placementValue.subtotal
                ? 'bg-who-cell-indicator text-who-heading'
                : 'text-who-icon hover:text-who-primary-blue',
            )}
          >
            <Sigma className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          UC036’s “grouping”: a subtotal line after each {def.label.toLowerCase()}. It has no
          effect on the innermost field, where it would repeat the line above it.
        </TooltipContent>
      </Tooltip>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${def.label} from ${BUCKET_LABELS[bucket]}`}
        className="rounded p-0.5 text-who-icon hover:text-who-fail"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}

function ValueChip({
  value,
  onAggregation,
  onRemove,
}: {
  value: ReportValueField
  onAggregation: (a: ReportAggregation) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `values:${value.id}`,
  })
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-who-border bg-who-surface py-1 pr-1 pl-2',
        isDragging && 'z-50 opacity-80 shadow-who-card',
      )}
    >
      <button
        type="button"
        aria-label={`Move ${value.label}`}
        className="cursor-grab text-who-icon hover:text-who-primary-blue active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <Select value={value.aggregation} onValueChange={(v) => onAggregation(v as ReportAggregation)}>
        <SelectTrigger size="sm" className="h-6 w-44" aria-label={`Aggregation for ${value.label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_AGGREGATIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {REPORT_AGGREGATION_LABELS[a]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${value.label} from Values`}
        className="rounded p-0.5 text-who-icon hover:text-who-fail"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}

/* ==========================================================================
   THE BUCKET
   ========================================================================== */

function Bucket({
  id,
  count,
  children,
}: {
  id: BucketId
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket:${id}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded border border-dashed p-2.5 transition-colors',
        isOver ? 'border-who-primary-blue bg-who-accent-subtle' : 'border-who-border',
      )}
    >
      <p className="mb-1 flex items-center gap-2 text-[length:var(--text-meta)] tracking-wide text-who-heading uppercase">
        {BUCKET_LABELS[id]}
        <span className="font-normal text-who-text-muted normal-case">{count}</span>
      </p>
      <p className="mb-2 text-[length:var(--text-meta)] text-who-text-muted">{BUCKET_HINTS[id]}</p>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {count === 0 ? (
          <span className="text-[length:var(--text-meta)] text-who-hint">
            Drag a field here
          </span>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   THE PAGE
   ========================================================================== */

/** Preview scope: enough to show the shape, small enough to be instant. */
const PREVIEW_COUNTRIES = 3
const PREVIEW_YEARS = 5
const PREVIEW_DEBOUNCE_MS = 600

export function ReportBuilderPage() {
  const { reportId = '' } = useParams()
  const navigate = useNavigate()
  const { user, canEdit, canCreatePredefined } = usePermissions()

  const definitionEdits = useReportStore((s) => s.definitionEdits)
  const removedIds = useReportStore((s) => s.removedIds)
  const saveReport = useReportStore((s) => s.saveReport)

  const { data: variables } = useVariables()
  const { data: countries } = useCountries()
  const { data: formulas } = useFormulas()

  const existing = useMemo(
    () => allReports(definitionEdits, removedIds).find((r) => r.id === reportId),
    [definitionEdits, removedIds, reportId],
  )

  const [draft, setDraft] = useState<ReportDefinition | null>(existing ?? null)
  useEffect(() => {
    if (existing && draft?.id !== existing.id) setDraft(existing)
  }, [existing, draft?.id])

  const canEditThis =
    draft != null &&
    (draft.scope === 'predefined'
      ? canCreatePredefined('reports')
      : draft.createdBy === user?.email && canEdit('reports'))

  /* --- drag ------------------------------------------------------------- */

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const [dragging, setDragging] = useState<string | null>(null)

  const handleDragStart = (e: DragStartEvent) => setDragging(String(e.active.id))

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const { active, over } = event
    if (!over || !draft || !canEditThis) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Target bucket: either a bucket surface or a chip already inside one.
    const target: BucketId | null = overId.startsWith('bucket:')
      ? (overId.slice('bucket:'.length) as BucketId)
      : (overId.split(':')[0] as BucketId)
    if (!target || !(target in BUCKET_LABELS)) return

    /* Measures from the palette → Values only. */
    if (activeId.startsWith('measure:')) {
      if (target !== 'values') return
      const aggregation = activeId.slice('measure:'.length) as ReportAggregation
      addValue(aggregation)
      return
    }

    /* Dimension fields from the palette → rows, columns or filters. */
    if (activeId.startsWith('palette:')) {
      const field = activeId.slice('palette:'.length)
      if (!isReportField(field) || target === 'values') return
      addField(target, field, overId)
      return
    }

    /* Moving something already placed. */
    const [sourceBucket, key] = activeId.split(':') as [BucketId, string]
    if (!key) return

    if (sourceBucket === 'values') {
      if (target !== 'values') return
      reorderValues(key, overId)
      return
    }
    if (target === 'values') return
    if (!isReportField(key)) return

    if (sourceBucket === target) reorderFields(target, key, overId)
    else moveField(sourceBucket, target, key, overId)
  }

  /* --- mutations -------------------------------------------------------- */

  const update = useCallback((patch: Partial<ReportDefinition>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }, [])

  function placementsOf(d: ReportDefinition, bucket: BucketId): ReportFieldPlacement[] {
    return bucket === 'rows' ? d.rows : bucket === 'columns' ? d.columns : []
  }

  function indexOfOver(list: { field?: ReportFieldId; id?: string }[], overId: string): number {
    const key = overId.split(':')[1]
    if (key == null) return -1
    return list.findIndex((x) => (x.field ?? x.id) === key)
  }

  function addField(bucket: BucketId, field: ReportFieldId, overId: string) {
    setDraft((d) => {
      if (!d) return d
      if (bucket === 'filters') {
        if (d.filters.some((f) => f.field === field)) return d
        return { ...d, filters: [...d.filters, { field, values: [], exclude: false }] }
      }
      // A field can only sit on one axis; moving it there is what the user
      // meant, and `reportProblems` would otherwise reject the definition.
      const rows = d.rows.filter((p) => p.field !== field)
      const columns = d.columns.filter((p) => p.field !== field)
      const target = bucket === 'rows' ? rows : columns
      const at = indexOfOver(target, overId)
      const next = [...target]
      next.splice(at < 0 ? next.length : at, 0, placement(field))
      return bucket === 'rows' ? { ...d, rows: next, columns } : { ...d, rows, columns: next }
    })
  }

  function reorderFields(bucket: BucketId, field: ReportFieldId, overId: string) {
    setDraft((d) => {
      if (!d) return d
      const list = placementsOf(d, bucket)
      const from = list.findIndex((p) => p.field === field)
      const to = indexOfOver(list, overId)
      if (from < 0 || to < 0 || from === to) return d
      const next = arrayMove(list, from, to)
      return bucket === 'rows' ? { ...d, rows: next } : { ...d, columns: next }
    })
  }

  function moveField(from: BucketId, to: BucketId, field: ReportFieldId, overId: string) {
    setDraft((d) => {
      if (!d) return d
      const carried =
        from === 'filters'
          ? placement(field)
          : (placementsOf(d, from).find((p) => p.field === field) ?? placement(field))

      const rows = d.rows.filter((p) => p.field !== field)
      const columns = d.columns.filter((p) => p.field !== field)
      const filters = d.filters.filter((f) => f.field !== field)

      if (to === 'filters') {
        return { ...d, rows, columns, filters: [...filters, { field, values: [], exclude: false }] }
      }
      const target = to === 'rows' ? rows : columns
      const at = indexOfOver(target, overId)
      const next = [...target]
      next.splice(at < 0 ? next.length : at, 0, carried)
      return to === 'rows'
        ? { ...d, rows: next, columns, filters }
        : { ...d, rows, columns: next, filters }
    })
  }

  function addValue(aggregation: ReportAggregation) {
    setDraft((d) => {
      if (!d) return d
      if (d.values.some((v) => v.aggregation === aggregation)) return d
      return {
        ...d,
        values: [
          ...d.values,
          {
            id: `value-${aggregation}`,
            label: REPORT_AGGREGATION_LABELS[aggregation],
            aggregation,
          },
        ],
      }
    })
  }

  function reorderValues(id: string, overId: string) {
    setDraft((d) => {
      if (!d) return d
      const from = d.values.findIndex((v) => v.id === id)
      const to = indexOfOver(d.values, overId)
      if (from < 0 || to < 0 || from === to) return d
      return { ...d, values: arrayMove(d.values, from, to) }
    })
  }

  /* --- live preview ------------------------------------------------------ */

  const { run, isRunning } = useReportRun()
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof run>>>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewParameters = useMemo(() => {
    if (!draft) return null
    const scope = draft.countries.length > 0 ? draft.countries : [...REPORT_DEMO_COUNTRIES]
    const yearTo = draft.yearTo
    return {
      countries: scope.slice(0, PREVIEW_COUNTRIES),
      variables: draft.variables,
      yearFrom: Math.max(draft.yearFrom, yearTo - (PREVIEW_YEARS - 1)),
      yearTo,
      presentation: draft.presentation,
      delivery: 'screen' as const,
      language: draft.presentation.language,
    }
  }, [draft])

  const problems = draft ? reportProblems(draft) : []
  const canPreview =
    draft != null && previewParameters != null && problems.length === 0 && draft.variables.length > 0

  const refreshPreview = useCallback(async () => {
    if (!draft || !previewParameters) return
    const outcome = await run(draft, previewParameters)
    setPreview(outcome)
  }, [draft, previewParameters, run])

  // Debounced: the layout is dragged in bursts and one query per gesture would
  // be several per second.
  useEffect(() => {
    if (!canPreview) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void refreshPreview(), PREVIEW_DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [canPreview, refreshPreview])

  /* --- render ------------------------------------------------------------ */

  if (!draft) {
    return (
      <>
        <PageHeader title="Report builder" />
        <EmptyState
          message="That report does not exist"
          hint="It may have been deleted, or it belongs to another user (UC037)."
          action={
            <Button asChild>
              <Link to="/reports">Back to Reports</Link>
            </Button>
          }
        />
      </>
    )
  }

  const paletteGroups = fieldsBySource()
  const placedFields = new Set<ReportFieldId>([
    ...draft.rows.map((p) => p.field),
    ...draft.columns.map((p) => p.field),
    ...draft.filters.map((f) => f.field),
  ])

  return (
    <>
      <PageHeader
        title={canEditThis ? 'Report builder' : 'Report layout'}
        description={
          canEditThis
            ? 'Drag fields between the buckets, exactly as an Excel pivot table is built. The preview refreshes as you go.'
            : 'You can see how this report is built and run it. Editing it is reserved to its author or an administrator.'
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/reports">
                <ArrowLeft className="size-3.5" />
                All reports
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/reports/run/${draft.id}`}>Run</Link>
            </Button>
            {canEditThis ? (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={problems.length > 0}
                onClick={() => {
                  saveReport(draft)
                  toast.success(`Saved "${draft.name}".`, {
                    description:
                      draft.scope === 'predefined'
                        ? 'Predefined — every user can find and run it (UC036).'
                        : 'Custom — visible to you only (UC037).',
                  })
                  navigate('/reports')
                }}
              >
                <Save className="size-3.5" />
                Save
              </Button>
            ) : null}
          </>
        }
      />

      {problems.length > 0 ? (
        <Card className="mb-4 border-who-fail/40">
          <CardContent className="px-4 py-3">
            <p className="mb-1 text-[length:var(--text-body-sm)] font-semibold text-who-fail">
              This report cannot be saved yet
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-[length:var(--text-meta)] text-who-text">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* --- palette --------------------------------------------------- */}
          <Card className="h-fit">
            <CardContent className="space-y-3 px-3 py-3">
              <p className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                Fields
              </p>

              {paletteGroups.map((group) => (
                <div key={group.source} className="space-y-1.5">
                  <p className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                    {REPORT_FIELD_SOURCE_LABELS[group.source]}
                  </p>
                  {group.fields.map((f) => (
                    <PaletteItem
                      key={f.id}
                      id={`palette:${f.id}`}
                      label={f.label}
                      hint={f.hint}
                      disabled={!canEditThis || placedFields.has(f.id)}
                    />
                  ))}
                </div>
              ))}

              <div className="space-y-1.5 border-t border-who-border pt-3">
                <p className="flex items-center gap-1.5 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                  Measures
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3 text-who-icon" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      An observation carries one number, so there is one measure — the value —
                      and five ways of combining it. Drag one into Values.
                    </TooltipContent>
                  </Tooltip>
                </p>
                {REPORT_AGGREGATIONS.map((a) => (
                  <PaletteItem
                    key={a}
                    id={`measure:${a}`}
                    label={REPORT_AGGREGATION_LABELS[a]}
                    hint="of the observation value"
                    disabled={!canEditThis || draft.values.some((v) => v.aggregation === a)}
                    icon={<Sigma className="mt-0.5 size-3.5 shrink-0 text-who-icon" />}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* --- buckets --------------------------------------------------- */}
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Bucket id="rows" count={draft.rows.length}>
                <SortableContext
                  items={draft.rows.map((p) => `rows:${p.field}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  {draft.rows.map((p) => (
                    <FieldChip
                      key={p.field}
                      bucket="rows"
                      placementValue={p}
                      onSort={() =>
                        update({
                          rows: draft.rows.map((x) =>
                            x.field === p.field
                              ? { ...x, sort: x.sort === 'asc' ? 'desc' : 'asc' }
                              : x,
                          ),
                        })
                      }
                      onSubtotal={(on) =>
                        update({
                          rows: draft.rows.map((x) =>
                            x.field === p.field ? { ...x, subtotal: on } : x,
                          ),
                        })
                      }
                      onRemove={() =>
                        update({ rows: draft.rows.filter((x) => x.field !== p.field) })
                      }
                    />
                  ))}
                </SortableContext>
              </Bucket>

              <Bucket id="columns" count={draft.columns.length}>
                <SortableContext
                  items={draft.columns.map((p) => `columns:${p.field}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  {draft.columns.map((p) => (
                    <FieldChip
                      key={p.field}
                      bucket="columns"
                      placementValue={p}
                      onSort={() =>
                        update({
                          columns: draft.columns.map((x) =>
                            x.field === p.field
                              ? { ...x, sort: x.sort === 'asc' ? 'desc' : 'asc' }
                              : x,
                          ),
                        })
                      }
                      onSubtotal={(on) =>
                        update({
                          columns: draft.columns.map((x) =>
                            x.field === p.field ? { ...x, subtotal: on } : x,
                          ),
                        })
                      }
                      onRemove={() =>
                        update({ columns: draft.columns.filter((x) => x.field !== p.field) })
                      }
                    />
                  ))}
                </SortableContext>
              </Bucket>

              <Bucket id="values" count={draft.values.length}>
                <SortableContext
                  items={draft.values.map((v) => `values:${v.id}`)}
                  strategy={horizontalListSortingStrategy}
                >
                  {draft.values.map((v) => (
                    <ValueChip
                      key={v.id}
                      value={v}
                      onAggregation={(a) =>
                        update({
                          values: draft.values.map((x) =>
                            x.id === v.id
                              ? {
                                  ...x,
                                  aggregation: a,
                                  id: `value-${a}`,
                                  label: REPORT_AGGREGATION_LABELS[a],
                                }
                              : x,
                          ),
                        })
                      }
                      onRemove={() =>
                        update({ values: draft.values.filter((x) => x.id !== v.id) })
                      }
                    />
                  ))}
                </SortableContext>
              </Bucket>

              <Bucket id="filters" count={draft.filters.length}>
                {draft.filters.map((f) => (
                  <FilterChip
                    key={f.field}
                    field={f.field}
                    values={f.values}
                    exclude={f.exclude}
                    options={
                      countries && variables && formulas
                        ? filterOptions({
                            field: f.field,
                            countries,
                            variables,
                            formulas,
                            reportVariables: draft.variables,
                          })
                        : []
                    }
                    disabled={!canEditThis}
                    onChange={(values, exclude) =>
                      update({
                        filters: draft.filters.map((x) =>
                          x.field === f.field ? { ...x, values, exclude } : x,
                        ),
                      })
                    }
                    onRemove={() =>
                      update({ filters: draft.filters.filter((x) => x.field !== f.field) })
                    }
                  />
                ))}
              </Bucket>
            </div>

            {dragging?.startsWith('measure:') ? (
              <p className="text-[length:var(--text-meta)] text-who-primary-blue">
                Measures go in Values.
              </p>
            ) : null}

            {/* --- identity and defaults ---------------------------------- */}
            <Card>
              <CardContent className="grid gap-3 px-4 py-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="report-name">Name</Label>
                  <Input
                    id="report-name"
                    value={draft.name}
                    disabled={!canEditThis}
                    onChange={(e) => update({ name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="report-folder">Group</Label>
                  <Input
                    id="report-folder"
                    value={draft.folder}
                    disabled={!canEditThis}
                    onChange={(e) => update({ folder: e.target.value.toUpperCase() })}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="report-description">Description</Label>
                  <Textarea
                    id="report-description"
                    value={draft.description}
                    disabled={!canEditThis}
                    onChange={(e) => update({ description: e.target.value })}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Default countries</Label>
                  <p className="mt-0.5 mb-1 text-[length:var(--text-meta)] text-who-text-muted">
                    A starting point — whoever runs the report can change it (UC036).
                  </p>
                  <CountryPicker
                    selected={draft.countries}
                    onChange={(c) => update({ countries: c })}
                    placeholder="Prompt the user each time…"
                    ariaLabel="Default countries"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Variables</Label>
                  <p className="mt-0.5 mb-1 text-[length:var(--text-meta)] text-who-text-muted">
                    What the report reads. Aggregates and indicators are resolved by the formula
                    engine, so `CHE%GDP` works here exactly as it does in a workbook.
                  </p>
                  <VariablePicker
                    variables={variables ?? []}
                    selected={draft.variables}
                    onChange={(v) => update({ variables: v })}
                    placeholder="Select variables…"
                  />
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor="report-year-from" className="text-[length:var(--text-meta)]">
                      From year
                    </Label>
                    <Select
                      value={String(draft.yearFrom)}
                      onValueChange={(v) =>
                        update({ yearFrom: Math.min(Number(v), draft.yearTo) })
                      }
                      disabled={!canEditThis}
                    >
                      <SelectTrigger id="report-year-from" className="mt-1 w-28">
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
                    <Label htmlFor="report-year-to" className="text-[length:var(--text-meta)]">
                      To year
                    </Label>
                    <Select
                      value={String(draft.yearTo)}
                      onValueChange={(v) => update({ yearTo: Math.max(Number(v), draft.yearFrom) })}
                      disabled={!canEditThis}
                    >
                      <SelectTrigger id="report-year-to" className="mt-1 w-28">
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

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-who-text">
                    <Switch
                      checked={draft.grandTotal}
                      disabled={!canEditThis}
                      onCheckedChange={(v) => update({ grandTotal: v })}
                      aria-label="Grand total"
                    />
                    Grand total row and column
                  </label>
                  <label className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-who-text">
                    <Switch
                      checked={draft.oneFilePerCountry}
                      disabled={!canEditThis}
                      onCheckedChange={(v) => update({ oneFilePerCountry: v })}
                      aria-label="One Excel file per country"
                    />
                    One Excel file per country (UC036)
                  </label>
                  <label className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-who-text">
                    <Switch
                      checked={draft.isHeavy}
                      disabled={!canEditThis}
                      onCheckedChange={(v) => update({ isHeavy: v })}
                      aria-label="Always run in the background"
                    />
                    Heavy — always run in the background (UC042)
                  </label>
                </div>

                <div className="md:col-span-2">
                  <PresentationControls
                    presentation={draft.presentation}
                    disabled={!canEditThis}
                    onChange={(p) => update({ presentation: p })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* --- preview -------------------------------------------------- */}
            <Card>
              <CardContent className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                    Preview
                  </p>
                  <Badge variant="secondary">
                    {previewParameters?.countries.length ?? 0} countries ·{' '}
                    {previewParameters?.yearFrom}–{previewParameters?.yearTo}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto gap-1.5"
                    disabled={!canPreview || isRunning}
                    onClick={() => void refreshPreview()}
                  >
                    <RefreshCw className={cn('size-3.5', isRunning && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>

                {!canPreview ? (
                  <EmptyState
                    message="Nothing to preview yet"
                    hint="Choose the variables the report reads, and put at least one measure in Values."
                  />
                ) : isRunning && !preview ? (
                  <LoadingState label="Building the preview…" />
                ) : preview ? (
                  <PivotTableView
                    table={preview.table}
                    decimals={draft.presentation.decimals}
                    maxRows={40}
                  />
                ) : (
                  <LoadingState label="Building the preview…" />
                )}
              </CardContent>
            </Card>
          </div>
        </DndContext>
      </div>
    </>
  )
}

/* ==========================================================================
   FILTER CHIP
   ========================================================================== */

function FilterChip({
  field,
  values,
  exclude,
  options,
  disabled,
  onChange,
  onRemove,
}: {
  field: ReportFieldId
  values: string[]
  exclude: boolean
  options: { value: string; label: string }[]
  disabled: boolean
  onChange: (values: string[], exclude: boolean) => void
  onRemove: () => void
}) {
  const def = REPORT_FIELD_DEFS[field]
  return (
    <span className="inline-flex items-center gap-1 rounded border border-who-border bg-who-surface py-1 pr-1 pl-2">
      <Filter className="size-3.5 text-who-icon" />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="text-[length:var(--text-body-sm)] text-who-text hover:text-who-primary-blue disabled:cursor-not-allowed"
          >
            {def.label}
            <span className="ml-1 text-who-text-muted">
              {values.length === 0
                ? '(none selected)'
                : `${exclude ? 'not ' : ''}${values.length} selected`}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="flex items-center justify-between border-b border-who-border px-3 py-2">
            <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
              {def.label}
            </span>
            <label className="flex items-center gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
              <Checkbox
                checked={exclude}
                onCheckedChange={(v) => onChange(values, v === true)}
                aria-label="Exclude these values instead"
              />
              Exclude
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {options.length === 0 ? (
              <p className="px-2 py-3 text-[length:var(--text-meta)] text-who-text-muted">
                Choose the report’s variables first — the values on offer depend on them.
              </p>
            ) : (
              options.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[length:var(--text-body-sm)] hover:bg-accent"
                >
                  <Checkbox
                    checked={values.includes(o.value)}
                    onCheckedChange={() =>
                      onChange(
                        values.includes(o.value)
                          ? values.filter((v) => v !== o.value)
                          : [...values, o.value],
                        exclude,
                      )
                    }
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove the ${def.label} filter`}
        className="rounded p-0.5 text-who-icon hover:text-who-fail"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}
