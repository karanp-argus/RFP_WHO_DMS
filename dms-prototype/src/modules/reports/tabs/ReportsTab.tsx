/**
 * The report list (UC035, UC040).
 *
 * *"User can view reports grouped into a) Predefined and Custom reports and
 * b) Data Tracking Report"* — the second grouping is the tab beside this one.
 * Within this tab the two sections are Predefined and My custom reports,
 * because those are the two things UC035 names and because they answer
 * different questions: "what can I run" and "what did I build".
 *
 * **UC040 in full.** *"Reports appear in alphabetical order by default. The
 * user can click and drag & drop any report into any order in the list. The
 * user logs off and on again ... the report is displayed in the order as per
 * the action above."* Persistence is therefore the acceptance criterion, not a
 * nicety, so the order lives in `reportStore` keyed by user — as do favourites,
 * which the same use case requires be *"considered as such only for the user
 * who flagged them, not for the rest of users"*.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Copy,
  GripVertical,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/common/EmptyState'
import { DEMO_NOW } from '@/domain/constants'
import {
  REPORT_AGGREGATION_LABELS,
  REPORT_FIELD_DEFS,
  duplicateReport,
  emptyReport,
  type ReportDefinition,
} from '@/domain/report'
import { usePermissions } from '@/hooks/usePermissions'
import {
  allReports,
  isReportModified,
  orderReports,
  useReportStore,
  visibleReports,
} from '@/stores/reportStore'
import { cn } from '@/lib/utils'

/* --------------------------------------------------------------------------
   One row
   -------------------------------------------------------------------------- */

interface RowActions {
  onRun: () => void
  onEdit: () => void
  onDuplicate: () => void
  onReset: () => void
  onRemove: () => void
  onToggleFavourite: () => void
}

function ReportRow({
  report,
  isFavourite,
  canEditThis,
  canCreate,
  modified,
  actions,
}: {
  report: ReportDefinition
  isFavourite: boolean
  canEditThis: boolean
  canCreate: boolean
  modified: boolean
  actions: RowActions
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: report.id,
  })

  const shape = [
    report.rows.length > 0
      ? `Rows: ${report.rows.map((p) => REPORT_FIELD_DEFS[p.field].label).join(' › ')}`
      : null,
    report.columns.length > 0
      ? `Columns: ${report.columns.map((p) => REPORT_FIELD_DEFS[p.field].label).join(' › ')}`
      : null,
    `Values: ${report.values.map((v) => REPORT_AGGREGATION_LABELS[v.aggregation]).join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-start gap-3 border-b border-who-border/60 px-3 py-3 last:border-b-0',
        'hover:bg-who-accent-subtle',
        isDragging && 'relative z-10 opacity-80 shadow-who-card',
      )}
    >
      {/* UC040 — drag to reorder. */}
      <button
        type="button"
        aria-label={`Reorder ${report.name}`}
        className="mt-1 cursor-grab text-who-icon hover:text-who-primary-blue active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* UC040 — favourites, per user. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={actions.onToggleFavourite}
            aria-label={`${isFavourite ? 'Remove' : 'Add'} ${report.name} ${isFavourite ? 'from' : 'to'} favourites`}
            aria-pressed={isFavourite}
            className="mt-0.5"
          >
            <Star
              className={cn(
                'size-4 transition-colors',
                isFavourite
                  ? 'fill-who-warn text-who-warn'
                  : 'text-who-icon hover:text-who-warn',
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isFavourite ? 'A favourite of yours' : 'Flag as a favourite — yours only (UC040)'}
        </TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={actions.onRun}
            className="text-left text-[length:var(--text-body-sm)] font-semibold text-who-heading hover:text-who-primary-blue hover:underline"
          >
            {report.name}
          </button>
          <Badge variant={report.scope === 'predefined' ? 'secondary' : 'outline'}>
            {report.scope === 'predefined' ? 'Predefined' : 'Custom'}
          </Badge>
          {report.isHeavy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-who-warn/50 text-who-warn">
                  Heavy
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Always runs in the background so DMS stays usable while it builds (UC042).
              </TooltipContent>
            </Tooltip>
          ) : null}
          {report.oneFilePerCountry ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-who-text-muted">
                  One file per country
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                A multi-country run produces one Excel file per country, as UC036 describes.
              </TooltipContent>
            </Tooltip>
          ) : null}
          {modified ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-who-warn/50 text-who-warn">
                  Edited
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Changed from the definition DMS shipped with. Reset restores it.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <p className="mt-1 max-w-3xl text-[length:var(--text-meta)] text-who-text-muted">
          {report.description}
        </p>
        <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">{shape}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={actions.onRun}>
              <Play className="size-3.5" />
              <span className="sr-only">Run {report.name}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run this report</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={actions.onEdit}>
              <Pencil className="size-3.5" />
              <span className="sr-only">{canEditThis ? 'Edit' : 'View'} {report.name}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{canEditThis ? 'Edit' : 'View'} the pivot layout</TooltipContent>
        </Tooltip>

        {/* UC038 — copy any report as the basis for a new custom one. */}
        {canCreate ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={actions.onDuplicate}
              >
                <Copy className="size-3.5" />
                <span className="sr-only">Duplicate {report.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate as a custom report (UC038)</TooltipContent>
          </Tooltip>
        ) : null}

        {canEditThis && report.isDelivered && modified ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={actions.onReset}>
                <RotateCcw className="size-3.5" />
                <span className="sr-only">Reset {report.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to the delivered definition</TooltipContent>
          </Tooltip>
        ) : null}

        {canEditThis && !report.isDelivered ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-who-fail"
                onClick={actions.onRemove}
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete {report.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete this report</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </li>
  )
}

/* --------------------------------------------------------------------------
   The tab
   -------------------------------------------------------------------------- */

export function ReportsTab() {
  const navigate = useNavigate()
  const { user, canEdit, canCreatePredefined } = usePermissions()

  /**
   * Two different rights, the same split Phase 5 got wrong once and fixed.
   *
   *  · **Creating a report** is a regular-user right: UC037 is written from a
   *    regular user's point of view and gives them custom reports of their own.
   *  · **Creating or changing a report everyone else runs** is not. UC036 is
   *    explicitly an administrator use case, and `canCreatePredefined` is the
   *    permission level that means "may author something everybody gets".
   */
  const canCreate = canEdit('reports')
  const canEditShared = canCreatePredefined('reports')
  const canEditReport = (r: ReportDefinition) =>
    r.scope === 'predefined' ? canEditShared : r.createdBy === user?.email

  const definitionEdits = useReportStore((s) => s.definitionEdits)
  const removedIds = useReportStore((s) => s.removedIds)
  const favouritesByUser = useReportStore((s) => s.favouritesByUser)
  const orderByUser = useReportStore((s) => s.orderByUser)
  const saveReport = useReportStore((s) => s.saveReport)
  const removeReport = useReportStore((s) => s.removeReport)
  const resetReport = useReportStore((s) => s.resetReport)
  const toggleFavourite = useReportStore((s) => s.toggleFavourite)
  const setOrder = useReportStore((s) => s.setOrder)

  const email = user?.email ?? 'unknown'
  const favourites = useMemo(() => favouritesByUser[email] ?? [], [favouritesByUser, email])
  const order = useMemo(() => orderByUser[email] ?? [], [orderByUser, email])

  const [favouritesOnly, setFavouritesOnly] = useState(false)

  const visible = useMemo(
    () => visibleReports(allReports(definitionEdits, removedIds), user?.email),
    [definitionEdits, removedIds, user?.email],
  )

  const filtered = useMemo(
    () => (favouritesOnly ? visible.filter((r) => favourites.includes(r.id)) : visible),
    [visible, favouritesOnly, favourites],
  )

  const predefined = useMemo(
    () => orderReports(filtered.filter((r) => r.scope === 'predefined'), order),
    [filtered, order],
  )
  const custom = useMemo(
    () => orderReports(filtered.filter((r) => r.scope === 'custom'), order),
    [filtered, order],
  )

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  /**
   * A drag reorders within its own section and writes the whole list back.
   *
   * The stored order is a single flat list across both sections. Two lists
   * would need reconciling every time a report changed scope, and a report does
   * change scope — UC038's copy turns a predefined one into a custom one.
   */
  function handleDragEnd(section: ReportDefinition[], event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = section.findIndex((r) => r.id === active.id)
    const to = section.findIndex((r) => r.id === over.id)
    if (from < 0 || to < 0) return

    const reordered = arrayMove(section, from, to).map((r) => r.id)
    const others = [...predefined, ...custom]
      .map((r) => r.id)
      .filter((id) => !reordered.includes(id))
    setOrder(email, section === predefined ? [...reordered, ...others] : [...others, ...reordered])
  }

  function actionsFor(report: ReportDefinition): RowActions {
    return {
      onRun: () => navigate(`/reports/run/${report.id}`),
      onEdit: () => navigate(`/reports/builder/${report.id}`),
      onDuplicate: () => {
        const now = new Date(DEMO_NOW.getTime()).toISOString()
        const copy = duplicateReport(
          report,
          `rep-custom-${report.id}-${Object.keys(definitionEdits).length + 1}`,
          user?.email ?? 'unknown',
          now,
        )
        saveReport(copy)
        toast.success(`Duplicated as "${copy.name}".`, {
          description: 'Custom reports are visible to you only (UC037).',
        })
        navigate(`/reports/builder/${copy.id}`)
      },
      onReset: () => {
        resetReport(report.id)
        toast.success(`"${report.name}" reset to the delivered definition.`)
      },
      onRemove: () => {
        removeReport(report.id)
        toast.success(`Deleted "${report.name}".`)
      },
      onToggleFavourite: () => toggleFavourite(email, report.id),
    }
  }

  function renderSection(
    label: string,
    hint: string,
    section: ReportDefinition[],
    emptyHint: string,
  ) {
    return (
      <section className="rounded border border-who-border bg-who-surface">
        <header className="border-b border-who-border px-3 py-2">
          <h3 className="text-[length:var(--text-body-sm)] font-semibold tracking-wide text-who-heading uppercase">
            {label}
            <span className="ml-2 font-normal text-who-text-muted normal-case">
              {section.length}
            </span>
          </h3>
          <p className="mt-0.5 text-[length:var(--text-meta)] text-who-text-muted">{hint}</p>
        </header>

        {section.length === 0 ? (
          <EmptyState message="Nothing here yet" hint={emptyHint} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={(e) => handleDragEnd(section, e)}
          >
            <SortableContext
              items={section.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="list-none">
                {section.map((report) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    isFavourite={favourites.includes(report.id)}
                    canEditThis={canEditReport(report)}
                    canCreate={canCreate}
                    modified={isReportModified(report, definitionEdits)}
                    actions={actionsFor(report)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[length:var(--text-body-sm)] text-who-text">
          <Switch
            checked={favouritesOnly}
            onCheckedChange={setFavouritesOnly}
            aria-label="Show favourites only"
          />
          Favourites only
          <Badge variant="secondary">{favourites.length}</Badge>
        </label>

        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          Drag a report by its handle to set the order you want; it is kept for your next visit
          (UC040).
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canCreate ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const now = new Date(DEMO_NOW.getTime()).toISOString()
                // An administrator's new report is predefined and everyone sees
                // it (UC036); a regular user's is custom and private (UC037).
                const draft = emptyReport(
                  `rep-new-${Object.keys(definitionEdits).length + 1}`,
                  user?.email ?? 'unknown',
                  now,
                  canEditShared ? 'predefined' : 'custom',
                )
                saveReport(draft)
                navigate(`/reports/builder/${draft.id}`)
              }}
            >
              <Plus className="size-3.5" />
              {canEditShared ? 'New predefined report' : 'New custom report'}
            </Button>
          ) : null}
        </div>
      </div>

      {!canEditShared ? (
        <p className="rounded border border-who-border bg-who-page-bg px-3 py-2 text-[length:var(--text-meta)] text-who-text-muted">
          You can run and export every predefined report, and build your own — custom reports are
          visible to you only (UC037). Creating and editing the predefined reports everybody runs
          is an administrator action (UC036).
        </p>
      ) : null}

      {renderSection(
        'Predefined reports',
        'Delivered with DMS or created by an administrator. Available to everyone (UC036).',
        predefined,
        favouritesOnly
          ? 'No predefined report is flagged as a favourite yet.'
          : 'Every predefined report has been removed.',
      )}

      {renderSection(
        'My custom reports',
        'Yours alone — nobody else sees them, including administrators (UC037).',
        custom,
        favouritesOnly
          ? 'None of your custom reports is flagged as a favourite.'
          : 'Duplicate a predefined report, or build one from scratch.',
      )}
    </div>
  )
}
