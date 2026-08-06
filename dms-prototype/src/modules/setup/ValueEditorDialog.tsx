/**
 * Create or edit one component value (UC017, UC019).
 *
 * The form is generated from the component's attribute definitions, so a runtime
 * attribute added via UC018 immediately gets a field here with no extra code.
 * UC017 notes some fields will be mandatory — `AttributeDef.required` drives that,
 * and the id attribute is locked once a value exists because it is the key xMart
 * matches on.
 */

import { useEffect, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { AttributeDef } from '@/domain/types'

export function ValueEditorDialog({
  open,
  onOpenChange,
  title,
  attributes,
  initial,
  idKey,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  attributes: readonly AttributeDef[]
  initial?: Record<string, unknown>
  idKey: string
  onSave: (values: Record<string, unknown>) => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const isEdit = initial != null

  // Reset whenever the dialog opens for a different record.
  useEffect(() => {
    if (open) setValues(initial ? { ...initial } : {})
  }, [open, initial])

  function set(key: string, v: unknown) {
    setValues((p) => ({ ...p, [key]: v }))
  }

  function submit() {
    const missing = attributes
      .filter((a) => a.required)
      .filter((a) => {
        const v = values[a.key]
        return v == null || v === ''
      })
    if (missing.length > 0) {
      toast.error(`Required: ${missing.map((a) => a.label).join(', ')}`)
      return
    }
    onSave(values)
    toast.success(isEdit ? 'Changes saved and queued for xMart.' : 'Value created.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {/* UC046: changes are pushed back to xMart, which owns the data. */}
            Saved changes are sent to xMart with your user id recorded as the author.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {attributes.map((attr) => {
              const locked = isEdit && attr.key === idKey
              const v = values[attr.key]
              const id = `field-${attr.key}`

              return (
                <div key={attr.key} className={attr.type === 'text' ? '' : ''}>
                  <Label htmlFor={id} className="text-[length:var(--text-meta)]">
                    {attr.label}
                    {attr.required ? <span className="ml-0.5 text-who-fail">*</span> : null}
                    {locked ? (
                      <span className="ml-1 text-who-text-muted">(key — not editable)</span>
                    ) : null}
                  </Label>

                  {attr.type === 'boolean' ? (
                    <div className="mt-2">
                      <Switch
                        id={id}
                        checked={v === true || v === 'true'}
                        onCheckedChange={(c) => set(attr.key, c)}
                      />
                    </div>
                  ) : attr.type === 'lov' ? (
                    <Select
                      value={v == null ? '' : String(v)}
                      onValueChange={(nv) => set(attr.key, nv)}
                      disabled={locked}
                    >
                      <SelectTrigger id={id} className="mt-1">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(attr.lov ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      type={attr.type === 'number' ? 'number' : attr.type === 'date' ? 'date' : 'text'}
                      value={v == null ? '' : String(v)}
                      onChange={(e) =>
                        set(
                          attr.key,
                          attr.type === 'number'
                            ? e.target.value === ''
                              ? ''
                              : Number(e.target.value)
                            : e.target.value,
                        )
                      }
                      disabled={locked}
                      className="mt-1 h-9"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{isEdit ? 'Save changes' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
