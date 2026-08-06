/**
 * Workbook domain logic (plan §Phase 4).
 *
 * Pure — the axis constraint, the grid geometry, the clipboard format, the
 * undo stack and the URL codec. No React, no store, no browser APIs.
 */

export {
  AXES,
  AXIS_LABELS,
  axisCount,
  axisMembers,
  buildGridAxes,
  candidateTypes,
  cellCoordinate,
  emptySelection,
  forcedSingleAxis,
  multiAxes,
  resolveShape,
  workbookTitle,
  WORKBOOK_TYPE_DESCRIPTIONS,
  WORKBOOK_TYPE_LABELS,
  yearRangeLabel,
  type AttributeFilter,
  type AxisId,
  type CellCoordinate,
  type CountryLike,
  type GridColumn,
  type GridRow,
  type ShapeProblem,
  type WorkbookSelection,
  type WorkbookShape,
  type WorkbookType,
} from './shape'

export {
  cellToText,
  clipFromTsv,
  decodeMetadata,
  encodeMetadata,
  isFormulaText,
  parseNumber,
  parseTsv,
  planPaste,
  PASTE_MODES,
  PASTE_MODE_DESCRIPTIONS,
  PASTE_MODE_LABELS,
  toTsv,
  type Clip,
  type ClipCell,
  type PasteMode,
  type PastePlacement,
  type PasteTarget,
} from './clipboard'

export {
  canRedo,
  canUndo,
  emptyUndoState,
  pluralCells,
  pushCommand,
  redo,
  undo,
  UNDO_LIMIT,
  type CellChange,
  type CellSnapshot,
  type Command,
  type StepResult,
  type UndoState,
} from './commands'

export {
  decodeYears,
  encodeYears,
  selectionFromSearchParams,
  selectionToSearchParams,
  type ParsedSelection,
} from './url'
