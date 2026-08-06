/**
 * The open workbook — the product (plan §Phase 4).
 *
 * Layout is deliberate rather than incidental. The toolbar and the chips sit
 * above the grid and the metadata panel sits **beside** it, so the grid never
 * unmounts and never loses its place. That is the §2.4 acceptance test for this
 * phase, and it is the reason the metadata panel is a flex sibling rather than
 * the Radix `Sheet` the plan's item list originally named — a Sheet is a portal
 * with a scrim, and it would rebuild the exact "leave the data to read about the
 * data" motion the legacy metadata tab forces.
 *
 * The whole selection lives in the URL, so this page is stateless with respect
 * to *what* is open: a link restores a workbook exactly, which is what makes
 * chips shareable and what the Phase 8 `?scenario=` shortcuts will ride on.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { DataSheetGridRef } from 'react-datasheet-grid'
import { Button } from '@/components/ui/button'
import { EmptyState, LoadingState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { getEdit } from '@/data/db'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { YEARS } from '@/domain/constants'
import {
  clipFromTsv,
  planPaste,
  resolveShape,
  selectionFromSearchParams,
  selectionToSearchParams,
  toTsv,
  workbookTitle,
  type CellChange,
  type Clip,
  type ClipCell,
  type WorkbookSelection,
} from '@/domain/workbook'
import { evaluateAst, type FormulaEngine } from '@/domain/formula'
import { useMetadataFields, useVariables } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'
import { useWorkbookData, type WorkbookCell } from '@/hooks/useWorkbookData'
import { currentSnapshot, setWorkbookAuthor, useWorkbookStore } from '@/stores/workbookStore'
import { BulkStatusDialog } from './BulkStatusDialog'
import { FormulaBar } from './FormulaBar'
import { MetadataDrawer } from './MetadataDrawer'
import { PasteDialog } from './PasteDialog'
import { SeriesToolsDialog } from './SeriesToolsDialog'
import { VersionCompareDialog } from './VersionCompareDialog'
import { WorkbookFilterChips } from './WorkbookFilterChips'
import { WorkbookGrid, type GridCellRef, type GridRangeRef } from './WorkbookGrid'
import { WorkbookToolbar } from './WorkbookToolbar'
import { exportWorkbookXlsx } from './exportWorkbook'
import type { CellFinding } from './gridContext'

const NO_FINDINGS = () => undefined

export function WorkbookPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { canEdit, canEditCountry, user } = usePermissions()
  const { data: variables } = useVariables()
  const { data: metadataFields } = useMetadataFields()

  const scale = useWorkbookStore((s) => s.scale)
  const showCodes = useWorkbookStore((s) => s.showCodes)
  const dirtyKeys = useWorkbookStore((s) => s.dirtyKeys)
  const clip = useWorkbookStore((s) => s.clip)
  const pasteMode = useWorkbookStore((s) => s.pasteMode)
  const undoState = useWorkbookStore((s) => s.undoState)
  const locks = useWorkbookStore((s) => s.locks)
  const commit = useWorkbookStore((s) => s.commit)
  const setClip = useWorkbookStore((s) => s.setClip)
  const markClean = useWorkbookStore((s) => s.markClean)
  const undoAction = useWorkbookStore((s) => s.undo)
  const fieldOrder = useWorkbookStore((s) => s.metadataFieldOrder)
  const setFieldOrder = useWorkbookStore((s) => s.setMetadataFieldOrder)
  const redoAction = useWorkbookStore((s) => s.redo)

  useEffect(() => {
    if (user?.id) setWorkbookAuthor(user.id)
  }, [user?.id])

  /* --- selection, entirely from the URL ---------------------------------- */

  const { selection, type } = useMemo(
    () => selectionFromSearchParams(searchParams),
    [searchParams],
  )
  const { shape, problem } = resolveShape(selection, type ?? undefined)

  const setSelection = useCallback(
    (next: WorkbookSelection) => {
      setSearchParams(selectionToSearchParams(next, type ?? undefined), { replace: true })
    },
    [setSearchParams, type],
  )

  /* --- data -------------------------------------------------------------- */


  const { isLoading, rows, columns, engine, getCell, invalidate } = useWorkbookData(
    selection,
    shape,
    dirtyKeys,
  )

  /* --- grid selection ---------------------------------------------------- */

  const gridRef = useRef<DataSheetGridRef>(null)
  const [activeCell, setActiveCell] = useState<GridCellRef | null>(null)
  const [range, setRange] = useState<GridRangeRef | null>(null)

  /**
   * Hold on to the selection when the grid loses focus.
   *
   * `react-datasheet-grid` clears its active cell whenever focus leaves the
   * grid — which is every time the user reaches for the toolbar. Copy, the
   * series tools and bulk status all act on the selection, so honouring that
   * clear would mean the act of clicking the button that needs a selection is
   * what destroys it. Clearing on purpose (a new workbook) still happens; a
   * blur does not.
   */
  const retainActiveCell = useCallback((cell: GridCellRef | null) => {
    if (cell) setActiveCell(cell)
  }, [])
  const retainRange = useCallback((next: GridRangeRef | null) => {
    if (next) setRange(next)
  }, [])
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [versionsFor, setVersionsFor] = useState<WorkbookCell | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [seriesOpen, setSeriesOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const activeWorkbookCell = activeCell
    ? getCell(activeCell.rowKey, activeCell.columnKey)
    : null
  const activeRowLabel = activeCell
    ? (rows.find((r) => r.key === activeCell.rowKey)?.label ?? '')
    : ''

  // A change of workbook invalidates any retained coordinate — the row and
  // column keys it names may not exist in the new selection.
  const selectionKey = `${selection.countries.join(',')}|${selection.variables.join(',')}|${selection.years.join(',')}`
  useEffect(() => {
    setActiveCell(null)
    setRange(null)
    setMetadataOpen(false)
  }, [selectionKey])

  /* --- permissions and locking (UC033) ----------------------------------- */

  const lock = useMemo(
    () => locks.find((l) => selection.countries.includes(l.iso3)),
    [locks, selection.countries],
  )
  const countryEditable = selection.countries.every((iso3) =>
    canEditCountry('workbooks', iso3),
  )
  const editable = canEdit('workbooks') && countryEditable && lock == null

  /* --- editing ----------------------------------------------------------- */

  /**
   * Turn typed text into an undoable change.
   *
   * `=…` becomes a formula, anything numeric becomes a value, and an empty
   * string clears the value — deliberately to `null`, not `0`, because a
   * cleared cell is unknown rather than zero and the whole engine depends on
   * that distinction holding.
   */
  const changeFor = useCallback(
    (cell: WorkbookCell, text: string): CellChange | null => {
      const trimmed = text.trim()
      const before = currentSnapshot(cell.observationKey)

      if (trimmed.startsWith('=')) {
        const expression = trimmed.slice(1).trim()
        const check = engine?.validate(expression)
        if (check && !check.ok) {
          toast.error(
            check.cycle
              ? `Circular reference — ${check.cycle.join(' → ')}`
              : check.unknownCodes.length > 0
                ? `Unknown code: ${check.unknownCodes.join(', ')}`
                : (check.error?.message ?? 'That expression cannot be read.'),
          )
          return null
        }
        const value = engine
          ? evaluateExpression(engine, expression, cell.coordinate.iso3, cell.coordinate.year)
          : null
        return {
          observationKey: cell.observationKey,
          before,
          after: { ...before, formula: trimmed, value },
        }
      }

      if (trimmed === '') {
        return {
          observationKey: cell.observationKey,
          before,
          after: { ...before, value: null, formula: null },
        }
      }

      const value = Number(trimmed.replace(/[\s,]/g, ''))
      if (!Number.isFinite(value)) {
        toast.error(`"${text}" is not a number.`)
        return null
      }
      return {
        observationKey: cell.observationKey,
        before,
        after: { ...before, value, formula: null },
      }
    },
    [engine],
  )

  const handleCellCommit = useCallback(
    (rowKey: string, columnKey: string, text: string) => {
      const cell = getCell(rowKey, columnKey)
      if (!cell || cell.isCalculated || !editable) return
      const change = changeFor(cell, text)
      if (!change) return
      commit(`Edit ${cell.coordinate.code} ${cell.coordinate.year}`, [change])
      invalidate()
    },
    [getCell, editable, changeFor, commit, invalidate],
  )

  /* --- clipboard (UC031) ------------------------------------------------- */

  /**
   * The range being copied.
   *
   * Falls back to the active cell when nothing has been dragged: copying a
   * single cell without first selecting a range is what every spreadsheet does,
   * and requiring a drag to copy one figure would be a needless difference.
   */
  const effectiveRange = useMemo((): GridRangeRef | null => {
    if (range) return range
    if (!activeCell) return null
    const r = rows.findIndex((row) => row.key === activeCell.rowKey)
    const c = columns.findIndex((column) => column.key === activeCell.columnKey)
    if (r < 0 || c < 0) return null
    return { minRow: r, maxRow: r, minColumn: c, maxColumn: c }
  }, [range, activeCell, rows, columns])

  const rangeCells = useCallback((): ClipCell[][] => {
    const source = effectiveRange
    if (!source) return []
    const out: ClipCell[][] = []
    for (let r = source.minRow; r <= source.maxRow; r++) {
      const row: ClipCell[] = []
      for (let c = source.minColumn; c <= source.maxColumn; c++) {
        const rowKey = rows[r]?.key
        const columnKey = columns[c]?.key
        const cell = rowKey && columnKey ? getCell(rowKey, columnKey) : null
        row.push({
          value: cell?.value ?? null,
          ...(cell?.formula != null && !cell.isCalculated ? { formula: cell.formula } : {}),
          ...(cell?.observation ? { metadata: cell.observation.metadata } : {}),
        })
      }
      out.push(row)
    }
    return out
  }, [effectiveRange, rows, columns, getCell])

  const handleCopy = useCallback(async () => {
    const cells = rangeCells()
    if (cells.length === 0) {
      toast.info('Select a cell or a range first.')
      return
    }
    const next: Clip = {
      rows: cells.length,
      columns: cells[0]?.length ?? 0,
      cells,
      sourceLabel: shape
        ? workbookTitle(selection, shape, COUNTRY_BY_ISO3)
        : 'Workbook',
    }
    setClip(next)
    try {
      await navigator.clipboard.writeText(toTsv(next, pasteMode))
    } catch {
      // Clipboard permission can be refused; the in-app clip still works, which
      // is what cross-workbook paste actually uses.
    }
    toast.success(`Copied ${next.rows} × ${next.columns} cells (${pasteMode}).`)
  }, [rangeCells, setClip, pasteMode, shape, selection])

  const applyClip = useCallback(
    (source: Clip, mode: typeof pasteMode) => {
      if (!activeCell || !editable) return
      const targetRow = rows.findIndex((r) => r.key === activeCell.rowKey)
      const targetColumn = columns.findIndex((c) => c.key === activeCell.columnKey)
      if (targetRow < 0 || targetColumn < 0) return

      const placements = planPaste(
        source,
        { row: targetRow, column: targetColumn },
        rows.length,
        columns.length,
        effectiveRange ? effectiveRange.maxRow - effectiveRange.minRow + 1 : 1,
        effectiveRange ? effectiveRange.maxColumn - effectiveRange.minColumn + 1 : 1,
      )

      const changes: CellChange[] = []
      let skipped = 0

      for (const placement of placements) {
        const rowKey = rows[placement.row]?.key
        const columnKey = columns[placement.column]?.key
        if (!rowKey || !columnKey) continue
        const cell = getCell(rowKey, columnKey)
        // A calculated row is owned by the formula engine and is never a paste
        // target — silently overwriting one would put a literal where the demo
        // is about to show a computed value.
        if (!cell || cell.isCalculated) {
          skipped++
          continue
        }

        const before = currentSnapshot(cell.observationKey)
        if (mode === 'metadata') {
          if (!placement.cell.metadata) continue
          changes.push({
            observationKey: cell.observationKey,
            before,
            after: { ...before, metadata: placement.cell.metadata },
          })
          continue
        }
        if (mode === 'formulas' && placement.cell.formula) {
          const expression = placement.cell.formula.replace(/^=/, '').trim()
          const value = engine
            ? evaluateExpression(engine, expression, cell.coordinate.iso3, cell.coordinate.year)
            : null
          changes.push({
            observationKey: cell.observationKey,
            before,
            after: { ...before, formula: placement.cell.formula, value },
          })
          continue
        }
        changes.push({
          observationKey: cell.observationKey,
          before,
          after: { ...before, value: placement.cell.value, formula: null },
        })
      }

      if (changes.length === 0) {
        toast.info('Nothing to paste here — the target rows are all calculated.')
        return
      }
      commit(`Paste ${changes.length} cells`, changes)
      invalidate()
      toast.success(
        `Pasted ${changes.length} cells${skipped > 0 ? ` — ${skipped} calculated cells skipped` : ''}.`,
      )
    },
    [activeCell, editable, rows, columns, effectiveRange, getCell, engine, commit, invalidate],
  )

  const handlePaste = useCallback(async () => {
    if (!editable) return
    // Prefer the in-app clip: it carries formulas and metadata, which a plain
    // text clipboard read cannot, and it is what makes cross-workbook paste work.
    if (clip) {
      setPasteOpen(true)
      return
    }
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.info('Clipboard is empty.')
        return
      }
      setClip(clipFromTsv(text, pasteMode, 'System clipboard'))
      setPasteOpen(true)
    } catch {
      toast.error('The browser refused clipboard access. Copy a range inside the app instead.')
    }
  }, [editable, clip, pasteMode, setClip])

  /* --- keyboard ---------------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey
      if (!meta) return
      const key = e.key.toLowerCase()
      if (key === 'c') {
        void handleCopy()
      } else if (key === 'v') {
        e.preventDefault()
        void handlePaste()
      } else if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const command = undoAction()
        if (command) {
          invalidate()
          toast.info(`Undone — ${command.label}`)
        }
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        const command = redoAction()
        if (command) {
          invalidate()
          toast.info(`Redone — ${command.label}`)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCopy, handlePaste, undoAction, redoAction, invalidate])

  /* --- save (UC046) ------------------------------------------------------ */

  const handleSave = useCallback(async () => {
    if (dirtyKeys.length === 0) return
    const changes = dirtyKeys.map((key) => {
      const edit = getEdit(key)
      return {
        observationKey: key,
        value: edit?.value ?? null,
        formula: edit?.formula ?? null,
        metadata: edit?.metadata as Record<string, string> | undefined,
        publishingStatus: edit?.publishingStatus,
        authorId: user?.id ?? 'unknown',
      }
    })
    const result = await mockXMartClient.putObservations(changes)
    markClean()
    toast.success(
      `Saved ${result.accepted} observations to xMart — batch ${result.batchId}.`,
      { description: `Author ${user?.email ?? 'unknown'} carried in the payload (UC046).` },
    )
  }, [dirtyKeys, user, markClean])

  /* --- grid sizing ------------------------------------------------------- */

  const [gridHeight, setGridHeight] = useState(520)
  useEffect(() => {
    const measure = () => setGridHeight(Math.max(320, window.innerHeight - 330))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  /* --- render ------------------------------------------------------------ */

  const gridContext = useMemo(
    () => ({
      getCell,
      scale,
      showCodes,
      editable,
      findingFor: NO_FINDINGS as (key: string) => CellFinding | undefined,
      onOpenMetadata: (rowKey: string, columnKey: string) => {
        setActiveCell({ rowKey, columnKey })
        setMetadataOpen(true)
      },
      onOpenVersions: (rowKey: string, columnKey: string) => {
        setVersionsFor(getCell(rowKey, columnKey))
      },
    }),
    [getCell, scale, showCodes, editable],
  )

  if (!shape) {
    return (
      <div className="space-y-4">
        <PageHeader title="Workbook" />
        <EmptyState
          message="No workbook selected"
          hint={problem?.message ?? 'Choose a country, variables and years to open a workbook.'}
          action={
            <Button asChild>
              <Link to="/workbooks">Choose a selection</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const title = workbookTitle(selection, shape, COUNTRY_BY_ISO3)

  return (
    <div className="space-y-3">
      <PageHeader
        title="Workbook"
        description={title}
      />

      {/* UC033 — the RFP's exact wording, and the grid goes read-only. */}
      {lock ? (
        <div className="rounded border border-who-warn/50 bg-who-warn/5 px-4 py-2.5">
          <p className="text-[length:var(--text-body-sm)] text-who-text">
            This data set is being edited by another user, so it will be displayed in View Only
            mode.
          </p>
          <p className="text-[length:var(--text-meta)] text-who-text-muted">
            Held by {lock.heldBy} since {new Date(lock.sinceUtc).toLocaleTimeString('en-GB')}.
          </p>
        </div>
      ) : null}

      <WorkbookToolbar
        editable={editable}
        dirtyCount={dirtyKeys.length}
        canUndo={undoState.past.length > 0}
        canRedo={undoState.future.length > 0}
        lastCommand={undoState.past[undoState.past.length - 1]?.label}
        onUndo={() => {
          const command = undoAction()
          if (command) {
            invalidate()
            toast.info(`Undone — ${command.label}`)
          }
        }}
        onRedo={() => {
          const command = redoAction()
          if (command) {
            invalidate()
            toast.info(`Redone — ${command.label}`)
          }
        }}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onSeriesTools={() => setSeriesOpen(true)}
        onBulkStatus={() => setBulkOpen(true)}
        onExport={() =>
          exportWorkbookXlsx({ rows, columns, getCell, title, scale })
        }
        onSave={handleSave}
        lockedCountry={selection.countries[0] ?? null}
      />

      <WorkbookFilterChips
        selection={selection}
        onChange={setSelection}
        variables={variables ?? []}
        singleAxis={shape.singleAxis}
        editable
      />

      <FormulaBar
        cell={activeWorkbookCell}
        rowLabel={activeRowLabel}
        engine={engine}
        editable={editable}
        onCommit={(text) => {
          if (activeCell) handleCellCommit(activeCell.rowKey, activeCell.columnKey, text)
        }}
      />

      {isLoading ? (
        <LoadingState label="Loading observations from xMart…" />
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <WorkbookGrid
              rows={rows}
              columns={columns}
              context={gridContext}
              height={gridHeight}
              gridRef={gridRef}
              onCellCommit={handleCellCommit}
              onActiveCellChange={retainActiveCell}
              onSelectionChange={retainRange}
            />
            <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
              {rows.length} rows × {columns.length} columns ·{' '}
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-xs bg-who-cell-value" /> reported
              </span>{' '}
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-xs bg-who-cell-indicator" /> calculated
              </span>{' '}
              · Ctrl+C / Ctrl+V over a range · Ctrl+Z to undo
            </p>
          </div>

          <MetadataDrawer
            open={metadataOpen}
            cell={activeWorkbookCell}
            rowLabel={activeRowLabel}
            fields={metadataFields ?? []}
            editable={editable}
            fieldOrder={fieldOrder}
            onFieldOrderChange={setFieldOrder}
            onClose={() => setMetadataOpen(false)}
            onSave={(metadata) => {
              if (!activeWorkbookCell) return
              const before = currentSnapshot(activeWorkbookCell.observationKey)
              commit('Edit metadata', [
                {
                  observationKey: activeWorkbookCell.observationKey,
                  before,
                  after: { ...before, metadata },
                },
              ])
              invalidate()
              toast.success('Metadata saved.')
            }}
          />
        </div>
      )}

      <PasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        clip={clip}
        targetLabel={
          activeCell
            ? `${activeRowLabel} · ${activeCell.columnKey}`
            : 'no cell selected'
        }
        onPaste={(mode) => {
          if (clip) applyClip(clip, mode)
          setPasteOpen(false)
        }}
      />

      <SeriesToolsDialog
        open={seriesOpen}
        onOpenChange={setSeriesOpen}
        rows={rows}
        columns={columns}
        range={effectiveRange}
        getCell={getCell}
        onApply={(changes, label) => {
          commit(label, changes)
          invalidate()
          setSeriesOpen(false)
        }}
      />

      <BulkStatusDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        rows={rows}
        columns={columns}
        range={effectiveRange}
        getCell={getCell}
        onApply={(changes, label) => {
          commit(label, changes)
          invalidate()
          setBulkOpen(false)
        }}
      />

      <VersionCompareDialog
        cell={versionsFor}
        onOpenChange={(open) => {
          if (!open) setVersionsFor(null)
        }}
        onRestore={(change, label) => {
          commit(label, [change])
          invalidate()
          setVersionsFor(null)
        }}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

/**
 * Evaluate a user-authored `=…` expression at one coordinate.
 *
 * Parses through the engine (so the known-code set, the greedy tokeniser and
 * the cycle check are the real ones) and evaluates through the domain
 * evaluator with the engine as the resolver — which means an ad-hoc cell
 * formula resolves aggregates and predefined indicators exactly as a seeded
 * formula would. No second evaluator, so the workbook and the Setup tab cannot
 * drift apart.
 *
 * `all-not-null` is the right policy for a hand-typed formula: a user who wrote
 * `=HF.1+HF.2` and is missing `HF.2` should see blank, not a half-total quietly
 * presented as the whole.
 */
export function evaluateExpression(
  engine: FormulaEngine | null,
  expression: string,
  iso3: string,
  year: number,
): number | null {
  if (!engine) return null
  const check = engine.validate(expression)
  if (!check.ok || !check.ast) return null

  return evaluateAst(check.ast, {
    year,
    years: YEARS,
    policy: 'all-not-null',
    resolve: (code, atYear) => engine.valueOf(code, iso3, atYear),
  }).value
}
