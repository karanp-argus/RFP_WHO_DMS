/**
 * UC054 — *"configure the criteria to consider the status of a quality check as
 * pass, fail or warning."*
 *
 * One row per rule category, two numbers each, and — the part that makes the
 * screen usable rather than merely present — the **unit** beside every pair.
 * "Warn at 40" is unreadable without knowing whether that is 40 percent, 40
 * million national currency units or 40 consecutive years, and all three are
 * plausible readings of the same box on this page.
 *
 * Pass is not editable, because it is not a setting: pass is what a value is
 * when it crossed neither of the other two. Showing it as a third field would
 * invite a configuration that contradicts itself.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DEFAULT_THRESHOLDS,
  QC_DEVIATION_UNITS,
  QC_RULE_TYPE_DESCRIPTIONS,
  QC_RULE_TYPE_GROUPS,
  QC_RULE_TYPE_LABELS,
  type QcRuleType,
} from '@/domain/qc'
import { usePermissions } from '@/hooks/usePermissions'
import { allRules, useQcStore, useQcThresholds } from '@/stores/qcStore'
import { cn } from '@/lib/utils'
import { PassBadge, SeverityBadge } from '../QcBadges'

function ThresholdRow({ type, editable }: { type: QcRuleType; editable: boolean }) {
  const thresholds = useQcThresholds()
  const overrides = useQcStore((s) => s.thresholdOverrides)
  const setThreshold = useQcStore((s) => s.setThreshold)
  const ruleEdits = useQcStore((s) => s.ruleEdits)
  const removedRuleIds = useQcStore((s) => s.removedRuleIds)

  const pair = thresholds[type]
  const delivered = DEFAULT_THRESHOLDS[type]
  const isOverridden = overrides[type] != null
  const { hint } = QC_DEVIATION_UNITS[type]

  // How many rules this row actually governs — a rule with its own pair does
  // not, and saying so here stops the page from over-promising.
  const rules = allRules(ruleEdits, removedRuleIds).filter((r) => r.type === type)
  const governed = rules.filter((r) => r.thresholds == null).length
  const withOwn = rules.length - governed

  const [warn, setWarn] = useState(String(pair.warnAt))
  const [fail, setFail] = useState(String(pair.failAt))

  // The fields are drafts over the store, so an external change — "Reset all",
  // or another surface writing a threshold — has to pull them back into line.
  // Without this the boxes keep showing what was typed after a reset, and the
  // next blur writes the stale draft straight back over the reset.
  useEffect(() => {
    setWarn(String(pair.warnAt))
    setFail(String(pair.failAt))
  }, [pair.warnAt, pair.failAt])

  function commit(nextWarn: string, nextFail: string) {
    const w = Number(nextWarn)
    const f = Number(nextFail)
    if (!Number.isFinite(w) || !Number.isFinite(f)) {
      toast.error('Both thresholds must be numbers.')
      setWarn(String(pair.warnAt))
      setFail(String(pair.failAt))
      return
    }
    // Writing an unchanged value would record an "override" identical to the
    // delivered pair, which reads on screen as a change nobody made.
    if (w === pair.warnAt && f === pair.failAt) return
    setThreshold(type, { warnAt: w, failAt: f })
  }

  return (
    <li className="flex flex-wrap items-start gap-4 border-b border-who-border/60 px-3 py-3 last:border-b-0">
      <div className="min-w-64 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
            {QC_RULE_TYPE_LABELS[type]}
          </span>
          {isOverridden ? (
            <Badge variant="outline" className="border-who-warn/50 text-who-warn">
              Changed
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 max-w-2xl text-[length:var(--text-meta)] text-who-text-muted">
          {QC_RULE_TYPE_DESCRIPTIONS[type]}
        </p>
        <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
          Governs {governed} rule{governed === 1 ? '' : 's'}
          {withOwn > 0
            ? ` — ${withOwn} more of this type carr${withOwn === 1 ? 'ies' : 'y'} its own thresholds and is unaffected.`
            : '.'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label
            htmlFor={`warn-${type}`}
            className="flex items-center gap-1 text-[length:var(--text-meta)]"
          >
            <SeverityBadge severity="warning" />
          </Label>
          <Input
            id={`warn-${type}`}
            value={warn}
            disabled={!editable}
            inputMode="decimal"
            onChange={(e) => setWarn(e.target.value)}
            onBlur={() => commit(warn, fail)}
            className="mt-1 w-28 text-right font-mono tabular-nums"
          />
        </div>

        <div>
          <Label
            htmlFor={`fail-${type}`}
            className="flex items-center gap-1 text-[length:var(--text-meta)]"
          >
            <SeverityBadge severity="error" />
          </Label>
          <Input
            id={`fail-${type}`}
            value={fail}
            disabled={!editable}
            inputMode="decimal"
            onChange={(e) => setFail(e.target.value)}
            onBlur={() => commit(warn, fail)}
            className="mt-1 w-28 text-right font-mono tabular-nums"
          />
        </div>

        <div className="pb-2">
          {/* The unit is the whole reason these boxes are readable. */}
          <p className="text-[length:var(--text-meta)] text-who-text-muted">{hint}</p>
          <p
            className={cn(
              'text-[length:var(--text-meta)]',
              isOverridden ? 'text-who-text-muted' : 'invisible',
            )}
          >
            Delivered: {delivered.warnAt.toLocaleString()} / {delivered.failAt.toLocaleString()}
          </p>
        </div>
      </div>
    </li>
  )
}

export function ThresholdsTab() {
  // UC054 is worded "As an administrator", and it is the right level: these are
  // the criteria every user's report is judged against, so they are not a
  // personal preference. `canCreatePredefined` is the level that means
  // "may author something everybody gets".
  const { canCreatePredefined } = usePermissions()
  const editable = canCreatePredefined('quality')
  const overrides = useQcStore((s) => s.thresholdOverrides)
  const resetThresholds = useQcStore((s) => s.resetThresholds)
  const changed = Object.keys(overrides).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-3xl flex-1 text-[length:var(--text-body-sm)] text-who-text-muted">
          These are the criteria every rule is judged against unless it carries its own. A value
          at or above the warning threshold is a warning; at or above the failure threshold it is a
          failure; below both it is a <PassBadge />.
        </p>
        {editable && changed > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  resetThresholds()
                  toast.success('Thresholds restored to the delivered values.')
                }}
              >
                <RotateCcw className="size-3.5" />
                Reset all ({changed})
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restore every category to the delivered thresholds</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {!editable ? (
        <p className="rounded border border-who-border bg-who-page-bg px-3 py-2 text-[length:var(--text-meta)] text-who-text-muted">
          Thresholds are administrator-configurable (UC054). You can see the values every rule is
          judged against.
        </p>
      ) : null}

      {QC_RULE_TYPE_GROUPS.map((group) => (
        <section key={group.label} className="rounded border border-who-border bg-who-surface">
          <header className="border-b border-who-border px-3 py-2">
            <h3 className="text-[length:var(--text-body-sm)] font-semibold tracking-wide text-who-heading uppercase">
              {group.label}
            </h3>
          </header>
          <ul className="list-none">
            {group.types.map((type) => (
              <ThresholdRow key={type} type={type} editable={editable} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
