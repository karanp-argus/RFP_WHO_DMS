/**
 * Crosses (UC025 predefined, UC026 custom).
 *
 * FR §1: a cross is classification categories crossed together, `HF.1xFS.1`
 * being the canonical example. The critical modelling point, restated here
 * because it is easy to get wrong: a cross is a *selector over a multi-dimension
 * tuple*, not an entity observations point at. The builder therefore picks
 * dimensions and members, and the resulting `code` is derived.
 *
 * UC025 — predefined crosses are admin-authored, visible to all, "with no
 *          possibility to edit, but export/copy".
 * UC026 — custom crosses are user-authored and scoped to specific countries.
 */

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Copy, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/common/DataTable'
import { LoadingState } from '@/components/common/EmptyState'
import { CountryPicker } from '@/components/common/CountryPicker'
import { downloadCsv } from '@/lib/exporters'
import { DIMENSIONS, type DimensionCode } from '@/domain/constants'
import { crossCode } from '@/domain/keys'
import type { Cross, Dimensions, Variable } from '@/domain/types'
import { useCrosses, useVariables } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'

export function CrossesTab() {
  const { data: crosses, isLoading } = useCrosses()
  const { data: variables } = useVariables()
  const { canEdit, canCreatePredefined, user } = usePermissions()
  const [scope, setScope] = useState<'all' | 'predefined' | 'custom'>('all')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [localCrosses, setLocalCrosses] = useState<Cross[]>([])

  const all = useMemo(() => [...(crosses ?? []), ...localCrosses], [crosses, localCrosses])
  const filtered = useMemo(
    () => (scope === 'all' ? all : all.filter((c) => c.scope === scope)),
    [all, scope],
  )

  const columns = useMemo<ColumnDef<Cross, unknown>[]>(
    () => [
      {
        id: 'code',
        accessorKey: 'code',
        header: 'Cross',
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-who-heading">{row.original.code}</span>
        ),
      },
      {
        id: 'label',
        accessorKey: 'label',
        header: 'Description',
        cell: ({ getValue }) => <span className="truncate">{String(getValue() ?? '')}</span>,
      },
      {
        id: 'dimensions',
        accessorFn: (r) => Object.keys(r.members).join(' × '),
        header: 'Dimensions',
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {Object.entries(row.original.members).map(([dim, member]) => (
              <Badge key={dim} variant="secondary" className="font-mono text-[length:var(--text-meta)]">
                {dim}={member}
              </Badge>
            ))}
          </span>
        ),
      },
      {
        id: 'scope',
        accessorKey: 'scope',
        header: 'Scope',
        cell: ({ row }) =>
          row.original.scope === 'predefined' ? (
            <Badge variant="outline">Predefined</Badge>
          ) : (
            <Badge variant="outline" className="border-who-warn/50 text-who-heading">
              Custom
            </Badge>
          ),
      },
      {
        id: 'countryScope',
        accessorFn: (r) => r.countryScope.join(', '),
        header: 'Countries',
        cell: ({ row }) =>
          row.original.countryScope.length === 0 ? (
            <span className="text-who-text-muted">All countries</span>
          ) : (
            <span className="font-mono text-[length:var(--text-meta)]">
              {row.original.countryScope.join(', ')}
            </span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Copy ${row.original.code}`}
            onClick={(e) => {
              e.stopPropagation()
              void navigator.clipboard.writeText(row.original.code)
              toast.success(`Copied ${row.original.code}`)
            }}
          >
            <Copy className="size-3.5" />
          </Button>
        ),
      },
    ],
    [],
  )

  if (isLoading) return <LoadingState label="Loading crosses from xMart…" />

  return (
    <div className="space-y-4">
      <div className="rounded border border-who-border bg-who-page-bg px-4 py-3">
        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          A cross is two or more classification categories reported together — standard notation
          <span className="mx-1 font-mono">HF.1xFS.1</span>. Crosses are stored as multi-dimension
          tuples on the observation itself, so a cross defined here is a view over existing data
          rather than a new record type.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="predefined">
              Predefined ({all.filter((c) => c.scope === 'predefined').length})
            </TabsTrigger>
            <TabsTrigger value="custom">
              Custom ({all.filter((c) => c.scope === 'custom').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {canEdit('setup') ? (
          <Button size="sm" onClick={() => setBuilderOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" />
            New cross
          </Button>
        ) : null}
      </div>

      <DataTable<Cross>
        data={filtered}
        columns={columns}
        searchPlaceholder="Search crosses"
        getRowId={(r) => r.id}
        onExport={(rows) =>
          downloadCsv(
            rows.map((c) => ({
              CODE: c.code,
              LABEL: c.label,
              MEMBERS: Object.entries(c.members)
                .map(([d, m]) => `${d}=${m}`)
                .join('|'),
              SCOPE: c.scope,
              COUNTRIES: c.countryScope.join(' '),
              CREATED_BY: c.createdBy,
            })),
            ['CODE', 'LABEL', 'MEMBERS', 'SCOPE', 'COUNTRIES', 'CREATED_BY'],
            'crosses',
          )
        }
        emptyMessage="No crosses in this scope."
      />

      <CrossBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        variables={variables ?? []}
        canCreatePredefined={canCreatePredefined('setup')}
        authorId={user?.id ?? 'unknown'}
        onCreate={(cross) => {
          setLocalCrosses((prev) => [...prev, cross])
          setBuilderOpen(false)
          toast.success(`Cross ${cross.code} created.`)
        }}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Builder
   -------------------------------------------------------------------------- */

function CrossBuilderDialog({
  open,
  onOpenChange,
  variables,
  canCreatePredefined,
  authorId,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  variables: readonly Variable[]
  canCreatePredefined: boolean
  authorId: string
  onCreate: (c: Cross) => void
}) {
  const [dimA, setDimA] = useState<DimensionCode>('HC')
  const [memberA, setMemberA] = useState('')
  const [dimB, setDimB] = useState<DimensionCode>('HF')
  const [memberB, setMemberB] = useState('')
  const [label, setLabel] = useState('')
  // UC026: a regular user's cross is custom and country-scoped. Only an admin
  // with create-predefined may author one visible to everyone.
  const [scope, setScope] = useState<'predefined' | 'custom'>(
    canCreatePredefined ? 'predefined' : 'custom',
  )
  const [countries, setCountries] = useState<string[]>([])

  const membersFor = (dim: DimensionCode) => variables.filter((v) => v.dimension === dim)

  const members: Dimensions = {}
  if (memberA) members[dimA] = memberA
  if (memberB) members[dimB] = memberB
  const derivedCode = Object.keys(members).length >= 2 ? crossCode(members) : ''

  const valid =
    derivedCode !== '' &&
    dimA !== dimB &&
    label.trim() !== '' &&
    (scope === 'predefined' || countries.length > 0)

  function submit() {
    if (!valid) return
    onCreate({
      id: `x-local-${Date.now()}`,
      code: derivedCode,
      label: label.trim(),
      members,
      scope,
      countryScope: scope === 'custom' ? countries : [],
      createdBy: authorId,
    })
    setLabel('')
    setMemberA('')
    setMemberB('')
    setCountries([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New cross</DialogTitle>
          <DialogDescription>
            Pick a category from two different classifications. The standard notation is derived
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['First classification', dimA, setDimA, memberA, setMemberA],
                ['Second classification', dimB, setDimB, memberB, setMemberB],
              ] as const
            ).map(([title, dim, setDim, member, setMember], i) => (
              <div key={i} className="space-y-2 rounded border border-who-border p-3">
                <Label className="text-[length:var(--text-meta)]">{title}</Label>
                <Select
                  value={dim}
                  onValueChange={(v) => {
                    setDim(v as DimensionCode)
                    setMember('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map((d) => (
                      <SelectItem key={d} value={d} disabled={d === (i === 0 ? dimB : dimA)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={member} onValueChange={setMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {membersFor(dim).map((v) => (
                      <SelectItem key={v.code} value={v.code}>
                        <span className="font-mono">{v.code}</span>
                        <span className="ml-2 text-who-text-muted">{v.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {derivedCode ? (
            <p className="rounded border border-who-primary-blue/40 bg-who-page-bg px-3 py-2 text-[length:var(--text-body-sm)]">
              Notation:{' '}
              <span className="font-mono font-semibold text-who-heading">{derivedCode}</span>
            </p>
          ) : null}

          <div>
            <Label htmlFor="cross-label" className="text-[length:var(--text-meta)]">
              Description
            </Label>
            <Input
              id="cross-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Curative care financed out-of-pocket"
              className="mt-1 h-9"
            />
          </div>

          <div>
            <Label className="text-[length:var(--text-meta)]">Availability</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as typeof scope)}
              disabled={!canCreatePredefined}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="predefined" disabled={!canCreatePredefined}>
                  Predefined — available to all users, all countries
                </SelectItem>
                <SelectItem value="custom">Custom — specific countries only</SelectItem>
              </SelectContent>
            </Select>
            {!canCreatePredefined ? (
              <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                Only administrators can create crosses visible to all users.
              </p>
            ) : null}
          </div>

          {scope === 'custom' ? (
            <div>
              <Label className="text-[length:var(--text-meta)]">Countries</Label>
              <div className="mt-1">
                <CountryPicker selected={countries} onChange={setCountries} />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={submit}>
            Create cross
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
