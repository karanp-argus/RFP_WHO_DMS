/**
 * The UC008 role-permission matrix.
 *
 * *"As an administrator, I need to be able to edit the permissions assigned to
 * each role for each module, so that I can decide the level of access."* The
 * six levels are enumerated in `domain/permissions.ts`; this file is about
 * which of them are **meaningful per module**, what each one actually means
 * there, and what the matrix is not allowed to say.
 *
 * Two rules do real work here:
 *
 * 1. **`no-access` is never offered.** UC007: *"whenever a Regular user does
 *    not have access to edit a specific function, they will have view and
 *    export access to the corresponding module."* A matrix that can express
 *    "no access" for a regular user can express something the FR forbids, so
 *    the editor does not offer it and `matrixProblems` reports it if persisted
 *    state ever contains it.
 * 2. **Levels are filtered per module.** "Edit Selected Countries" on the Users
 *    module is not a stricter permission, it is a meaningless one — user
 *    administration has no country axis. Offering it would invite an
 *    administrator to set a value that nothing reads.
 */

import {
  MODULES,
  PERMISSION_LABELS,
  canCreatePredefined,
  canEdit,
  canView,
  type ModuleId,
  type PermissionLevel,
  type PermissionMatrix,
} from '@/domain/permissions'

export interface ModulePermissionMeta {
  id: ModuleId
  label: string
  /** What the module governs, one line, for the matrix's left column. */
  summary: string
  /** Levels offered for this module, weakest first. */
  levels: readonly PermissionLevel[]
}

/**
 * Per-module level sets.
 *
 * `country-customized` appears wherever a user may hold *their own* version of
 * something scoped to the countries they work on — a custom report (UC037), a
 * private QC rule (UC050), their own notification subscriptions (UC059), and a
 * per-country formula override (UC029). `edit-selected-countries` appears only
 * on Workbooks, which is the one module where the thing being edited *is* a
 * country's data. `create-predefined` appears wherever an artefact can be
 * published to everybody.
 */
export const MODULE_PERMISSION_META: readonly ModulePermissionMeta[] = [
  {
    id: 'home',
    label: 'Home',
    summary: 'The dashboard and the module tiles.',
    // Nothing on Home is authored, so View is the only honest value. It is
    // still listed so the matrix covers every module rather than hiding one.
    levels: ['view'],
  },
  {
    id: 'users',
    label: 'Users',
    summary: 'Grant access, assign roles, enable and disable accounts.',
    levels: ['view', 'edit', 'create-predefined'],
  },
  {
    id: 'setup',
    label: 'Setup',
    summary: 'Countries, currencies, classifications, crosses, metadata, formulas.',
    levels: ['view', 'edit', 'country-customized', 'create-predefined'],
  },
  {
    id: 'workbooks',
    label: 'Workbooks',
    summary: 'View and edit observations, metadata and publishing status.',
    levels: ['view', 'edit-selected-countries', 'edit'],
  },
  {
    id: 'reports',
    label: 'Reports',
    summary: 'Run reports, build custom ones, publish predefined ones.',
    levels: ['view', 'country-customized', 'create-predefined'],
  },
  {
    id: 'quality',
    label: 'Quality Checks',
    summary: 'Run checks, author rules, configure thresholds.',
    levels: ['view', 'country-customized', 'create-predefined'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    summary: 'Subscribe to events and configure what raises a notification.',
    levels: ['view', 'country-customized', 'create-predefined'],
  },
  {
    id: 'integration',
    label: 'xMart Integration',
    summary: 'Sync status, the API call log and the data retrieval API.',
    levels: ['view', 'edit'],
  },
]

const META_BY_MODULE = new Map(MODULE_PERMISSION_META.map((m) => [m.id, m]))

export function moduleMeta(module: ModuleId): ModulePermissionMeta {
  const meta = META_BY_MODULE.get(module)
  // Every ModuleId has an entry — the completeness test locks that in — so this
  // is a type-narrowing fallback rather than a case anybody should hit.
  if (!meta) throw new Error(`No permission metadata for module "${module}"`)
  return meta
}

export function allowedLevels(module: ModuleId): readonly PermissionLevel[] {
  return moduleMeta(module).levels
}

/**
 * What a level means *on this module*, in the reader's terms.
 *
 * Generic descriptions ("can edit") are what make a permission screen useless:
 * the administrator setting them needs to know that Edit on Reports means
 * building private reports while Create Predefined means publishing to
 * everyone, and no amount of staring at the level name conveys that.
 */
export function describeLevel(module: ModuleId, level: PermissionLevel): string {
  if (level === 'no-access') {
    return 'Not available to regular users — UC007 guarantees view and export on every module.'
  }
  if (level === 'view') {
    return 'View and export only. No changes.'
  }

  switch (module) {
    case 'users':
      return level === 'create-predefined'
        ? 'Grant access, change roles, and enable or disable accounts.'
        : 'Edit user profiles. Roles and account status stay with administrators.'
    case 'setup':
      return level === 'create-predefined'
        ? 'Edit configuration and publish predefined crosses and formulas to everyone.'
        : level === 'country-customized'
          ? 'Add per-country formula overrides (UC029) without changing the shared definition.'
          : 'Edit configuration values and lists of values.'
    case 'workbooks':
      return level === 'edit'
        ? 'Edit any country’s workbook.'
        : 'Edit workbooks for assigned countries only; the rest stay read-only.'
    case 'reports':
      return level === 'create-predefined'
        ? 'Build reports and publish them as predefined, visible to everyone.'
        : 'Build custom reports, private to the author (UC037).'
    case 'quality':
      return level === 'create-predefined'
        ? 'Author shared rules and configure the UC054 thresholds.'
        : 'Author private rules and run checks on assigned countries (UC050).'
    case 'notifications':
      return level === 'create-predefined'
        ? 'Configure the subscriptions everybody receives (UC059).'
        : 'Subscribe to events for assigned countries.'
    case 'integration':
      return 'Trigger a pull from xMart and push DMS changes back (UC045/UC046).'
    case 'home':
      return 'View the dashboard.'
  }
}

/* ==========================================================================
   Validation
   ========================================================================== */

export interface MatrixProblem {
  module: ModuleId
  problem: string
}

export function matrixProblems(matrix: PermissionMatrix): MatrixProblem[] {
  const out: MatrixProblem[] = []
  for (const module of MODULES) {
    const level = matrix[module]
    if (level === 'no-access') {
      out.push({
        module,
        problem:
          'UC007 guarantees a regular user view and export access on every module, so No Access cannot be set.',
      })
      continue
    }
    if (!allowedLevels(module).includes(level)) {
      out.push({
        module,
        problem: `“${PERMISSION_LABELS[level]}” does not apply to ${moduleMeta(module).label}.`,
      })
    }
  }
  return out
}

/* ==========================================================================
   Diffs and previews
   ========================================================================== */

export interface MatrixChange {
  module: ModuleId
  from: PermissionLevel
  to: PermissionLevel
}

export function matrixDiff(before: PermissionMatrix, after: PermissionMatrix): MatrixChange[] {
  return MODULES.filter((m) => before[m] !== after[m]).map((m) => ({
    module: m,
    from: before[m],
    to: after[m],
  }))
}

export interface CapabilityRow {
  module: ModuleId
  label: string
  level: PermissionLevel
  canView: boolean
  canEdit: boolean
  canCreatePredefined: boolean
}

/**
 * The matrix restated as what the role can actually do.
 *
 * This is the panel that makes the UC008 demo land: the administrator changes
 * a level and immediately sees "Reports: create predefined ✗", which is the
 * same computation `usePermissions` performs — so the preview cannot claim
 * something the app then contradicts.
 */
export function capabilityPreview(matrix: PermissionMatrix): CapabilityRow[] {
  return MODULE_PERMISSION_META.map((meta) => ({
    module: meta.id,
    label: meta.label,
    level: matrix[meta.id],
    canView: canView(matrix[meta.id]),
    canEdit: canEdit(matrix[meta.id]),
    canCreatePredefined: canCreatePredefined(matrix[meta.id]),
  }))
}
