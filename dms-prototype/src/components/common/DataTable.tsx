/**
 * The list-grid workhorse: Setup, Users, Reports and Quality Checks all use it.
 *
 * Styling follows the reference's `.custom-table` (see
 * /Reference/html_pages/sass/_layout.scss): 12px uppercase headers, generous
 * cell padding, and a shadowed bottom-right pagination block.
 *
 * UC015 is the reason headers are drag-reorderable: "As an administrator, I need
 * to be able to reorder the list of attributes being displayed in the list of any
 * data components, so that the most relevant information is displayed first for
 * all users." Order is persisted by the caller via `onColumnOrderChange`.
 */

import { useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { EmptyState } from './EmptyState'

/** Rows-per-page choices. 10 is the default — see `pageSize`. */
const PAGE_SIZES = [10, 25, 50, 100] as const

export interface DataTableProps<T> {
  data: readonly T[]
  columns: ColumnDef<T, unknown>[]
  /** Column ids in display order. Empty falls back to `columns` order. */
  columnOrder?: string[]
  onColumnOrderChange?: (order: string[]) => void
  hiddenColumns?: string[]
  onToggleColumn?: (id: string) => void
  /** Placeholder for the search box; omit to hide it. */
  searchPlaceholder?: string
  /** Actions rendered to the right of the toolbar. */
  toolbar?: ReactNode
  /** Called with the currently filtered+sorted rows. */
  onExport?: (rows: readonly T[]) => void
  exportLabel?: string
  /** Initial rows per page. The user can change it; this is only the start. */
  pageSize?: number
  emptyMessage?: string
  /** Row click handler — used for drill-in to a component value. */
  onRowClick?: (row: T) => void
  /** Stable row key, so React does not reuse rows across filters. */
  getRowId?: (row: T, index: number) => string
}

/** One draggable header cell. */
function SortableHeader({
  id,
  canDrag,
  children,
  className,
}: {
  id: string
  canDrag: boolean
  children: ReactNode
  className?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canDrag,
  })

  return (
    <th
      ref={setNodeRef}
      // `position: relative` + a transform keeps the dragged header above its
      // neighbours without leaving the table's stacking context.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative bg-who-surface px-3 py-2 text-left align-middle',
        'text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase',
        // Headers never wrap. `table-auto` sizes a column to its *cell* content
        // and lets the header wrap into the leftovers, which put "World Bank
        // income group" on 4 lines in an 85px column. nowrap makes the header's
        // single-line width the column's minimum instead, so the column widens
        // and the table scrolls horizontally — which the wrapper already does.
        'whitespace-nowrap',
        isDragging && 'z-10 opacity-80 shadow-who-card',
        className,
      )}
    >
      <span className="flex items-center gap-1">
        {canDrag ? (
          <button
            type="button"
            aria-label="Reorder column"
            className="cursor-grab text-who-icon hover:text-who-primary-blue active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}
        {children}
      </span>
    </th>
  )
}

export function DataTable<T>({
  data,
  columns,
  columnOrder,
  onColumnOrderChange,
  hiddenColumns = [],
  onToggleColumn,
  searchPlaceholder,
  toolbar,
  onExport,
  exportLabel = 'Export CSV',
  pageSize = 10,
  emptyMessage = 'No records match the current filters.',
  onRowClick,
  getRowId,
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  const columnVisibility = useMemo(
    () => Object.fromEntries(hiddenColumns.map((k) => [k, false])),
    [hiddenColumns],
  )

  const table = useReactTable({
    data: data as T[],
    columns,
    state: {
      globalFilter,
      sorting,
      columnVisibility,
      ...(columnOrder?.length ? { columnOrder } : {}),
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    ...(getRowId ? { getRowId } : {}),
  })

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const orderedIds = table.getVisibleLeafColumns().map((c) => c.id)

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !onColumnOrderChange) return
    // Reorder against the FULL column list, not just visible ones, so hidden
    // columns keep their relative position when re-shown.
    const all = table.getAllLeafColumns().map((c) => c.id)
    const from = all.indexOf(String(active.id))
    const to = all.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onColumnOrderChange(arrayMove(all, from, to))
  }

  const rows = table.getRowModel().rows
  const filteredRows = table.getFilteredRowModel().rows.map((r) => r.original)
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const currentPageSize = table.getState().pagination.pageSize
  // Offering "100 per page" on a 12-row table is noise. Keep every size that
  // would still hide rows, plus the first that shows them all — so there is
  // always a "see everything" step — plus whatever is currently in force.
  const total = filteredRows.length
  const showsAll = PAGE_SIZES.find((n) => n >= total)
  const sizeOptions = PAGE_SIZES.filter(
    (n) => n < total || n === showsAll || n === currentPageSize,
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder ? (
          <div className="relative w-full max-w-[280px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-who-icon" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded border border-who-border bg-who-surface pr-3 pl-9 text-[length:var(--text-body-sm)] text-who-text placeholder:text-who-icon focus:border-who-primary-blue focus:outline-none"
            />
          </div>
        ) : null}

        {/* `flex-wrap` here as well as on the row above (Phase 8 responsive
            pass). The outer row wrapped, but this group did not, so its five or
            six buttons formed one unbreakable 542px block — at 1024 and 768 that
            is wider than the content column (the 300px left padding is fixed),
            and it pushed the whole page sideways underneath the fixed sidebar.
            `justify-end` keeps it hugging the right once it does wrap. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {toolbar}

          {onToggleColumn ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <SlidersHorizontal className="size-3.5" />
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Show or hide columns</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                  Visible columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table.getAllLeafColumns().map((col) => (
                  // A plain label, not DropdownMenuCheckboxItem: the menu must
                  // stay open while several columns are toggled.
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[length:var(--text-body-sm)] hover:bg-accent"
                  >
                    <Checkbox
                      checked={col.getIsVisible()}
                      onCheckedChange={() => onToggleColumn(col.id)}
                    />
                    <span className="truncate">
                      {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                    </span>
                  </label>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {onExport ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onExport(filteredRows)}
            >
              <Download className="size-3.5" />
              {exportLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Grid. The container carries the surface: without it the rows sat
          straight on the page canvas, so the header (bg-who-surface) floated
          white above a grey body, and a --who-page-bg zebra stripe was the
          exact colour of the thing behind it — i.e. invisible. */}
      <div className="overflow-x-auto rounded border border-who-border bg-who-surface">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
            <thead className="border-b border-who-border">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort()
                      const dir = header.column.getIsSorted()
                      return (
                        <SortableHeader
                          key={header.id}
                          id={header.column.id}
                          canDrag={Boolean(onColumnOrderChange)}
                        >
                          <button
                            type="button"
                            disabled={!canSort}
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              'flex items-center gap-1 text-left uppercase',
                              canSort && 'hover:text-who-primary-blue',
                              !canSort && 'cursor-default',
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {dir === 'asc' ? (
                              <ArrowUp className="size-3" />
                            ) : dir === 'desc' ? (
                              <ArrowDown className="size-3" />
                            ) : null}
                          </button>
                        </SortableHeader>
                      )
                    })}
                  </SortableContext>
                </tr>
              ))}
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-who-border/60 last:border-b-0',
                    // Zebra + hover use different token families on purpose.
                    // The stripe is neutral (--who-page-bg, the canvas) so it
                    // reads as banding; the hover is the brand tint
                    // (--who-accent-subtle) so it reads as "this row". Sharing
                    // one token would make a hovered row indistinguishable from
                    // its striped neighbours.
                    'even:bg-who-page-bg hover:bg-who-accent-subtle',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle text-who-text">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>

        {rows.length === 0 ? <EmptyState message={emptyMessage} /> : null}
      </div>

      {/* Footer — reference styles the pager bottom-right with a soft shadow.
          The row-count and the page-size control render whether or not there is
          more than one page: the pager is what becomes meaningless at one page,
          not the ability to ask for more rows. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          {filteredRows.length.toLocaleString()} record{filteredRows.length === 1 ? '' : 's'}
          {filteredRows.length !== data.length ? ` of ${data.length.toLocaleString()}` : ''}
        </p>

        <div className="flex items-center gap-3">
          {sizeOptions.length > 1 ? (
            <label className="flex items-center gap-2 text-[length:var(--text-meta)] text-who-text-muted">
              Rows per page
              <Select
                value={String(currentPageSize)}
                onValueChange={(v) => {
                  table.setPageSize(Number(v))
                  // Jump to the top. TanStack keeps the first visible row in
                  // view instead, which lands you mid-list on a page number
                  // that no longer means anything to the reader.
                  table.setPageIndex(0)
                }}
              >
                <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizeOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}

          {pageCount > 1 ? (
            <div className="flex items-center gap-1 rounded shadow-who-card">
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                className="rounded-r-none"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="border-y border-who-border bg-who-surface px-3 py-1.5 text-[length:var(--text-body-sm)] whitespace-nowrap text-who-text">
                {pageIndex + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label="Next page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                className="rounded-l-none"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
