/**
 * The shared component-grid surface used by the Countries and Currencies tabs.
 *
 * These two are pure xMart records with attribute definitions, so they share one
 * implementation covering UC014 (display everything imported from xMart), UC015
 * (drag-reorder columns, persisted), UC016 (edit a list of values), UC017 (create
 * a value), UC018 (add an attribute), UC021 (export/import) and UC022 (flag an
 * attribute groupable).
 *
 * Read-only for regular users, editable for administrators (UC013: "Any user will
 * be able to view the values and setup of all these components. Only
 * administrators will be able to create and edit these values.").
 */

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Check, Plus, Settings2, Tags, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTable } from '@/components/common/DataTable'
import { LoadingState } from '@/components/common/EmptyState'
import { downloadCsv, downloadXlsx } from '@/lib/exporters'
import type { AttributeDef } from '@/domain/types'
import {
  useEffectiveAttributes,
  useSetupStore,
  type SetupComponentId,
} from '@/stores/setupStore'
import { usePermissions } from '@/hooks/usePermissions'
import { AttributeSettingsDialog } from './AttributeSettingsDialog'
import { ValueEditorDialog } from './ValueEditorDialog'
import { ImportDialog } from './ImportDialog'

export interface ComponentGridProps<T extends Record<string, unknown>> {
  component: SetupComponentId
  /** Human name, used in dialogs and filenames. */
  label: string
  singular: string
  rows: readonly T[] | undefined
  isLoading: boolean
  seededAttributes: readonly AttributeDef[]
  /** Key of the attribute that identifies a row. */
  idKey: string
  /** Short explanation of where this component's data comes from. */
  provenance: string
}

export function ComponentGrid<T extends Record<string, unknown>>({
  component,
  label,
  singular,
  rows,
  isLoading,
  seededAttributes,
  idKey,
  provenance,
}: ComponentGridProps<T>) {
  const { canEdit } = usePermissions()
  const editable = canEdit('setup')

  const byComponent = useSetupStore((s) => s.byComponent[component])
  const setColumnOrder = useSetupStore((s) => s.setColumnOrder)
  const toggleColumn = useSetupStore((s) => s.toggleColumn)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  /** Rows created or edited in this session, layered over the xMart data. */
  const [localRows, setLocalRows] = useState<T[]>([])
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<T>>>({})

  // Subscribes to the column order, custom attributes, LOV and grouping slices,
  // so an administrator's change in the Attributes dialog is reflected here.
  const attributes = useEffectiveAttributes(component, seededAttributes)

  const allRows = useMemo(() => {
    const base = [...(rows ?? []), ...localRows] as T[]
    return base.map((r) => {
      const patch = localEdits[String(r[idKey])]
      return patch ? { ...r, ...patch } : r
    })
  }, [rows, localRows, localEdits, idKey])

  const columns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      attributes.map((attr) => ({
        id: attr.key,
        accessorFn: (row: T) => row[attr.key],
        header: attr.label,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v === '') {
            return <span className="text-who-hint">—</span>
          }
          if (attr.type === 'boolean') {
            return v === true || v === 'true' ? (
              <Check className="size-4 text-who-pass" aria-label="Yes" />
            ) : (
              <X className="size-4 text-who-hint" aria-label="No" />
            )
          }
          if (attr.type === 'number') {
            return (
              <span className="font-mono tabular-nums">
                {typeof v === 'number' ? v.toLocaleString() : String(v)}
              </span>
            )
          }
          if (attr.type === 'lov') {
            return (
              <Badge variant="secondary" className="font-mono text-[length:var(--text-meta)]">
                {String(v)}
              </Badge>
            )
          }
          return <span className="truncate">{String(v)}</span>
        },
      })),
    [attributes],
  )

  const headers = attributes.map((a) => a.key)

  function handleSave(values: Record<string, unknown>, isNew: boolean) {
    if (isNew) {
      setLocalRows((prev) => [...prev, values as T])
    } else {
      setLocalEdits((prev) => ({
        ...prev,
        [String(values[idKey])]: values as Partial<T>,
      }))
    }
    setCreateOpen(false)
    setEditing(null)
  }

  if (isLoading) return <LoadingState label={`Loading ${label.toLowerCase()} from xMart…`} />

  const groupable = attributes.filter((a) => a.groupable)

  return (
    <div className="space-y-4">
      {/* Provenance + grouping summary. UC022's flagged attributes are the ones
          that will appear as filters in Workbooks, Reports and Quality Checks,
          so showing them here makes the connection explicit. */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded border border-who-border bg-who-page-bg px-4 py-3">
        <div className="min-w-0">
          <p className="text-[length:var(--text-meta)] text-who-text-muted">{provenance}</p>
          {groupable.length > 0 ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[length:var(--text-meta)] text-who-text-muted">
              <Tags className="size-3.5 shrink-0" aria-hidden />
              <span>Available for grouping and filtering:</span>
              {groupable.map((a) => (
                <Badge
                  key={a.key}
                  variant="outline"
                  className="border-who-primary-blue/40 text-[length:var(--text-meta)] text-who-heading"
                >
                  {a.label}
                </Badge>
              ))}
            </p>
          ) : null}
        </div>
        {!editable ? (
          <Badge variant="secondary" className="shrink-0">
            View and export only
          </Badge>
        ) : null}
      </div>

      <DataTable<T>
        data={allRows}
        columns={columns}
        columnOrder={byComponent?.columnOrder ?? []}
        onColumnOrderChange={editable ? (o) => setColumnOrder(component, o) : undefined}
        hiddenColumns={byComponent?.hidden ?? []}
        onToggleColumn={(k) => toggleColumn(component, k)}
        searchPlaceholder={`Search ${label.toLowerCase()}`}
        getRowId={(r) => String(r[idKey])}
        onRowClick={editable ? (r) => setEditing(r) : undefined}
        onExport={(visible) =>
          downloadCsv(visible as readonly Record<string, unknown>[], headers, component)
        }
        toolbar={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    downloadXlsx(
                      [{ name: label, headers, rows: allRows as Record<string, unknown>[] }],
                      component,
                    )
                  }
                >
                  Excel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as .xlsx for editing and re-import (UC021)</TooltipContent>
            </Tooltip>

            {editable ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                  className="gap-1.5"
                >
                  Import
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSettingsOpen(true)}
                      className="gap-1.5"
                    >
                      <Settings2 className="size-3.5" />
                      Attributes
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Edit lists of values, grouping flags, and add attributes
                  </TooltipContent>
                </Tooltip>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="size-3.5" />
                  New {singular}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <AttributeSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        component={component}
        label={label}
        attributes={attributes}
      />

      <ValueEditorDialog
        open={createOpen || editing != null}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        title={editing ? `Edit ${singular}` : `New ${singular}`}
        attributes={attributes}
        initial={(editing ?? undefined) as Record<string, unknown> | undefined}
        idKey={idKey}
        onSave={(v) => handleSave(v, editing == null)}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        label={label}
        expectedHeaders={headers}
        onApply={(imported) => {
          // Match on the id column: known ids patch, unknown ones are created.
          const known = new Set(allRows.map((r) => String(r[idKey])))
          const created: T[] = []
          const patched: Record<string, Partial<T>> = {}
          for (const row of imported) {
            const id = row[idKey]
            if (id && known.has(id)) patched[id] = row as Partial<T>
            else if (id) created.push(row as unknown as T)
          }
          setLocalRows((prev) => [...prev, ...created])
          setLocalEdits((prev) => ({ ...prev, ...patched }))
          setImportOpen(false)
        }}
      />
    </div>
  )
}
