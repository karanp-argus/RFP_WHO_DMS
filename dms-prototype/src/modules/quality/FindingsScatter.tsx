/**
 * The findings scatter — year against deviation, one point per finding.
 *
 * Two things a table cannot show and this can: whether the findings cluster in
 * a particular period (a methodology change, a currency redenomination), and
 * how far the worst of them sit from the threshold that caught them. The
 * threshold lines are drawn in, because a point at 40 means nothing without
 * knowing the rule fires at 8.
 *
 * A log scale on the deviation axis, because the range in a real run spans
 * three orders of magnitude — a handful of enormous outliers otherwise flatten
 * everything else onto the axis and the chart says only "there are some big
 * ones", which the summary tiles already said.
 *
 * Colour is severity, from the same two tokens the badges use, so a red point
 * here and a red badge in the table are the same statement. Every colour is a
 * CSS variable read at render, never a hex — CLAUDE.md, and it is also what
 * makes the chart follow the theme toggle.
 */

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { EmptyState } from '@/components/common/EmptyState'
import { QC_RULE_TYPE_LABELS, type QcFinding, type QcThresholdPair } from '@/domain/qc'
import { formatDeviation } from './FindingsTable'

interface Point {
  year: number
  deviation: number
  finding: QcFinding
}

export interface FindingsScatterProps {
  findings: readonly QcFinding[]
  /** Drawn as reference lines when every plotted finding shares a rule type. */
  thresholds?: QcThresholdPair | null
  height?: number
}

/**
 * Recharts takes colours as props, not classes, so the tokens have to be read
 * out of the cascade rather than applied as utilities.
 *
 * Reading them during render is only half the job: flipping `.dark` on the root
 * element changes the cascade without changing any React state, so a chart
 * already on screen would keep the palette it was born with. The component
 * subscribes to `next-themes` for exactly that reason — the value is unused
 * except as a render trigger.
 */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function FindingsScatter({ findings, thresholds, height = 300 }: FindingsScatterProps) {
  // Subscribed to, not read: a theme change has to re-render this component or
  // the colours below stay on the previous palette.
  useTheme()

  const points = useMemo<Point[]>(
    () =>
      findings
        // A zero or negative deviation cannot be placed on a log axis, and a
        // finding with no magnitude is a structural one the table shows better.
        .filter((f) => f.deviation > 0 && Number.isFinite(f.deviation))
        .map((f) => ({ year: f.year, deviation: f.deviation, finding: f })),
    [findings],
  )

  if (points.length === 0) {
    return (
      <EmptyState
        message="Nothing to plot"
        hint="The findings in this view have no measured magnitude — the table shows them in full."
      />
    )
  }

  const fail = token('--who-fail', '#c0392b')
  const warn = token('--who-warn', '#9c6415')
  const grid = token('--who-border', '#e5e7eb')
  const axis = token('--who-text-muted', '#6b7280')
  const surface = token('--who-surface-raised', '#ffffff')

  const max = Math.max(...points.map((p) => p.deviation))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="year"
            name="Year"
            domain={['dataMin - 1', 'dataMax + 1']}
            allowDecimals={false}
            tick={{ fill: axis, fontSize: 11 }}
            stroke={grid}
            label={{ value: 'Year', position: 'insideBottom', offset: -14, fill: axis, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="deviation"
            name="Deviation"
            scale="log"
            domain={['auto', 'auto']}
            tick={{ fill: axis, fontSize: 11 }}
            stroke={grid}
            width={56}
          />
          <ZAxis range={[36, 36]} />

          {/* The lines that produced the points. Only meaningful when the view
              is a single rule type — otherwise two rules with different units
              would be judged against one line. */}
          {thresholds ? (
            <>
              <ReferenceLine
                y={thresholds.warnAt}
                stroke={warn}
                strokeDasharray="4 4"
                label={{ value: 'Warning', position: 'right', fill: warn, fontSize: 10 }}
              />
              {thresholds.failAt <= max ? (
                <ReferenceLine
                  y={thresholds.failAt}
                  stroke={fail}
                  strokeDasharray="4 4"
                  label={{ value: 'Fail', position: 'right', fill: fail, fontSize: 10 }}
                />
              ) : null}
            </>
          ) : null}

          <RechartsTooltip
            cursor={{ stroke: grid }}
            contentStyle={{
              background: surface,
              border: `1px solid ${grid}`,
              borderRadius: 4,
              fontSize: 12,
            }}
            content={({ payload }) => {
              const point = payload?.[0]?.payload as Point | undefined
              if (!point) return null
              const f = point.finding
              return (
                <div className="max-w-xs rounded border border-who-border bg-who-surface-raised p-2 shadow-who-card">
                  <p className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                    {f.iso3} · {f.year} · {f.code}
                  </p>
                  <p className="text-[length:var(--text-meta)] text-who-text-muted">
                    {QC_RULE_TYPE_LABELS[f.ruleType]} — {formatDeviation(f)}
                  </p>
                  <p className="mt-1 text-[length:var(--text-meta)] text-who-text">{f.message}</p>
                </div>
              )
            }}
          />

          <Scatter data={points} fillOpacity={0.75}>
            {points.map((p) => (
              <Cell key={p.finding.id} fill={p.finding.severity === 'error' ? fail : warn} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
