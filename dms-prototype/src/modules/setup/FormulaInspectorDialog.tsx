/**
 * The formula inspector — what the Phase 3 engine looks like from outside.
 *
 * The plan asks for the parsed AST and the dependency chain to be visible in
 * the demo, on the grounds that it is "proof of engineering depth that
 * screenshots cannot fake". This dialog is that: for one indicator, one country
 * and one year, it shows the expression actually used, the tree it parsed to,
 * every value the evaluator read, whether the null guard passed, and the
 * result — so a computed number can be traced back to the reported leaves it
 * came from without leaving the screen.
 */

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { NULL_POLICY_DESCRIPTIONS, astOutline, type EvaluationResult } from '@/domain/formula'
import type { Formula } from '@/domain/types'
import { BLANK, formatValue } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface FormulaInspectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formula: Formula
  result: EvaluationResult | null
  countryLabel: string
  year: number
}

export function FormulaInspectorDialog({
  open,
  onOpenChange,
  formula,
  result,
  countryLabel,
  year,
}: FormulaInspectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{formula.code}</DialogTitle>
          <DialogDescription>
            {formula.name} — evaluated for {countryLabel}, {year}.
          </DialogDescription>
        </DialogHeader>

        {result == null ? (
          <p className="text-[length:var(--text-body-sm)] text-who-text-muted">
            Loading values from xMart…
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4">
              <ResultBlock formula={formula} result={result} />
              <Separator />
              <ExpressionBlock formula={formula} result={result} />
              <Separator />
              <InputsBlock result={result} />
              {result.chain.length > 1 ? (
                <>
                  <Separator />
                  <ChainBlock result={result} />
                </>
              ) : null}
              <Separator />
              <AstBlock result={result} />
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------------------
   Result and guard
   -------------------------------------------------------------------------- */

function ResultBlock({ formula, result }: { formula: Formula; result: EvaluationResult }) {
  const failed = result.guard === 'failed'

  return (
    <section className="rounded border border-who-border bg-who-page-bg px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[length:var(--text-meta)] text-who-text-muted uppercase">Result</p>
          <p
            className={cn(
              'font-mono text-2xl font-semibold',
              result.blank ? 'text-who-text-muted' : 'text-who-heading',
            )}
          >
            {formatValue(result.value, formula.unit)}
          </p>
          <p className="text-[length:var(--text-meta)] text-who-text-muted">{formula.unit}</p>
        </div>

        {result.error ? (
          <Badge variant="outline" className="border-who-fail/60 text-who-fail">
            {result.error.kind}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              failed ? 'border-who-warn/60 text-who-warn' : 'border-who-pass/60 text-who-pass',
            )}
          >
            {result.guard === 'not-applicable'
              ? 'no inputs to guard'
              : failed
                ? 'guard failed → blank'
                : 'guard passed'}
          </Badge>
        )}
      </div>

      {result.error ? (
        <p className="mt-2 text-[length:var(--text-meta)] text-who-fail">{result.error.message}</p>
      ) : null}

      <p className="mt-2 text-[length:var(--text-meta)] text-who-text-muted">
        <span className="font-semibold">{formula.conditionLabel}</span> —{' '}
        {NULL_POLICY_DESCRIPTIONS[formula.nullPolicy]}
      </p>

      {failed ? (
        <p className="mt-1 text-[length:var(--text-meta)] text-who-warn">
          Missing:{' '}
          <span className="font-mono">{result.missing.map((m) => m.code).join(', ')}</span>. The
          result is blank, not zero — and stays blank in exports.
        </p>
      ) : null}
    </section>
  )
}

/* --------------------------------------------------------------------------
   Expression
   -------------------------------------------------------------------------- */

function ExpressionBlock({ formula, result }: { formula: Formula; result: EvaluationResult }) {
  return (
    <section>
      <SectionTitle>Expression</SectionTitle>
      <p className="font-mono text-[length:var(--text-body-sm)] text-who-cell-formula italic">
        {result.expression ?? formula.expression}
      </p>
      {result.usesCountryOverride ? (
        <p className="mt-1 text-[length:var(--text-meta)] text-who-warn">
          This country has a UC029 override. The standard definition —{' '}
          <span className="font-mono">{formula.expression}</span> — is unchanged everywhere else.
        </p>
      ) : null}
    </section>
  )
}

/* --------------------------------------------------------------------------
   Inputs
   -------------------------------------------------------------------------- */

const ORIGIN_LABELS: Record<string, string> = {
  reported: 'reported by country',
  aggregate: 'summed from children',
  formula: 'computed by a formula',
  series: 'read across years',
}

function InputsBlock({ result }: { result: EvaluationResult }) {
  if (result.reads.length === 0) {
    return (
      <section>
        <SectionTitle>Inputs</SectionTitle>
        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          This expression reads no variables.
        </p>
      </section>
    )
  }

  return (
    <section>
      <SectionTitle>Inputs read ({result.reads.length})</SectionTitle>
      <div className="overflow-hidden rounded border border-who-border">
        <table className="w-full text-[length:var(--text-body-sm)]">
          <thead>
            <tr className="bg-who-page-bg text-[length:var(--text-meta)] text-who-text-muted uppercase">
              <th className="px-3 py-1.5 text-left font-semibold">Variable</th>
              <th className="px-3 py-1.5 text-left font-semibold">Year</th>
              <th className="px-3 py-1.5 text-left font-semibold">Source</th>
              <th className="px-3 py-1.5 text-right font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {result.reads.map((read, i) => (
              <tr
                key={`${read.code}|${read.year}|${i}`}
                className={cn('bg-who-surface', i > 0 && 'border-t border-who-border/60')}
              >
                <td className="px-3 py-1.5 font-mono">{read.code}</td>
                <td className="px-3 py-1.5 tabular-nums">{read.year}</td>
                <td className="px-3 py-1.5 text-who-text-muted">
                  {ORIGIN_LABELS[read.origin] ?? read.origin}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5 text-right font-mono tabular-nums',
                    read.value == null && 'text-who-warn',
                  )}
                >
                  {read.value == null ? BLANK : formatValue(read.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Dependency chain
   -------------------------------------------------------------------------- */

function ChainBlock({ result }: { result: EvaluationResult }) {
  return (
    <section>
      <SectionTitle>Evaluated in this order</SectionTitle>
      <div className="flex flex-wrap items-center gap-1.5">
        {result.chain.map((code, i) => (
          <span key={`${code}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-who-text-muted">→</span> : null}
            <Badge variant="secondary" className="font-mono">
              {code}
            </Badge>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[length:var(--text-meta)] text-who-text-muted">
        Topological order from the dependency graph — dependencies first, never string
        substitution.
      </p>
    </section>
  )
}

/* --------------------------------------------------------------------------
   AST
   -------------------------------------------------------------------------- */

function AstBlock({ result }: { result: EvaluationResult }) {
  if (!result.ast) return null
  const rows = astOutline(result.ast)

  return (
    <section>
      <SectionTitle>Parsed syntax tree</SectionTitle>
      <div className="rounded border border-who-border bg-who-page-bg px-3 py-2 font-mono text-[length:var(--text-meta)]">
        {rows.map((row, i) => (
          <div key={i} style={{ paddingLeft: `${row.depth * 16}px` }} className="leading-6">
            <span className="text-who-text-muted">{row.depth > 0 ? '└ ' : ''}</span>
            <span className="text-who-text-muted">{row.label}</span>{' '}
            <span className="text-who-heading">{row.detail}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[length:var(--text-meta)] text-who-text-muted">
        Produced by the hand-written tokeniser and recursive-descent parser in{' '}
        <span className="font-mono">src/domain/formula</span>. Variable codes containing{' '}
        <span className="font-mono">. % $ -</span> and spaces are matched greedily against the
        known-variable set rather than split on characters.
      </p>
    </section>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1.5 text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase">
      {children}
    </h4>
  )
}
