/**
 * Unit, currency, scale and language — UC035's *"combinations of predefined
 * units and currencies"* and UC041's language list.
 *
 * The scale selector says **"Millions (Default)"** because the legacy DMS one
 * does. That wording is kept deliberately (§2.4: keep what the team knows), and
 * millions is the default here for the same reason.
 *
 * **The honest note under the unit selector is not decoration.** Only figures
 * stored in national currency can be converted or rescaled; a percentage is a
 * percentage in every currency and `CHE per capita in US$` is already in
 * dollars. A selector that silently left half the report unchanged would be
 * read as a bug, so the control says which half it applies to.
 *
 * **All six WHO languages carry seeded labels (UC041).** Headers, classification
 * labels, indicator names, totals and both exported sheets are translated;
 * country names, currency names, the report's own name and observation metadata
 * are field values and stay as registered, which is UC041's own carve-out.
 *
 * **Arabic is a caveat, and the caveat is on screen rather than in a document.**
 * The labels are Arabic; the grid still runs left to right. Selecting it says so
 * beneath the selector, because the one way to get this wrong in a demo is to
 * let a reviewer discover it from a screenshot.
 */

import { Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  RTL_LANGUAGES,
  SCALES,
  SCALE_LABELS,
  WHO_LANGUAGES,
  WHO_LANGUAGE_LABELS,
  type Scale,
  type WhoLanguage,
} from '@/domain/constants'
import {
  REPORT_UNITS,
  REPORT_UNIT_LABELS,
  type ReportPresentation,
  type ReportUnit,
} from '@/domain/report'

/**
 * Languages with a seeded label pack — all six of HLR21.
 *
 * Kept as a named list rather than assumed equal to `WHO_LANGUAGES`, because it
 * is the thing `translations.test.ts` asserts coverage against: adding a seventh
 * language to the constant should not silently offer a language with no pack.
 */
export const SUPPORTED_REPORT_LANGUAGES: readonly WhoLanguage[] = [
  'en',
  'fr',
  'es',
  'ar',
  'zh',
  'ru',
]

/**
 * Limits worth stating at the point of choosing, not in a footnote. Both are
 * true of the prototype and neither is hidden: the RTL one is a layout project
 * scoped in the proposal, and the "not translated" one is UC041's own carve-out.
 */
const LANGUAGE_CAVEAT: Partial<Record<WhoLanguage, string>> = {
  ar: 'Labels are translated. Right-to-left layout is not implemented in this prototype — the grid still runs left to right.',
}

export interface PresentationControlsProps {
  presentation: ReportPresentation
  disabled?: boolean
  onChange: (presentation: ReportPresentation) => void
  /** Prefix for the generated ids, when two of these are on one page. */
  idPrefix?: string
}

export function PresentationControls({
  presentation,
  disabled = false,
  onChange,
  idPrefix = 'presentation',
}: PresentationControlsProps) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-[240px] flex-1">
        <Label htmlFor={`${idPrefix}-unit`} className="flex items-center gap-1.5">
          Unit and currency
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3 text-who-icon" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Applies to figures reported in national currency. Percentages, counts and
              per-capita US dollar indicators are shown as they are — converting them would
              produce numbers that are wrong rather than differently presented.
            </TooltipContent>
          </Tooltip>
        </Label>
        <Select
          value={presentation.unit}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...presentation, unit: v as ReportUnit })}
        >
          <SelectTrigger id={`${idPrefix}-unit`} className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {REPORT_UNIT_LABELS[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
          {presentation.unit === 'national'
            ? 'Each country in its own currency. Totals across countries are refused rather than added together.'
            : 'Converted at each country-year exchange rate before anything is aggregated.'}
        </p>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-scale`}>Scale</Label>
        <Select
          value={presentation.scale}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...presentation, scale: v as Scale })}
        >
          <SelectTrigger id={`${idPrefix}-scale`} className="mt-1 w-44">
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
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-decimals`}>Decimals</Label>
        <Select
          value={String(presentation.decimals)}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...presentation, decimals: Number(v) })}
        >
          <SelectTrigger id={`${idPrefix}-decimals`} className="mt-1 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3].map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-language`} className="flex items-center gap-1.5">
          Report labels
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3 text-who-icon" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              UC041: all six official WHO languages. Headers, classification labels, indicator
              names, totals and both sheets of the Excel file are translated. Field values are
              not — country and currency names, the report’s own name and observation metadata
              stay as registered, which is what the use case asks for.
            </TooltipContent>
          </Tooltip>
        </Label>
        <Select
          value={presentation.language}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...presentation, language: v as WhoLanguage })}
        >
          <SelectTrigger id={`${idPrefix}-language`} className="mt-1 w-48">
            {/*
              Children override what Radix would render, which is the selected
              option's full text. Without this the trigger inherits the RTL hint
              below and truncates it mid-word at this width — the hint belongs in
              the list and in the note under the control, not in 48 rem of button.
            */}
            <SelectValue>{WHO_LANGUAGE_LABELS[presentation.language]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {WHO_LANGUAGES.map((l) => (
              <SelectItem
                key={l}
                value={l}
                disabled={!SUPPORTED_REPORT_LANGUAGES.includes(l)}
              >
                {WHO_LANGUAGE_LABELS[l]}
                {RTL_LANGUAGES.includes(l) ? (
                  <span className="text-who-text-muted">— labels only, no RTL layout</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {LANGUAGE_CAVEAT[presentation.language] ? (
          <p className="mt-1 max-w-[13rem] text-[length:var(--text-meta)] text-who-text-muted">
            {LANGUAGE_CAVEAT[presentation.language]}
          </p>
        ) : null}
      </div>
    </div>
  )
}
