/**
 * Countries data reporting follow-up (UC023).
 *
 * "As a regular user, I need DMS to have a functionality where I can track the
 * communications with countries when asking for their information, the feedback
 * they provide, due dates and some notifications based on dates created for me."
 *
 * Note this is a *regular user* use case, not an administrator one — so it is
 * editable at the `edit` level rather than gated behind admin rights, and the
 * overdue tile is what feeds the UC023 notifications and the dashboard.
 */

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarClock, Mail, MessageSquare, Phone, Plus } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/common/DataTable'
import { LoadingState } from '@/components/common/EmptyState'
import { CountryPicker } from '@/components/common/CountryPicker'
import { downloadCsv } from '@/lib/exporters'
import { DEMO_NOW } from '@/domain/constants'
import type { ReportingContact } from '@/domain/types'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { useReportingContacts } from '@/hooks/useSetupData'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<ReportingContact['status'], string> = {
  received: 'border-who-pass/50 text-who-pass',
  awaiting: 'border-who-primary-blue/50 text-who-heading',
  overdue: 'border-who-fail/50 text-who-fail',
  'not-requested': 'border-who-border text-who-text-muted',
}

const STATUS_LABEL: Record<ReportingContact['status'], string> = {
  received: 'Received',
  awaiting: 'Awaiting response',
  overdue: 'Overdue',
  'not-requested': 'Not requested',
}

const CHANNEL_ICON = { email: Mail, call: Phone, meeting: MessageSquare } as const

/** Days between an ISO date and DEMO_NOW. Negative = in the past. */
function daysFromNow(iso: string): number | null {
  if (!iso) return null
  return Math.round((Date.parse(iso) - DEMO_NOW.getTime()) / 86_400_000)
}

export function ReportingFollowUpTab() {
  const { data: contacts, isLoading } = useReportingContacts()
  const { canEdit, user } = usePermissions()
  const editable = canEdit('setup')
  const [local, setLocal] = useState<ReportingContact[]>([])
  const [logOpen, setLogOpen] = useState(false)

  const all = useMemo(() => [...(contacts ?? []), ...local], [contacts, local])

  const counts = useMemo(() => {
    const c = { received: 0, awaiting: 0, overdue: 0, 'not-requested': 0 }
    for (const r of all) c[r.status]++
    return c
  }, [all])

  const columns = useMemo<ColumnDef<ReportingContact, unknown>[]>(
    () => [
      {
        id: 'country',
        accessorFn: (r) => COUNTRY_BY_ISO3.get(r.iso3)?.NAME_SHORT_EN ?? r.iso3,
        header: 'Country',
        cell: ({ row }) => {
          const c = COUNTRY_BY_ISO3.get(row.original.iso3)
          return (
            <span>
              <span className="block text-[length:var(--text-body-sm)] font-medium text-who-heading">
                {c?.NAME_SHORT_EN ?? row.original.iso3}
              </span>
              <span className="block font-mono text-[length:var(--text-meta)] text-who-text-muted">
                {row.original.iso3} · {c?.GRP_WHO_REGION}
              </span>
            </span>
          )
        },
      },
      {
        id: 'focalPoint',
        accessorFn: (r) => COUNTRY_BY_ISO3.get(r.iso3)?.FOCAL_POINT_NAME ?? '',
        header: 'Focal point',
        cell: ({ row }) => {
          const c = COUNTRY_BY_ISO3.get(row.original.iso3)
          return (
            <span>
              <span className="block text-[length:var(--text-body-sm)]">
                {c?.FOCAL_POINT_NAME}
              </span>
              <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                {c?.FOCAL_POINT_EMAIL}
              </span>
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant="outline" className={STATUS_STYLE[row.original.status]}>
            {STATUS_LABEL[row.original.status]}
          </Badge>
        ),
      },
      {
        id: 'requestSentOn',
        accessorKey: 'requestSentOn',
        header: 'Requested',
        cell: ({ getValue }) => {
          const v = String(getValue() ?? '')
          return v ? (
            <span className="tabular-nums">{v}</span>
          ) : (
            <span className="text-who-hint">—</span>
          )
        },
      },
      {
        id: 'responseDueOn',
        accessorKey: 'responseDueOn',
        header: 'Due',
        cell: ({ row }) => {
          const due = row.original.responseDueOn
          if (!due) return <span className="text-who-hint">—</span>
          const d = daysFromNow(due)
          const overdue = row.original.status === 'overdue'
          const soon = d != null && d >= 0 && d <= 21 && row.original.status === 'awaiting'
          return (
            <span
              className={cn(
                'tabular-nums',
                overdue && 'font-medium text-who-fail',
                soon && 'font-medium text-who-warn',
              )}
            >
              {due}
              {/* A relative hint is what makes this a follow-up tool rather than
                  a date list — UC023 asks for notifications based on due dates. */}
              {d != null ? (
                <span className="ml-1.5 text-[length:var(--text-meta)]">
                  {d < 0 ? `${Math.abs(d)}d late` : d === 0 ? 'today' : `in ${d}d`}
                </span>
              ) : null}
            </span>
          )
        },
      },
      {
        id: 'channel',
        accessorKey: 'channel',
        header: 'Channel',
        cell: ({ row }) => {
          const Icon = CHANNEL_ICON[row.original.channel]
          return (
            <span className="flex items-center gap-1.5 capitalize">
              <Icon className="size-3.5 text-who-icon" aria-hidden />
              {row.original.channel}
            </span>
          )
        },
      },
      {
        id: 'note',
        accessorKey: 'note',
        header: 'Latest note',
        cell: ({ getValue }) => (
          <span className="block max-w-[28rem] truncate text-who-text-muted">
            {String(getValue() ?? '')}
          </span>
        ),
      },
    ],
    [],
  )

  if (isLoading) return <LoadingState label="Loading reporting status from xMart…" />

  return (
    <div className="space-y-4">
      {/* Status tiles — overdue is the actionable one. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['overdue', 'Overdue', 'border-who-fail/40'],
            ['awaiting', 'Awaiting response', 'border-who-primary-blue/40'],
            ['received', 'Received', 'border-who-pass/40'],
            ['not-requested', 'Not requested', 'border-who-border'],
          ] as const
        ).map(([key, label, border]) => (
          <div key={key} className={cn('rounded border bg-who-surface px-4 py-3', border)}>
            <p className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
              {label}
            </p>
            <p className="mt-1 text-[length:var(--text-h4)] font-bold tabular-nums text-who-heading">
              {counts[key]}
            </p>
          </div>
        ))}
      </div>

      <DataTable<ReportingContact>
        data={all}
        columns={columns}
        searchPlaceholder="Search countries and notes"
        getRowId={(r) => r.id}
        pageSize={20}
        onExport={(rows) =>
          downloadCsv(
            rows.map((r) => ({
              ISO3: r.iso3,
              COUNTRY: COUNTRY_BY_ISO3.get(r.iso3)?.NAME_SHORT_EN ?? '',
              FOCAL_POINT: COUNTRY_BY_ISO3.get(r.iso3)?.FOCAL_POINT_NAME ?? '',
              STATUS: r.status,
              REQUESTED: r.requestSentOn,
              DUE: r.responseDueOn,
              RESPONDED: r.respondedOn ?? '',
              CHANNEL: r.channel,
              NOTE: r.note,
              LOGGED_BY: r.loggedBy,
            })),
            [
              'ISO3',
              'COUNTRY',
              'FOCAL_POINT',
              'STATUS',
              'REQUESTED',
              'DUE',
              'RESPONDED',
              'CHANNEL',
              'NOTE',
              'LOGGED_BY',
            ],
            'reporting-followup',
          )
        }
        toolbar={
          editable ? (
            <Button size="sm" onClick={() => setLogOpen(true)} className="gap-1.5">
              <Plus className="size-3.5" />
              Log communication
            </Button>
          ) : null
        }
      />

      <LogCommunicationDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        authorEmail={user?.email ?? 'unknown'}
        onSave={(c) => {
          setLocal((prev) => [c, ...prev])
          setLogOpen(false)
          toast.success(
            `Logged for ${COUNTRY_BY_ISO3.get(c.iso3)?.NAME_SHORT_EN ?? c.iso3}.`,
          )
        }}
      />
    </div>
  )
}

function LogCommunicationDialog({
  open,
  onOpenChange,
  authorEmail,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  authorEmail: string
  onSave: (c: ReportingContact) => void
}) {
  const [countries, setCountries] = useState<string[]>([])
  const [channel, setChannel] = useState<ReportingContact['channel']>('email')
  const [status, setStatus] = useState<ReportingContact['status']>('awaiting')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const iso3 = countries[0]

  const today = DEMO_NOW.toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a communication</DialogTitle>
          <DialogDescription>
            Record a request, reminder or response. Due dates drive the follow-up notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[length:var(--text-meta)]">Country</Label>
            <div className="mt-1">
              <CountryPicker selected={countries} onChange={setCountries} max={1} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[length:var(--text-meta)]">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[length:var(--text-meta)]">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awaiting">Awaiting response</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="not-requested">Not requested</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rc-due" className="text-[length:var(--text-meta)]">
                Response due
              </Label>
              <Input
                id="rc-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rc-note" className="text-[length:var(--text-meta)]">
              Note
            </Label>
            <Textarea
              id="rc-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What was discussed or requested"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!iso3 || note.trim() === ''}
            onClick={() =>
              iso3 &&
              onSave({
                id: `rc-local-${Date.now()}`,
                iso3,
                requestSentOn: today,
                responseDueOn: due,
                respondedOn: status === 'received' ? today : null,
                status,
                channel,
                note: note.trim(),
                loggedBy: authorEmail,
              })
            }
            className="gap-1.5"
          >
            <CalendarClock className="size-3.5" />
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
