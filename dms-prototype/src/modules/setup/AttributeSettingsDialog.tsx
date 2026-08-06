/**
 * Attribute settings for one Setup component.
 *
 * Covers three use cases on one surface, because they are all "configure the
 * shape of this component" rather than "edit its data":
 *
 *   UC016 — edit the list of values behind any drop-down attribute
 *   UC018 — create a new attribute, typed free text / date / list of values
 *   UC022 — flag an attribute as available for grouping and filtering
 *
 * UC020's rule is respected on the LOV editor: a value in use cannot simply be
 * removed. We cannot prove usage without a full scan, so the UI states the
 * constraint rather than pretending to have checked.
 */

import { useState } from 'react'
import { Plus, Tags, Trash2, X } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { AttributeDef } from '@/domain/types'
import { useSetupStore, type SetupComponentId } from '@/stores/setupStore'

const ATTRIBUTE_TYPES: AttributeDef['type'][] = ['text', 'number', 'date', 'lov', 'boolean']

export function AttributeSettingsDialog({
  open,
  onOpenChange,
  component,
  label,
  attributes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  component: SetupComponentId
  label: string
  attributes: readonly AttributeDef[]
}) {
  const setLov = useSetupStore((s) => s.setLov)
  const setGroupable = useSetupStore((s) => s.setGroupable)
  const addAttribute = useSetupStore((s) => s.addAttribute)
  const resetColumns = useSetupStore((s) => s.resetColumns)

  const [newValue, setNewValue] = useState<Record<string, string>>({})
  const [newAttr, setNewAttr] = useState({ label: '', type: 'text' as AttributeDef['type'] })

  const lovAttributes = attributes.filter((a) => a.type === 'lov')

  function addLovValue(attr: AttributeDef) {
    const v = (newValue[attr.key] ?? '').trim()
    if (!v) return
    const current = attr.lov ?? []
    if (current.includes(v)) {
      toast.error(`"${v}" is already in the list.`)
      return
    }
    setLov(component, attr.key, [...current, v])
    setNewValue((p) => ({ ...p, [attr.key]: '' }))
  }

  function removeLovValue(attr: AttributeDef, value: string) {
    setLov(component, attr.key, (attr.lov ?? []).filter((v) => v !== value))
  }

  function createAttribute() {
    const label = newAttr.label.trim()
    if (!label) return
    // Derive a stable key in the SHOUTY_CASE style of the xMart columns, so a
    // user-added attribute is indistinguishable in the grid.
    const key = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (attributes.some((a) => a.key === key)) {
      toast.error(`An attribute named "${label}" already exists.`)
      return
    }
    addAttribute(component, {
      key,
      label,
      type: newAttr.type,
      ...(newAttr.type === 'lov' ? { lov: [] } : {}),
      groupable: false,
      required: false,
      order: 1000 + attributes.length,
      isSystem: false,
    })
    setNewAttr({ label: '', type: 'text' })
    toast.success(`Attribute "${label}" added to ${label}.`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{label} — attributes</DialogTitle>
          <DialogDescription>
            Configure which attributes can be used for grouping, edit their lists of values, and
            add new attributes. Changes apply to all users.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-5">
            {/* UC022 — grouping flags */}
            <section>
              <h4 className="flex items-center gap-1.5 text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                <Tags className="size-4" aria-hidden />
                Available for grouping and filtering
              </h4>
              <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                A flagged attribute appears as a grouping option wherever users select countries —
                Workbooks, Reports and Quality Checks.
              </p>
              <div className="mt-3 space-y-1.5">
                {attributes.map((a) => (
                  <label
                    key={a.key}
                    className="flex items-center justify-between gap-3 rounded border border-who-border px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[length:var(--text-body-sm)] text-who-text">
                        {a.label}
                      </span>
                      <span className="block font-mono text-[length:var(--text-meta)] text-who-text-muted">
                        {a.key} · {a.type}
                        {a.isSystem ? ' · from xMart' : ' · added in DMS'}
                      </span>
                    </span>
                    <Switch
                      checked={a.groupable}
                      onCheckedChange={(v) => setGroupable(component, a.key, v)}
                      aria-label={`Allow grouping by ${a.label}`}
                    />
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            {/* UC016 — lists of values */}
            <section>
              <h4 className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                Lists of values
              </h4>
              <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                Values already used by an observation cannot be deleted — they can be removed from
                the list so nobody selects them again, without affecting existing records.
              </p>
              {lovAttributes.length === 0 ? (
                <p className="mt-3 text-[length:var(--text-body-sm)] text-who-text-muted">
                  This component has no drop-down attributes yet.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {lovAttributes.map((attr) => (
                    <div key={attr.key} className="rounded border border-who-border p-3">
                      <p className="text-[length:var(--text-body-sm)] font-medium text-who-heading">
                        {attr.label}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(attr.lov ?? []).length === 0 ? (
                          <span className="text-[length:var(--text-meta)] text-who-hint">
                            No values defined.
                          </span>
                        ) : (
                          (attr.lov ?? []).map((v) => (
                            <Badge key={v} variant="secondary" className="gap-1 pr-1">
                              {v}
                              <button
                                type="button"
                                aria-label={`Remove ${v}`}
                                onClick={() => removeLovValue(attr, v)}
                                className="rounded-full p-0.5 hover:bg-who-fail/15 hover:text-who-fail"
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={newValue[attr.key] ?? ''}
                          onChange={(e) =>
                            setNewValue((p) => ({ ...p, [attr.key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addLovValue(attr)
                            }
                          }}
                          placeholder="Add a value"
                          className="h-8"
                        />
                        <Button size="sm" variant="outline" onClick={() => addLovValue(attr)}>
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* UC018 — new attribute */}
            <section>
              <h4 className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                Add an attribute
              </h4>
              <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                The new attribute becomes available to administrators and regular users alike.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <Label htmlFor="attr-label" className="text-[length:var(--text-meta)]">
                    Name
                  </Label>
                  <Input
                    id="attr-label"
                    value={newAttr.label}
                    onChange={(e) => setNewAttr((p) => ({ ...p, label: e.target.value }))}
                    placeholder="e.g. Reporting priority"
                    className="mt-1 h-9"
                  />
                </div>
                <div className="w-40">
                  <Label htmlFor="attr-type" className="text-[length:var(--text-meta)]">
                    Type
                  </Label>
                  <Select
                    value={newAttr.type}
                    onValueChange={(v) =>
                      setNewAttr((p) => ({ ...p, type: v as AttributeDef['type'] }))
                    }
                  >
                    <SelectTrigger id="attr-type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTRIBUTE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t === 'lov' ? 'List of values' : t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createAttribute} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetColumns(component)
              toast.success('Column order and visibility reset.')
            }}
            className="gap-1.5 text-who-text-muted"
          >
            <Trash2 className="size-3.5" />
            Reset column layout
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
