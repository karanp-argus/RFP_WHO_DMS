/**
 * Metadata fields (UC027) and the SharePoint MET-files link (UC028).
 *
 * UC027 is specific about the layout: "DMS displays 2 different areas for three
 * different modalities of metadata fields: Observations, Old DMS Formulas" with
 * "three types of metadata fields depending on the type of data accepted: Free
 * text fields, Date fields, List of Values (drop down selection list)".
 *
 * So the two areas are separate sections and the type is shown on every field.
 */

import { useMemo, useState } from 'react'
import { CalendarDays, ExternalLink, FileSpreadsheet, List, Plus, Type, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadingState } from '@/components/common/EmptyState'
import type { MetadataFieldDef } from '@/domain/types'
import { useMetadataFields } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'

const TYPE_ICON = {
  text: Type,
  date: CalendarDays,
  lov: List,
} as const

const TYPE_LABEL = {
  text: 'Free text',
  date: 'Date',
  lov: 'List of values',
} as const

export function MetadataTab() {
  const { data: fields, isLoading } = useMetadataFields()
  const { canEdit } = usePermissions()
  const editable = canEdit('setup')
  const [lovEdits, setLovEdits] = useState<Record<string, string[]>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})

  const effective = useMemo(
    () =>
      (fields ?? []).map((f) => ({
        ...f,
        lov: lovEdits[f.code] ?? f.lov,
      })),
    [fields, lovEdits],
  )

  const observation = effective.filter((f) => f.area === 'observation')
  const legacy = effective.filter((f) => f.area === 'old-dms-formula')

  if (isLoading) return <LoadingState label="Loading metadata fields from xMart…" />

  function addValue(field: MetadataFieldDef) {
    const v = (draft[field.code] ?? '').trim()
    if (!v) return
    const current = lovEdits[field.code] ?? field.lov ?? []
    if (current.includes(v)) {
      toast.error(`"${v}" is already in the list.`)
      return
    }
    setLovEdits((p) => ({ ...p, [field.code]: [...current, v] }))
    setDraft((p) => ({ ...p, [field.code]: '' }))
  }

  return (
    <div className="space-y-6">
      {/* UC027 area 1 — observation metadata */}
      <section>
        <h4 className="text-[length:var(--text-body-lg)] font-semibold text-who-heading">
          Observation metadata
        </h4>
        <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
          Every observation carries these fields. An observation is valid with metadata and no
          value — a country may explain why a figure is missing without providing one.
        </p>

        <div className="mt-3 space-y-2">
          {observation.map((f) => {
            const Icon = TYPE_ICON[f.type]
            return (
              <div key={f.code} className="rounded border border-who-border bg-who-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="size-4 shrink-0 text-who-icon" aria-hidden />
                  <span className="text-[length:var(--text-body-sm)] font-medium text-who-heading">
                    {f.label}
                  </span>
                  <span className="font-mono text-[length:var(--text-meta)] text-who-text-muted">
                    {f.code}
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    {TYPE_LABEL[f.type]}
                  </Badge>
                </div>

                {f.type === 'lov' ? (
                  <div className="mt-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(f.lov ?? []).map((v) => (
                        <Badge key={v} variant="outline" className="gap-1 pr-1">
                          {v}
                          {editable ? (
                            <button
                              type="button"
                              aria-label={`Remove ${v}`}
                              onClick={() =>
                                setLovEdits((p) => ({
                                  ...p,
                                  [f.code]: (p[f.code] ?? f.lov ?? []).filter((x) => x !== v),
                                }))
                              }
                              className="rounded-full p-0.5 hover:bg-who-fail/15 hover:text-who-fail"
                            >
                              <X className="size-3" />
                            </button>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                    {editable ? (
                      <div className="mt-2 flex max-w-sm gap-2">
                        <Input
                          value={draft[f.code] ?? ''}
                          onChange={(e) => setDraft((p) => ({ ...p, [f.code]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addValue(f)
                            }
                          }}
                          placeholder="Add an allowed value"
                          className="h-8"
                        />
                        <Button size="sm" variant="outline" onClick={() => addValue(f)}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* UC027 area 2 — old DMS formulas */}
      <section>
        <h4 className="text-[length:var(--text-body-lg)] font-semibold text-who-heading">
          Old DMS formulas
        </h4>
        <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
          A dedicated metadata field holds the formula migrated from the legacy system (UC060), so
          the original definition stays visible against each observation.
        </p>

        <div className="mt-3 space-y-2">
          {legacy.map((f) => {
            const Icon = TYPE_ICON[f.type]
            return (
              <div
                key={f.code}
                className="flex flex-wrap items-center gap-2 rounded border border-who-border bg-who-surface p-3"
              >
                <Icon className="size-4 shrink-0 text-who-icon" aria-hidden />
                <span className="text-[length:var(--text-body-sm)] font-medium text-who-heading">
                  {f.label}
                </span>
                <span className="font-mono text-[length:var(--text-meta)] text-who-text-muted">
                  {f.code}
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {TYPE_LABEL[f.type]}
                </Badge>
              </div>
            )
          })}
        </div>
      </section>

      {/* UC028 — MET files in SharePoint */}
      <section>
        <h4 className="text-[length:var(--text-body-lg)] font-semibold text-who-heading">
          Metadata files (MET)
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-who-border bg-who-page-bg px-4 py-3">
          {/* --who-sidebar is a surface token; as an icon colour it measured
              1.44:1 in dark. See CLAUDE.md's content-vs-surface table. */}
          <FileSpreadsheet className="size-5 shrink-0 text-who-primary-blue" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--text-body-sm)] text-who-text">
              xMart writes MET files (.xlsx) to a SharePoint folder. Open them there to work in
              Excel as usual.
            </p>
            <p className="mt-0.5 text-[length:var(--text-meta)] text-who-text-muted">
              Prototype: the link is illustrative and does not resolve.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('gap-1.5 shrink-0')}
                onClick={() =>
                  toast.info('In the real system this opens the SharePoint MET folder.')
                }
              >
                <ExternalLink className="size-3.5" />
                Open SharePoint
              </Button>
            </TooltipTrigger>
            <TooltipContent>UC028 — access MET files stored by xMart</TooltipContent>
          </Tooltip>
        </div>
      </section>
    </div>
  )
}
