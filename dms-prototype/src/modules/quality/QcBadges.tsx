/**
 * The badges the Quality Checks module is judged on.
 *
 * `RuleOriginBadge` is not decoration. UC053 requires that *"the rules created
 * by the developer team"* be distinguishable from those an administrator
 * created, and this is the whole of that requirement: three origins, three
 * colours, three shapes of wording, on every surface a rule appears. If two of
 * them ever render the same way, the use case is not met.
 *
 * Colour comes from tokens only, per CLAUDE.md — and the pairs are chosen so
 * the badges stay distinct in both themes and for a red/green colour-blind
 * reader, which is why the origin badges differ in fill *and* border weight
 * rather than hue alone.
 */

import { CircleDot, ShieldCheck, TriangleAlert, UserRound, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  QC_RULE_ORIGIN_DESCRIPTIONS,
  QC_RULE_ORIGIN_LABELS,
  QC_SEVERITY_LABELS,
  type QcRuleOrigin,
  type QcSeverity,
} from '@/domain/qc'
import { cn } from '@/lib/utils'

const ORIGIN_STYLE: Record<QcRuleOrigin, string> = {
  // Brand fill: shipped with the product, the strongest claim on the screen.
  dev: 'border-transparent bg-who-brand text-who-on-brand',
  // Outlined in the primary blue: local policy, authored inside this instance.
  admin: 'border-who-primary-blue bg-transparent text-who-primary-blue',
  // Quiet: one person's working rule, not a statement about the data.
  user: 'border-who-border bg-who-page-bg text-who-text-muted',
}

const ORIGIN_ICON: Record<QcRuleOrigin, typeof Wrench> = {
  dev: Wrench,
  admin: ShieldCheck,
  user: UserRound,
}

export function RuleOriginBadge({
  origin,
  className,
}: {
  origin: QcRuleOrigin
  className?: string
}) {
  const Icon = ORIGIN_ICON[origin]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          // A stable hook for the verification harness. Radix merges its own
          // `data-slot` over the child's inside a TooltipTrigger, so shadcn's
          // badge slot is not addressable here.
          data-qc-origin={origin}
          className={cn('gap-1', ORIGIN_STYLE[origin], className)}
        >
          <Icon className="size-3" aria-hidden />
          {QC_RULE_ORIGIN_LABELS[origin]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {QC_RULE_ORIGIN_DESCRIPTIONS[origin]}
      </TooltipContent>
    </Tooltip>
  )
}

const SEVERITY_STYLE: Record<QcSeverity, string> = {
  error: 'border-who-fail/50 bg-who-fail/10 text-who-fail',
  warning: 'border-who-warn/50 bg-who-warn/10 text-who-warn',
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: QcSeverity
  className?: string
}) {
  const Icon = severity === 'error' ? TriangleAlert : CircleDot
  return (
    <Badge data-qc-severity={severity} className={cn('gap-1', SEVERITY_STYLE[severity], className)}>
      <Icon className="size-3" aria-hidden />
      {QC_SEVERITY_LABELS[severity]}
    </Badge>
  )
}

/** A pass, for a rule or a run that found nothing. The third UC054 state. */
export function PassBadge({ label = 'Pass' }: { label?: string }) {
  return (
    <Badge className="gap-1 border-who-pass/50 bg-who-pass/10 text-who-pass">
      <ShieldCheck className="size-3" aria-hidden />
      {label}
    </Badge>
  )
}
