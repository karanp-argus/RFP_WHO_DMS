/**
 * The rule list (UC047).
 *
 * Grouped by what a rule *does* rather than who wrote it, because that is how
 * someone looks for one — "is there something that checks year-on-year growth"
 * is the question, not "is there something an administrator wrote". Authorship
 * is carried on every row by the origin badge instead, which is UC053's actual
 * requirement and is stronger for being visible in a list sorted by something
 * else entirely.
 *
 * *"My custom rules"* is the one exception and it comes first, because a rule
 * you wrote yesterday is the one you are most likely to be coming back to.
 */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Copy,
  Download,
  FilterX,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/common/EmptyState'
import { DEMO_NOW } from '@/domain/constants'
import {
  PREDEFINED_BY_ID,
  QC_RULE_HEADERS,
  QC_RULE_TYPE_GROUPS,
  QC_RULE_TYPE_LABELS,
  emptyRule,
  rowsToRules,
  ruleToRow,
  thresholdsFor,
  type QcRule,
} from '@/domain/qc'
import { usePermissions } from '@/hooks/usePermissions'
import { useQcRun } from '@/hooks/useQcRun'
import {
  allRules,
  isRuleModified,
  useQcStore,
  useQcThresholds,
  visibleRules,
} from '@/stores/qcStore'
import { downloadXlsx, readSpreadsheet } from '@/lib/exporters'
import { cn } from '@/lib/utils'
import { QcRunDialog } from '../QcRunDialog'
import { RuleOriginBadge } from '../QcBadges'

/* --------------------------------------------------------------------------
   One row
   -------------------------------------------------------------------------- */

function RuleRow({
  rule,
  canEditThis,
  canCreate,
  modified,
  onToggle,
  onEdit,
  onDuplicate,
  onReset,
  onRemove,
  onClearExclusions,
  onRun,
}: {
  rule: QcRule
  /** May change *this* rule — its own author, or an administrator. */
  canEditThis: boolean
  /** May create rules at all, which is what a duplicate needs. */
  canCreate: boolean
  modified: boolean
  onToggle: (isEnabled: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onReset: () => void
  onRemove: () => void
  onClearExclusions: () => void
  onRun: () => void
}) {
  const thresholds = useQcThresholds()
  const pair = thresholdsFor(rule, thresholds)
  const isDelivered = PREDEFINED_BY_ID.has(rule.id)

  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-3 border-b border-who-border/60 px-3 py-3 last:border-b-0',
        'hover:bg-who-accent-subtle',
        !rule.isEnabled && 'opacity-60',
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="pt-0.5">
            <Switch
              checked={rule.isEnabled}
              disabled={!canEditThis}
              onCheckedChange={onToggle}
              aria-label={`${rule.isEnabled ? 'Disable' : 'Enable'} ${rule.name}`}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {rule.isEnabled ? 'Included in a run' : 'Skipped by every run'}
        </TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
            {rule.name}
          </span>
          <RuleOriginBadge origin={rule.origin} />
          {rule.visibility === 'private' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-who-text-muted">
                  Private
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Visible to its author and to administrators only (UC050).
              </TooltipContent>
            </Tooltip>
          ) : null}
          {modified ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-who-warn/50 text-who-warn">
                  Edited
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Changed from the definition DMS shipped with. Reset restores it.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <p className="mt-1 max-w-3xl text-[length:var(--text-meta)] text-who-text-muted">
          {rule.description}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-meta)] text-who-text-muted">
          <span>
            Warn at <span className="font-mono text-who-text">{pair.warnAt.toLocaleString()}</span> ·
            fail at <span className="font-mono text-who-text">{pair.failAt.toLocaleString()}</span>
            {rule.thresholds ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1 cursor-help underline decoration-dotted">own</span>
                </TooltipTrigger>
                <TooltipContent>
                  This rule overrides the global thresholds set on the Thresholds tab.
                </TooltipContent>
              </Tooltip>
            ) : null}
          </span>

          {rule.variables.length > 0 ? (
            <span className="font-mono">
              {rule.variables.slice(0, 4).join(', ')}
              {rule.variables.length > 4 ? ` +${rule.variables.length - 4}` : ''}
            </span>
          ) : null}

          {rule.leftCodes.length > 0 ? (
            <span className="font-mono">
              {rule.leftCodes.join(' + ')} vs {rule.rightCodes.join(' + ')}
            </span>
          ) : null}

          {rule.yearFrom || rule.yearTo ? (
            <span>
              {rule.yearFrom ?? '…'}–{rule.yearTo ?? '…'}
            </span>
          ) : null}

          {/* UC048 — exclusions are visible on the row, with the one-click
              clear the use case asks for right beside them. */}
          {rule.excludedCountries.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!canEditThis}
                  onClick={onClearExclusions}
                  className="inline-flex items-center gap-1 rounded border border-who-border px-1.5 py-0.5 hover:border-who-fail hover:text-who-fail disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FilterX className="size-3" />
                  {rule.excludedCountries.length} excluded
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {rule.excludedCountries.join(', ')}
                {canEditThis ? ' — click to clear all exclusions (UC048).' : ''}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={onRun}>
              <Play className="size-3.5" />
              <span className="sr-only">Run this rule</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run only this rule</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}>
              <Pencil className="size-3.5" />
              <span className="sr-only">{canEditThis ? 'Edit' : 'View'} rule</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{canEditThis ? 'Edit' : 'View'} this rule</TooltipContent>
        </Tooltip>

        {canCreate ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={onDuplicate}>
                <Copy className="size-3.5" />
                <span className="sr-only">Duplicate rule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate as a custom rule</TooltipContent>
          </Tooltip>
        ) : null}

        {canEditThis && isDelivered && modified ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={onReset}>
                <RotateCcw className="size-3.5" />
                <span className="sr-only">Reset rule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to the delivered definition</TooltipContent>
          </Tooltip>
        ) : null}

        {canEditThis && !isDelivered ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-who-fail"
                onClick={onRemove}
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete rule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete this rule</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </li>
  )
}

/* --------------------------------------------------------------------------
   The tab
   -------------------------------------------------------------------------- */

export function RulesTab() {
  const navigate = useNavigate()
  const { user, isAdmin, canEdit, canCreatePredefined } = usePermissions()
  /**
   * Two different rights, and conflating them was a real bug the browser
   * harness caught.
   *
   *  · **Creating rules** is a regular-user right — UC050 is written from a
   *    regular user's point of view and gives them custom rules private to
   *    themselves. So `canCreate` follows the ordinary edit permission.
   *  · **Changing a rule everybody else runs** — a delivered one, or one an
   *    administrator shared — is not. `canCreatePredefined` is the level that
   *    means "may author something everyone gets", and it is the one that
   *    governs delivered and shared rules.
   */
  const canCreate = canEdit('quality')
  const canEditShared = canCreatePredefined('quality')
  const canEditRule = (rule: QcRule) => canEditShared || rule.createdBy === user?.email

  const ruleEdits = useQcStore((s) => s.ruleEdits)
  const removedRuleIds = useQcStore((s) => s.removedRuleIds)
  const saveRule = useQcStore((s) => s.saveRule)
  const removeRule = useQcStore((s) => s.removeRule)
  const resetRule = useQcStore((s) => s.resetRule)
  const toggleRule = useQcStore((s) => s.toggleRule)
  const clearExclusions = useQcStore((s) => s.clearExclusions)
  const importRules = useQcStore((s) => s.importRules)

  const { run, isRunning } = useQcRun()
  const [runOpen, setRunOpen] = useState(false)
  const [runOnly, setRunOnly] = useState<QcRule | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const rules = useMemo(() => allRules(ruleEdits, removedRuleIds), [ruleEdits, removedRuleIds])
  const visible = useMemo(
    () => visibleRules(rules, user?.email, isAdmin),
    [rules, user?.email, isAdmin],
  )

  const mine = visible.filter((r) => r.origin === 'user' && r.createdBy === user?.email)
  const enabledCount = visible.filter((r) => r.isEnabled).length

  /** The rules a run will use: one rule if the row's play button asked, else all. */
  const rulesToRun = runOnly ? [runOnly] : visible

  async function handleImport(file: File) {
    const parsed = await readSpreadsheet(file, ['Rule ID', 'Name', 'Type'])
    if (parsed.errors.length > 0) {
      toast.error('That file could not be read.', { description: parsed.errors.join(' ') })
      return
    }
    const { rules: imported, errors } = rowsToRules(
      parsed.rows,
      user?.email ?? 'unknown',
      new Date(DEMO_NOW.getTime()).toISOString(),
    )
    if (imported.length > 0) importRules(imported)
    toast[errors.length > 0 ? 'warning' : 'success'](
      `Imported ${imported.length} rule${imported.length === 1 ? '' : 's'}.`,
      {
        description:
          errors.length > 0
            ? `${errors.length} row${errors.length === 1 ? '' : 's'} skipped: ${errors.slice(0, 3).join(' ')}`
            : 'Imported rules are marked as administrator-authored — a spreadsheet cannot mint a developer rule.',
      },
    )
  }

  return (
    <div className="space-y-4">
      {/* --- toolbar ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="gap-1.5"
          disabled={isRunning || enabledCount === 0}
          onClick={() => {
            setRunOnly(null)
            setRunOpen(true)
          }}
        >
          <Play className="size-3.5" />
          Run quality checks
        </Button>
        <Badge variant="secondary">
          {enabledCount} of {visible.length} rules enabled
        </Badge>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* UC051 (bonus) — the rule set is portable. */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              downloadXlsx(
                [{ name: 'QC rules', headers: [...QC_RULE_HEADERS], rows: visible.map(ruleToRow) }],
                'qc-rules',
              )
              toast.success(`Exported ${visible.length} rules.`)
            }}
          >
            <Download className="size-3.5" />
            Export rules
          </Button>

          {canEditShared ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImport(file)
                  e.target.value = ''
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="size-3.5" />
                Import rules
              </Button>
            </>
          ) : null}

          {/* UC050 — a regular user creates rules too; theirs are private. */}
          {canCreate ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/quality-checks/rules/new')}
            >
              <Plus className="size-3.5" />
              New rule
            </Button>
          ) : null}
        </div>
      </div>

      {!canEditShared ? (
        <p className="rounded border border-who-border bg-who-page-bg px-3 py-2 text-[length:var(--text-meta)] text-who-text-muted">
          You can view, run and export every rule, and create your own — they stay private to you
          (UC050). Editing the delivered rules and the shared ones is an administrator action
          (UC007).
        </p>
      ) : null}

      {/* --- my rules first ------------------------------------------------ */}
      {mine.length > 0 ? (
        <RuleGroup
          label="My custom rules"
          hint="Private to you until you share them. Administrators can see them (UC050)."
          rules={mine}
        >
          {(rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              canEditThis={canEditRule(rule)}
              canCreate={canCreate}
              modified={isRuleModified(rule, ruleEdits)}
              onToggle={(v) => toggleRule(rule.id, v)}
              onEdit={() => navigate(`/quality-checks/rules/${rule.id}`)}
              onDuplicate={() => duplicate(rule)}
              onReset={() => resetRule(rule.id)}
              onRemove={() => {
                removeRule(rule.id)
                toast.success(`Deleted "${rule.name}".`)
              }}
              onClearExclusions={() => {
                clearExclusions(rule.id)
                toast.success('Country exclusions cleared.')
              }}
              onRun={() => {
                setRunOnly(rule)
                setRunOpen(true)
              }}
            />
          )}
        </RuleGroup>
      ) : null}

      {/* --- grouped by what the rule does --------------------------------- */}
      {QC_RULE_TYPE_GROUPS.map((group) => {
        const inGroup = visible.filter(
          (r) => group.types.includes(r.type) && !mine.some((m) => m.id === r.id),
        )
        if (inGroup.length === 0) return null
        return (
          <RuleGroup
            key={group.label}
            label={group.label}
            hint={group.types.map((t) => QC_RULE_TYPE_LABELS[t]).join(' · ')}
            rules={inGroup}
          >
            {(rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                canEditThis={canEditRule(rule)}
                canCreate={canCreate}
                modified={isRuleModified(rule, ruleEdits)}
                onToggle={(v) => toggleRule(rule.id, v)}
                onEdit={() => navigate(`/quality-checks/rules/${rule.id}`)}
                onDuplicate={() => duplicate(rule)}
                onReset={() => {
                  resetRule(rule.id)
                  toast.success(`"${rule.name}" reset to the delivered definition.`)
                }}
                onRemove={() => removeRule(rule.id)}
                onClearExclusions={() => {
                  clearExclusions(rule.id)
                  toast.success('Country exclusions cleared.')
                }}
                onRun={() => {
                  setRunOnly(rule)
                  setRunOpen(true)
                }}
              />
            )}
          </RuleGroup>
        )
      })}

      {visible.length === 0 ? (
        <EmptyState
          message="No quality check rules"
          hint="The delivered rules have all been removed. Import a rule set or create one."
        />
      ) : null}

      <QcRunDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        ruleCount={rulesToRun.filter((r) => r.isEnabled).length}
        isRunning={isRunning}
        onRun={async (scope) => {
          setRunOpen(false)
          const outcome = await run(rulesToRun, scope)
          if (!outcome) return
          toast.success(
            `${outcome.summary.errors} failures, ${outcome.summary.warnings} warnings across ${outcome.summary.countriesWithFindings} countries.`,
            { description: `${outcome.summary.observationsChecked.toLocaleString()} values checked.` },
          )
          navigate(`/quality-checks/reports/${outcome.summary.id}`)
        }}
      />
    </div>
  )

  function duplicate(rule: QcRule) {
    const now = new Date(DEMO_NOW.getTime()).toISOString()
    const copy: QcRule = {
      ...rule,
      ...emptyRule(`qc-custom-${rule.id}-${Object.keys(ruleEdits).length + 1}`, rule.type, user?.email ?? 'unknown', now),
      // Keep the parameters, replace the identity: a duplicate is a starting
      // point, and it must never inherit the delivered rule's authority.
      name: `${rule.name} (copy)`,
      description: rule.description,
      variables: [...rule.variables],
      leftCodes: [...rule.leftCodes],
      rightCodes: [...rule.rightCodes],
      excludedCountries: [...rule.excludedCountries],
      thresholds: rule.thresholds ? { ...rule.thresholds } : null,
      comparison: rule.comparison,
      groupBy: rule.groupBy,
      normalise: rule.normalise,
      yearFrom: rule.yearFrom,
      yearTo: rule.yearTo,
    }
    saveRule(copy)
    toast.success(`Duplicated as "${copy.name}".`)
    navigate(`/quality-checks/rules/${copy.id}`)
  }
}

function RuleGroup({
  label,
  hint,
  rules,
  children,
}: {
  label: string
  hint?: string
  rules: readonly QcRule[]
  children: (rule: QcRule) => React.ReactNode
}) {
  return (
    <section className="rounded border border-who-border bg-who-surface">
      <header className="border-b border-who-border px-3 py-2">
        <h3 className="text-[length:var(--text-body-sm)] font-semibold tracking-wide text-who-heading uppercase">
          {label}
          <span className="ml-2 font-normal text-who-text-muted normal-case">{rules.length}</span>
        </h3>
        {hint ? (
          <p className="mt-0.5 text-[length:var(--text-meta)] text-who-text-muted">{hint}</p>
        ) : null}
      </header>
      <ul className="list-none">{rules.map(children)}</ul>
    </section>
  )
}
