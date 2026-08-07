/**
 * Observation metadata, beside the grid.
 *
 * This replaces the legacy DMS's separate metadata sheet tab, and plan §2.4
 * attaches an acceptance test to it that the implementation has to earn:
 *
 *   > "if reading a cell's metadata loses your place in the data, the legacy
 *   > problem has been rebuilt and the drawer is wrong."
 *
 * **So this is a flex sibling of the grid, not a portal.** The plan's Phase 4
 * item 8 says "shadcn `Sheet`", and a Sheet is a Radix portal with a scrim: it
 * would render *over* the grid and take focus, which is the same "leave the
 * data to read about the data" motion the legacy tab forces. §2.4 is the more
 * specific requirement and it wins. The grid stays mounted and simply narrows,
 * so the active cell, the scroll position and the selection all survive opening,
 * editing and closing.
 *
 * UC027 supplies the field definitions and their three types; UC034 (bonus) is
 * the drag-reorder, persisted per user.
 */

import { useEffect, useMemo, useState } from 'react'
import { GripVertical, X } from 'lucide-react'
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { MetadataFieldCode } from '@/domain/constants'
import type { MetadataFieldDef, ObservationMetadata } from '@/domain/types'
import type { WorkbookCell } from '@/hooks/useWorkbookData'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatValue } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface MetadataDrawerProps {
  open: boolean
  cell: WorkbookCell | null
  rowLabel: string
  fields: readonly MetadataFieldDef[]
  editable: boolean
  /** UC034 — the user's field order, persisted by the caller. */
  fieldOrder: string[]
  onFieldOrderChange: (order: string[]) => void
  onSave: (metadata: ObservationMetadata) => void
  onClose: () => void
}

export function MetadataDrawer({
  open,
  cell,
  rowLabel,
  fields,
  editable,
  fieldOrder,
  onFieldOrderChange,
  onSave,
  onClose,
}: MetadataDrawerProps) {
  const [draft, setDraft] = useState<ObservationMetadata>({})
  const [dirty, setDirty] = useState(false)

  // Sync from the selected cell. An effect rather than a memo: this is
  // synchronising editable state to props, not deriving a value.
  useEffect(() => {
    setDraft(cell?.observation?.metadata ?? {})
    setDirty(false)
  }, [cell?.observationKey, cell?.observation?.metadata])

  const observationFields = useMemo(
    () => fields.filter((f) => f.area === 'observation'),
    [fields],
  )

  const ordered = useMemo(() => {
    const byCode = new Map(observationFields.map((f) => [f.code as string, f]))
    const out: MetadataFieldDef[] = []
    for (const code of fieldOrder) {
      const field = byCode.get(code)
      if (field) {
        out.push(field)
        byCode.delete(code)
      }
    }
    // Anything not in the stored order keeps its seeded position at the end.
    return [...out, ...byCode.values()]
  }, [observationFields, fieldOrder])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /**
   * Esc closes the drawer (Phase 8 item 3) — but **not** while an edit is
   * pending. This panel is not a Radix portal, so it does not get Esc for free;
   * and unlike a dialog, closing it with a half-typed comment in a textarea
   * throws the comment away with no warning. One Esc reverts the draft, a second
   * closes. `useEscapeKey`'s `enabled` flag is why that decision lives here
   * rather than in the hook.
   */
  useEscapeKey(open, () => {
    if (dirty) {
      setDraft(cell?.observation?.metadata ?? {})
      setDirty(false)
      return
    }
    onClose()
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const codes = ordered.map((f) => f.code as string)
    const from = codes.indexOf(String(active.id))
    const to = codes.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = [...codes]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    onFieldOrderChange(next)
  }

  if (!open) return null

  return (
    <aside
      className="flex w-80 shrink-0 flex-col overflow-hidden rounded border border-who-border bg-who-surface"
      aria-label="Observation metadata"
    >
      <header className="flex items-start justify-between gap-2 border-b border-who-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[length:var(--text-body-sm)] font-semibold text-who-heading">
            {rowLabel}
          </p>
          <p className="truncate font-mono text-[length:var(--text-meta)] text-who-text-muted">
            {cell ? `${cell.coordinate.iso3} · ${cell.coordinate.year} · ${cell.coordinate.code}` : '—'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
          <X className="size-4" />
          <span className="sr-only">Close metadata</span>
        </Button>
      </header>

      {cell == null ? (
        <p className="p-3 text-[length:var(--text-meta)] text-who-text-muted">
          Select a cell to see its metadata.
        </p>
      ) : (
        <>
          <div className="border-b border-who-border px-3 py-2">
            <p className="text-[length:var(--text-meta)] text-who-text-muted">Value</p>
            <p className="font-mono text-[length:var(--text-body)] font-semibold text-who-heading">
              {formatValue(cell.value)}
            </p>
            {/* FR §1 — an observation is valid with no value as long as it
                carries metadata. Saying so here stops it reading as a bug. */}
            {cell.value == null ? (
              <p className="mt-0.5 text-[length:var(--text-meta)] text-who-text-muted">
                No value reported. An observation is valid with metadata alone.
              </p>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ordered.map((f) => f.code as string)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {ordered.map((field) => (
                    <SortableField key={field.code} id={field.code as string}>
                      <MetadataField
                        field={field}
                        value={draft[field.code as MetadataFieldCode] ?? ''}
                        editable={editable}
                        onChange={(value) => {
                          setDraft((d) => ({ ...d, [field.code]: value }))
                          setDirty(true)
                        }}
                      />
                    </SortableField>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-who-border px-3 py-2">
            <span className="text-[length:var(--text-meta)] text-who-text-muted">
              {dirty ? 'Unsaved changes' : 'Drag ⠿ to reorder — saved per user'}
            </span>
            <Button size="sm" disabled={!editable || !dirty} onClick={() => onSave(draft)}>
              Save metadata
            </Button>
          </footer>
        </>
      )}
    </aside>
  )
}

/* --------------------------------------------------------------------------
   One field — UC027's three types
   -------------------------------------------------------------------------- */

function MetadataField({
  field,
  value,
  editable,
  onChange,
}: {
  field: MetadataFieldDef
  value: string
  editable: boolean
  onChange: (value: string) => void
}) {
  const id = `metadata-${field.code}`

  return (
    <div className="min-w-0 flex-1">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-[length:var(--text-meta)]">
        {field.label}
        <Badge variant="outline" className="text-[length:var(--text-meta)] font-normal">
          {field.type}
        </Badge>
      </Label>

      {field.type === 'lov' ? (
        <Select value={value} onValueChange={onChange} disabled={!editable}>
          <SelectTrigger id={id} className="mt-1">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {(field.lov ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'date' ? (
        <Input
          id={id}
          type="date"
          className="mt-1 h-8"
          value={value}
          disabled={!editable}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.code === 'COMMENT' || field.code === 'SOURCES' ? (
        <Textarea
          id={id}
          rows={2}
          className="mt-1 text-[length:var(--text-body-sm)]"
          value={value}
          disabled={!editable}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          className="mt-1 h-8"
          value={value}
          disabled={!editable}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   UC034 — drag to reorder
   -------------------------------------------------------------------------- */

function SortableField({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-1.5', isDragging && 'opacity-60')}
    >
      <button
        type="button"
        aria-label="Reorder field"
        className="mt-5 cursor-grab text-who-text-muted hover:text-who-heading"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {children}
    </div>
  )
}
