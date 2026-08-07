/**
 * The To-Be architecture, rendered from `domain/integration/architecture.ts`.
 *
 * A live diagram rather than an exported image, so it cannot go stale the
 * first time the flow changes. It is also laid out with CSS rather than SVG
 * paths: the arrows are borders and the columns are a grid, which means the
 * whole thing follows the theme and reflows on a narrow screen instead of
 * scrolling sideways as one fixed-size picture.
 */

import { ArrowLeft, ArrowRight, Building2, Database, Globe2, LayoutGrid } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  ARCHITECTURE_FLOWS,
  ARCHITECTURE_NODES,
  type ArchitectureNode,
  type NodeKind,
} from '@/domain/integration'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<NodeKind, typeof Database> = {
  source: Building2,
  warehouse: Database,
  dms: LayoutGrid,
  consumer: Globe2,
}

/**
 * DMS is the only box that gets the brand fill.
 *
 * Everything else on this diagram is a system WHO already runs. Making the one
 * thing being procured visually distinct is the point of drawing it at all.
 */
const KIND_CLASS: Record<NodeKind, string> = {
  source: 'border-who-border bg-who-surface',
  warehouse: 'border-who-primary-blue bg-who-accent-subtle',
  dms: 'border-who-brand bg-who-brand text-who-on-brand',
  consumer: 'border-who-border bg-who-surface',
}

function NodeCard({ node }: { node: ArchitectureNode }) {
  const Icon = KIND_ICON[node.kind]
  const onBrand = node.kind === 'dms'
  return (
    <div className={cn('rounded border p-3 shadow-who-card', KIND_CLASS[node.kind])}>
      <span className="flex items-center gap-2">
        <Icon className={cn('size-4', onBrand ? 'text-who-on-brand' : 'text-who-primary-blue')} aria-hidden />
        <span
          className={cn(
            'text-[length:var(--text-body-sm)] font-semibold',
            onBrand ? 'text-who-on-brand' : 'text-who-heading',
          )}
        >
          {node.label}
        </span>
      </span>
      <span
        className={cn(
          'mt-1 block text-[length:var(--text-meta)]',
          onBrand ? 'text-who-on-brand/80' : 'text-who-text-muted',
        )}
      >
        {node.detail}
      </span>
    </div>
  )
}

function Arrow({
  label,
  useCase,
  isDms,
  back = false,
}: {
  label: string
  useCase: string
  isDms: boolean
  /** Points left — the UC046 push, drawn on the same axis as the pull. */
  back?: boolean
}) {
  const Icon = back ? ArrowLeft : ArrowRight
  return (
    <div className="flex flex-col items-center gap-1 py-1 text-center">
      <Icon
        className={cn('size-4 shrink-0', isDms ? 'text-who-primary-blue' : 'text-who-icon')}
        aria-hidden
      />
      <span className="max-w-[190px] text-[length:var(--text-meta)] text-who-text-muted">
        {label}
      </span>
      {useCase ? (
        <Badge variant={isDms ? 'default' : 'secondary'} className="font-mono">
          {useCase}
        </Badge>
      ) : null}
    </div>
  )
}

export function ArchitectureDiagram() {
  const byId = new Map(ARCHITECTURE_NODES.map((n) => [n.id, n]))
  const sources = ARCHITECTURE_NODES.filter((n) => n.kind === 'source')
  const xmart = byId.get('xmart')
  const dms = byId.get('dms')
  const consumer = byId.get('consumer')

  const inbound = ARCHITECTURE_FLOWS.filter((f) => f.to === 'xmart')
  const pull = ARCHITECTURE_FLOWS.find((f) => f.from === 'xmart' && f.to === 'dms')
  const push = ARCHITECTURE_FLOWS.find((f) => f.from === 'dms' && f.to === 'xmart')
  const outbound = ARCHITECTURE_FLOWS.find((f) => f.to === 'publications')

  return (
    <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
      <div className="space-y-3">
        {sources.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>

      <div className="space-y-4">
        {inbound.map((flow) => (
          <Arrow key={flow.from} label={flow.label} useCase={flow.useCase} isDms={flow.isDms} />
        ))}
      </div>

      <div className="space-y-3">
        {xmart ? <NodeCard node={xmart} /> : null}
        {consumer ? (
          <>
            {outbound ? (
              <Arrow
                label={outbound.label}
                useCase={outbound.useCase}
                isDms={outbound.isDms}
              />
            ) : null}
            <NodeCard node={consumer} />
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        {pull ? <Arrow label={pull.label} useCase={pull.useCase} isDms /> : null}
        {/* The push runs back to xMart. Drawn on the same axis as the pull
            rather than as a second edge elsewhere — two crossing arrows are
            harder to follow than one column with a return. */}
        {push ? <Arrow label={push.label} useCase={push.useCase} isDms back /> : null}
      </div>

      <div>{dms ? <NodeCard node={dms} /> : null}</div>
    </div>
  )
}
