/**
 * What a workbook cell needs to render itself.
 *
 * Passed by context rather than through `columnData`, for one concrete reason:
 * `react-datasheet-grid` re-mounts cells when the column array changes
 * identity, which drops focus mid-edit. Keeping the columns memoised on the
 * *axis* alone and reading everything volatile — values, edits, QC findings,
 * the scale selector — from context means a keystroke never rebuilds a column.
 */

import { createContext, useContext } from 'react'
import type { Scale } from '@/domain/constants'
import type { WorkbookCell } from '@/hooks/useWorkbookData'

/** A QC finding ringed on a cell (wired for real in Phase 5, UC052). */
export interface CellFinding {
  observationKey: string
  severity: 'error' | 'warning'
  message: string
}

export interface WorkbookGridContextValue {
  getCell: (rowKey: string, columnKey: string) => WorkbookCell | null
  scale: Scale
  showCodes: boolean
  /** False when the workbook is locked by another user (UC033) or read-only. */
  editable: boolean
  findingFor: (observationKey: string) => CellFinding | undefined
  /** Opens the metadata drawer beside the grid, keeping the selection. */
  onOpenMetadata: (rowKey: string, columnKey: string) => void
  /** Right-click → version history (UC043/UC044). */
  onOpenVersions: (rowKey: string, columnKey: string) => void
}

export const WorkbookGridContext = createContext<WorkbookGridContextValue | null>(null)

export function useWorkbookGrid(): WorkbookGridContextValue {
  const value = useContext(WorkbookGridContext)
  if (!value) throw new Error('useWorkbookGrid must be used inside a WorkbookGridContext provider')
  return value
}
