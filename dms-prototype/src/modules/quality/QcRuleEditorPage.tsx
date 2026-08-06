/**
 * Building or editing one quality check rule.
 *
 * UC050 for a regular user's own rule, UC049 (bonus) for an administrator
 * authoring one everybody gets, and UC048 for the country exclusions — which is
 * the part of this screen with a stated acceptance criterion attached:
 * *"exclude specific countries from a QC rule ... and reset the exclusions in
 * one click"*. Both halves are here, and the reset is one button, not a
 * multi-select the user has to empty by hand.
 *
 * The form changes shape with the rule type, because the types genuinely do not
 * share parameters — a reconciliation rule has two sides and no variable list,
 * an outlier rule needs a peer group and a normalisation, and a continuity rule
 * needs neither. Showing every field for every type and disabling most of them
 * would make the common case harder to read in order to make the code simpler.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, FilterX, Play, RotateCcw, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CountryPicker } from '@/components/common/CountryPicker'
import { VariablePicker } from '@/components/common/VariablePicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { DEMO_NOW, YEARS } from '@/domain/constants'
import {
  PREDEFINED_BY_ID,
  QC_COMPARISONS,
  QC_COMPARISON_LABELS,
  QC_DEVIATION_UNITS,
  QC_GROUP_ATTRIBUTES,
  QC_GROUP_ATTRIBUTE_LABELS,
  QC_NORMALISATIONS,
  QC_NORMALISATION_LABELS,
  QC_RULE_TYPES,
  QC_RULE_TYPE_DESCRIPTIONS,
  QC_RULE_TYPE_LABELS,
  emptyRule,
  thresholdsFor,
  type QcComparison,
  type QcGroupAttribute,
  type QcNormalisation,
  type QcRule,
  type QcRuleType,
} from '@/domain/qc'
import { usePermissions } from '@/hooks/usePermissions'
import { useQcRun } from '@/hooks/useQcRun'
import { useVariables } from '@/hooks/useSetupData'
import { allRules, useQcStore, useQcThresholds } from '@/stores/qcStore'
import { QC_DEMO_COUNTRIES, QC_DEMO_SCOPE_LABEL } from '@/data/qc/demoScope'
import { RuleOriginBadge } from './QcBadges'

/** Which fields a rule type actually uses. */
function shapeOf(type: QcRuleType) {
  return {
    variables: type !== 'table-consistency',
    /** Category rules name the *parent*; the runner checks each of its children. */
    variablesAreParents: type === 'category-consistency',
    sides: type === 'table-consistency',
    group: type === 'group-outlier',
    /** Structural rules have nothing to compare a direction against. */
    comparison: !['new-observation', 'disappeared-observation', 'missing-observation'].includes(
      type,
    ),
  }
}

export function QcRuleEditorPage() {
  const { ruleId = '' } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, canEdit, canCreatePredefined } = usePermissions()

  const ruleEdits = useQcStore((s) => s.ruleEdits)
  const removedRuleIds = useQcStore((s) => s.removedRuleIds)
  const saveRule = useQcStore((s) => s.saveRule)
  const resetRule = useQcStore((s) => s.resetRule)
  const thresholds = useQcThresholds()
  const { data: variables } = useVariables()
  const { run, isRunning } = useQcRun()

  const isNew = ruleId === 'new'
  const existing = useMemo(
    () => allRules(ruleEdits, removedRuleIds).find((r) => r.id === ruleId),
    [ruleEdits, removedRuleIds, ruleId],
  )

  const [draft, setDraft] = useState<QcRule | null>(null)

  useEffect(() => {
    if (isNew) {
      const now = new Date(DEMO_NOW.getTime()).toISOString()
      setDraft({
        ...emptyRule(`qc-custom-${Date.now().toString(36)}`, 'yoy-relative', user?.email ?? 'unknown', now),
        // UC049 — an administrator authors rules everyone gets; UC050 — a
        // regular user's rule starts private to them.
        origin: isAdmin ? 'admin' : 'user',
        visibility: isAdmin ? 'shared' : 'private',
      })
      return
    }
    if (existing) setDraft({ ...existing })
  }, [isNew, existing, user?.email, isAdmin])

  if (!draft) {
    return (
      <>
        <PageHeader title="Quality check rule" />
        <p className="text-[length:var(--text-body-sm)] text-who-text-muted">
          That rule no longer exists.{' '}
          <Link to="/quality-checks" className="underline">
            Back to Quality Checks
          </Link>
        </p>
      </>
    )
  }

  /**
   * UC050 gives a regular user their own rules; it does not give them the
   * delivered set or another author's. So the right to edit is per-rule:
   * an administrator, or the person who wrote it.
   */
  const editable =
    canEdit('quality') &&
    (canCreatePredefined('quality') || isNew || draft.createdBy === user?.email)

  const shape = shapeOf(draft.type)
  const pair = thresholdsFor(draft, thresholds)
  const isDelivered = PREDEFINED_BY_ID.has(draft.id)
  const isModified = isDelivered && ruleEdits[draft.id] != null
  const set = <K extends keyof QcRule>(key: K, value: QcRule[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const problems: string[] = []
  if (!draft.name.trim()) problems.push('The rule needs a name.')
  if (shape.variables && draft.variables.length === 0) {
    problems.push('Choose at least one variable for the rule to look at.')
  }
  if (shape.sides && (draft.leftCodes.length === 0 || draft.rightCodes.length === 0)) {
    problems.push('A reconciliation rule needs codes on both sides.')
  }
  if (shape.group && !draft.groupBy) problems.push('Choose the attribute that forms the peer group.')

  return (
    <>
      <PageHeader
        title={isNew ? 'New quality check rule' : draft.name || 'Quality check rule'}
        description={QC_RULE_TYPE_DESCRIPTIONS[draft.type]}
        actions={
          <>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/quality-checks?tab=rules">
                <ArrowLeft className="size-3.5" />
                All rules
              </Link>
            </Button>
            {editable && isModified ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  resetRule(draft.id)
                  const delivered = PREDEFINED_BY_ID.get(draft.id)
                  if (delivered) setDraft({ ...delivered })
                  toast.success('Reset to the delivered definition.')
                }}
              >
                <RotateCcw className="size-3.5" />
                Reset to delivered
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isRunning || problems.length > 0}
              onClick={async () => {
                const outcome = await run([{ ...draft, isEnabled: true }], {
                  kind: 'countries',
                  label: `${draft.name || 'Draft rule'} · ${QC_DEMO_SCOPE_LABEL}`,
                  countries: [...QC_DEMO_COUNTRIES],
                  yearFrom: YEARS[0]!,
                  yearTo: YEARS[YEARS.length - 1]!,
                })
                if (outcome) {
                  toast.success(
                    `${outcome.summary.errors} failures, ${outcome.summary.warnings} warnings.`,
                  )
                  navigate(`/quality-checks/reports/${outcome.summary.id}`)
                }
              }}
            >
              <Play className="size-3.5" />
              Test run
            </Button>
            {editable ? (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={problems.length > 0}
                onClick={() => {
                  saveRule(draft)
                  toast.success(`Saved "${draft.name}".`)
                  navigate('/quality-checks?tab=rules')
                }}
              >
                <Save className="size-3.5" />
                Save rule
              </Button>
            ) : null}
          </>
        }
      />

      {!editable ? (
        <p className="mb-4 rounded border border-who-border bg-who-page-bg px-3 py-2 text-[length:var(--text-meta)] text-who-text-muted">
          Read-only. You can test-run this rule and export it. Editing a delivered or shared rule
          is an administrator action (UC007) — duplicate it to build your own version.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- identity ---------------------------------------------------- */}
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                What this rule is
              </h3>
              <RuleOriginBadge origin={draft.origin} />
              {isDelivered ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline">Delivered</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Shipped with DMS. Edits are kept locally and can be reset.
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            <div>
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={draft.name}
                disabled={!editable}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Out-of-pocket payment jumps year on year"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="rule-description">Why it exists</Label>
              <Textarea
                id="rule-description"
                value={draft.description}
                disabled={!editable}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                placeholder="What this rule catches, and what a reviewer should do about a finding."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="rule-type">What it checks</Label>
              <Select
                value={draft.type}
                disabled={!editable || isDelivered}
                onValueChange={(v) => {
                  const type = v as QcRuleType
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          type,
                          // Parameters that do not survive a type change are
                          // cleared rather than carried invisibly.
                          groupBy: type === 'group-outlier' ? (d.groupBy ?? 'GRP_WB_INCOME') : null,
                          thresholds: null,
                        }
                      : d,
                  )
                }}
              >
                <SelectTrigger id="rule-type" className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QC_RULE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {QC_RULE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isDelivered ? (
                <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                  A delivered rule keeps its category — duplicate it to build something different.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[length:var(--text-body-sm)]">
                <Switch
                  checked={draft.isEnabled}
                  disabled={!editable}
                  onCheckedChange={(v) => set('isEnabled', v)}
                />
                Enabled
              </label>

              {/* UC050 — an administrator can share a rule with everyone. */}
              <label className="flex items-center gap-2 text-[length:var(--text-body-sm)]">
                <Switch
                  checked={draft.visibility === 'shared'}
                  disabled={!editable || !isAdmin}
                  onCheckedChange={(v) => set('visibility', v ? 'shared' : 'private')}
                />
                Shared with all users
                {!isAdmin ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-who-text-muted underline decoration-dotted">
                        ?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Your rules stay private to you. An administrator can promote one to the
                      shared set (UC050).
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* --- what it looks at -------------------------------------------- */}
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <h3 className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
              What it looks at
            </h3>

            {shape.variables ? (
              <div>
                <Label>
                  {shape.variablesAreParents ? 'Parent categories' : 'Variables'}
                  <span className="ml-2 font-normal text-who-text-muted">
                    {shape.variablesAreParents
                      ? 'each child is checked against its own history'
                      : `${draft.variables.length} selected`}
                  </span>
                </Label>
                <div className="mt-1">
                  <VariablePicker
                    selected={draft.variables}
                    onChange={(next) => set('variables', next)}
                    variables={variables ?? []}
                  />
                </div>
              </div>
            ) : null}

            {shape.sides ? (
              <>
                <div>
                  <Label>Left side</Label>
                  <div className="mt-1">
                    <VariablePicker
                      selected={draft.leftCodes}
                      onChange={(next) => set('leftCodes', next)}
                      variables={variables ?? []}
                    />
                  </div>
                </div>
                <div>
                  <Label>Right side — should reconcile with the left</Label>
                  <div className="mt-1">
                    <VariablePicker
                      selected={draft.rightCodes}
                      onChange={(next) => set('rightCodes', next)}
                      variables={variables ?? []}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {shape.group ? (
              <>
                <div>
                  <Label htmlFor="rule-group">Peer group</Label>
                  <Select
                    value={draft.groupBy ?? ''}
                    disabled={!editable}
                    onValueChange={(v) => set('groupBy', v as QcGroupAttribute)}
                  >
                    <SelectTrigger id="rule-group" className="mt-1 w-full">
                      <SelectValue placeholder="Choose a country attribute" />
                    </SelectTrigger>
                    <SelectContent>
                      {QC_GROUP_ATTRIBUTES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {QC_GROUP_ATTRIBUTE_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                    Attributes flagged groupable in Setup (UC022). A group needs at least five
                    countries in scope before it is judged.
                  </p>
                </div>

                <div>
                  <Label htmlFor="rule-normalise">Compared as</Label>
                  <Select
                    value={draft.normalise}
                    disabled={!editable}
                    onValueChange={(v) => set('normalise', v as QcNormalisation)}
                  >
                    <SelectTrigger id="rule-normalise" className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QC_NORMALISATIONS.map((n) => (
                        <SelectItem key={n} value={n}>
                          {QC_NORMALISATION_LABELS[n]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="rule-year-from" className="text-[length:var(--text-meta)]">
                  From year
                </Label>
                <Select
                  value={draft.yearFrom == null ? 'any' : String(draft.yearFrom)}
                  disabled={!editable}
                  onValueChange={(v) => set('yearFrom', v === 'any' ? null : Number(v))}
                >
                  <SelectTrigger id="rule-year-from" className="mt-1 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rule-year-to" className="text-[length:var(--text-meta)]">
                  To year
                </Label>
                <Select
                  value={draft.yearTo == null ? 'any' : String(draft.yearTo)}
                  disabled={!editable}
                  onValueChange={(v) => set('yearTo', v === 'any' ? null : Number(v))}
                >
                  <SelectTrigger id="rule-year-to" className="mt-1 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="pb-2 text-[length:var(--text-meta)] text-who-text-muted">
                Narrowed further by whatever the run asks for.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* --- when it fires ------------------------------------------------ */}
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <h3 className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
              When it fires
            </h3>

            {shape.comparison ? (
              <div>
                <Label htmlFor="rule-comparison">Direction</Label>
                <Select
                  value={draft.comparison}
                  disabled={!editable}
                  onValueChange={(v) => set('comparison', v as QcComparison)}
                >
                  <SelectTrigger id="rule-comparison" className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QC_COMPARISONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {QC_COMPARISON_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="rule-warn">Warn at</Label>
                <Input
                  id="rule-warn"
                  value={draft.thresholds?.warnAt ?? pair.warnAt}
                  disabled={!editable}
                  inputMode="decimal"
                  onChange={(e) =>
                    set('thresholds', {
                      warnAt: Number(e.target.value) || 0,
                      failAt: draft.thresholds?.failAt ?? pair.failAt,
                    })
                  }
                  className="mt-1 w-28 text-right font-mono tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="rule-fail">Fail at</Label>
                <Input
                  id="rule-fail"
                  value={draft.thresholds?.failAt ?? pair.failAt}
                  disabled={!editable}
                  inputMode="decimal"
                  onChange={(e) =>
                    set('thresholds', {
                      warnAt: draft.thresholds?.warnAt ?? pair.warnAt,
                      failAt: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-28 text-right font-mono tabular-nums"
                />
              </div>
              <p className="pb-2 text-[length:var(--text-meta)] text-who-text-muted">
                {QC_DEVIATION_UNITS[draft.type].hint}
              </p>
            </div>

            <p className="text-[length:var(--text-meta)] text-who-text-muted">
              {draft.thresholds ? (
                <>
                  This rule uses its own thresholds.{' '}
                  {editable ? (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => set('thresholds', null)}
                    >
                      Follow the global settings instead
                    </button>
                  ) : null}
                </>
              ) : (
                <>Following the global thresholds for this category (UC054).</>
              )}
            </p>
          </CardContent>
        </Card>

        {/* --- UC048 exclusions --------------------------------------------- */}
        <Card>
          <CardContent className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                Countries this rule skips
              </h3>
              {draft.excludedCountries.length > 0 && editable ? (
                // UC048's stated acceptance: one click, not an emptied picker.
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    set('excludedCountries', [])
                    toast.success('Exclusions cleared.')
                  }}
                >
                  <FilterX className="size-3.5" />
                  Clear all ({draft.excludedCountries.length})
                </Button>
              ) : null}
            </div>

            <p className="text-[length:var(--text-meta)] text-who-text-muted">
              A rule that is known not to apply to a country should not report on it. Excluded
              countries are never checked, and the report says how many were skipped so an
              exclusion is never mistaken for a clean pass (UC048).
            </p>

            <CountryPicker
              selected={draft.excludedCountries}
              onChange={(next) => set('excludedCountries', next)}
              placeholder="No countries excluded — the rule applies everywhere"
              ariaLabel="Countries excluded from this rule"
            />
          </CardContent>
        </Card>
      </div>

      {problems.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 rounded border border-who-warn/50 bg-who-warn/5 px-6 py-3 text-[length:var(--text-body-sm)] text-who-text">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
