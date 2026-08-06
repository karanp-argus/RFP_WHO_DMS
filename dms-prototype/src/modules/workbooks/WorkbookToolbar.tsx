/**
 * The workbook toolbar.
 *
 * A deliberate echo of the legacy DMS's toolbar — refresh, export, scale — with
 * the actions the RFP adds and the 2000s chrome removed. The scale selector
 * keeps its legacy default of "Millions (Default)" verbatim (plan §2.4
 * Decision 1); everything else is new.
 *
 * The "simulate a second user" control is labelled prototype-only, per
 * CLAUDE.md, so nobody mistakes a demo affordance for a product feature.
 */

import {
  ClipboardCopy, ClipboardPaste,
  Download,
  Redo2,
  Save,
  ShieldCheck,
  TrendingUp,
  Undo2,
  UserLock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SCALES, SCALE_LABELS, type Scale } from '@/domain/constants'
import { PASTE_MODES, PASTE_MODE_LABELS } from '@/domain/workbook'
import { useWorkbookStore } from '@/stores/workbookStore'
import { cn } from '@/lib/utils'

export interface WorkbookToolbarProps {
  editable: boolean
  dirtyCount: number
  canUndo: boolean
  canRedo: boolean
  lastCommand?: string
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onPaste: () => void
  onSeriesTools: () => void
  onBulkStatus: () => void
  onExport: () => void
  /** UC052 — run the applicable rules over the current selection. */
  onRunQualityChecks: () => void
  isCheckingQuality: boolean
  onSave: () => void
  /** The country whose lock the demo control toggles (UC033). */
  lockedCountry: string | null
}

export function WorkbookToolbar({
  editable,
  dirtyCount,
  canUndo,
  canRedo,
  lastCommand,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onSeriesTools,
  onBulkStatus,
  onExport,
  onRunQualityChecks,
  isCheckingQuality,
  onSave,
  lockedCountry,
}: WorkbookToolbarProps) {
  const scale = useWorkbookStore((s) => s.scale)
  const setScale = useWorkbookStore((s) => s.setScale)
  const pasteMode = useWorkbookStore((s) => s.pasteMode)
  const setPasteMode = useWorkbookStore((s) => s.setPasteMode)
  const showCodes = useWorkbookStore((s) => s.showCodes)
  const toggleShowCodes = useWorkbookStore((s) => s.toggleShowCodes)
  const locks = useWorkbookStore((s) => s.locks)
  const setSimulatedLock = useWorkbookStore((s) => s.setSimulatedLock)

  const isLocked = lockedCountry != null && locks.some((l) => l.iso3 === lockedCountry)

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded border border-who-border bg-who-surface px-2 py-1.5">
      <ToolButton label="Undo" disabled={!canUndo} onClick={onUndo} hint={lastCommand}>
        <Undo2 className="size-3.5" />
      </ToolButton>
      <ToolButton label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-3.5" />
      </ToolButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolButton label="Copy range (Ctrl+C)" onClick={onCopy}>
        <ClipboardCopy className="size-3.5" />
      </ToolButton>
      <ToolButton label="Paste (Ctrl+V)" disabled={!editable} onClick={onPaste}>
        <ClipboardPaste className="size-3.5" />
      </ToolButton>

      {/* UC031's three paste modes, chosen before the paste rather than after. */}
      <Select value={pasteMode} onValueChange={(v) => setPasteMode(v as typeof pasteMode)}>
        <SelectTrigger className="h-7 w-32 text-[length:var(--text-meta)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PASTE_MODES.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {PASTE_MODE_LABELS[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolButton label="Fill gaps and extrapolate" disabled={!editable} onClick={onSeriesTools}>
        <TrendingUp className="size-3.5" />
      </ToolButton>
      <ToolButton label="Set publishing status in bulk" disabled={!editable} onClick={onBulkStatus}>
        <ShieldCheck className="size-3.5" />
      </ToolButton>
      <ToolButton label="Export to Excel" onClick={onExport}>
        <Download className="size-3.5" />
      </ToolButton>
      {/* UC052 — the applicable rules run against what is on screen, and the
          offending cells are ringed in place. */}
      <ToolButton
        label="Run quality checks on this workbook"
        disabled={isCheckingQuality}
        onClick={onRunQualityChecks}
      >
        <ShieldCheck className={cn('size-3.5', isCheckingQuality && 'animate-pulse')} />
      </ToolButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* The legacy screenshot's own control, default and all. */}
      <Select value={scale} onValueChange={(v) => setScale(v as Scale)}>
        <SelectTrigger className="h-7 w-40 text-[length:var(--text-meta)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCALES.map((s) => (
            <SelectItem key={s} value={s}>
              {SCALE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[length:var(--text-meta)]"
        onClick={toggleShowCodes}
      >
        {showCodes ? 'Hide codes' : 'Show codes'}
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Prototype-only, and labelled as such. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isLocked ? 'default' : 'outline'}
              size="sm"
              className="h-7 gap-1 text-[length:var(--text-meta)]"
              disabled={lockedCountry == null}
              onClick={() =>
                lockedCountry &&
                setSimulatedLock(lockedCountry, isLocked ? null : 'a.nkomo@who.int')
              }
            >
              <UserLock className="size-3.5" />
              {isLocked ? 'Release lock' : 'Simulate 2nd user'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Prototype-only control. UC033 puts a workbook another user holds into View Only
            mode — this simulates that second session.
          </TooltipContent>
        </Tooltip>

        {dirtyCount > 0 ? (
          <Badge variant="outline" className="border-who-primary-blue/50 text-who-primary-blue">
            {dirtyCount} unsaved
          </Badge>
        ) : null}

        <Button
          size="sm"
          className="h-7 gap-1"
          disabled={!editable || dirtyCount === 0}
          onClick={onSave}
        >
          <Save className="size-3.5" />
          Save to xMart
        </Button>
      </div>
    </div>
  )
}

function ToolButton({
  label,
  hint,
  disabled,
  onClick,
  children,
}: {
  label: string
  hint?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint ? <span className="block text-who-text-muted">{hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}
