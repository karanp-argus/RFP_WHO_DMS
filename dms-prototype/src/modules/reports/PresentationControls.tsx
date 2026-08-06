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
 * **UC041 is partial and labelled as such.** English, French and Spanish have
 * seeded variable labels; Arabic, Chinese and Russian are listed and disabled,
 * with the reason on the option. Arabic in particular needs RTL layout work
 * that belongs in the proposal rather than in a fake dropdown entry.
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
 * Languages with seeded labels. The other three are offered and disabled rather
 * than hidden, because "we know these are required and here is what is missing"
 * is a stronger answer to HLR21 than a dropdown with three entries.
 */
export const SUPPORTED_REPORT_LANGUAGES: readonly WhoLanguage[] = ['en', 'fr', 'es']

const UNSUPPORTED_REASON: Partial<Record<WhoLanguage, string>> = {
  ar: 'Needs right-to-left layout — scoped in the proposal, not faked here',
  zh: 'Variable labels not yet translated in the seeded configuration',
  ru: 'Variable labels not yet translated in the seeded configuration',
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
              UC041: headers and labels are translated; field values such as metadata text are
              not. Three of the six WHO languages have seeded labels — the rest are listed with
              what is missing.
            </TooltipContent>
          </Tooltip>
        </Label>
        <Select
          value={presentation.language}
          disabled={disabled}
          onValueChange={(v) => onChange({ ...presentation, language: v as WhoLanguage })}
        >
          <SelectTrigger id={`${idPrefix}-language`} className="mt-1 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WHO_LANGUAGES.map((l) => {
              const supported = SUPPORTED_REPORT_LANGUAGES.includes(l)
              return (
                <SelectItem key={l} value={l} disabled={!supported}>
                  {WHO_LANGUAGE_LABELS[l]}
                  {supported ? '' : ` — ${UNSUPPORTED_REASON[l] ?? 'not available'}`}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
