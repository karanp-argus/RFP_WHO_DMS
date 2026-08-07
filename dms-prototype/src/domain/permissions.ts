/**
 * Roles and module permissions.
 *
 * The RFP defines exactly two roles (HLR6, UC007): Regular User and
 * Administrator. Administrators implicitly hold every regular-user right —
 * FR UC007: "there will be no functionality that will be possible for a
 * regular user and not for an administrator".
 *
 * The permission *levels* are the six values enumerated in UC008:
 *   No Access | View | Edit | Edit Selected Countries | Country Customized |
 *   Create Predefined
 *
 * The defaults below are the ones the FR specifies for regular users. Phase 7
 * makes them editable — see `domain/users/matrix.ts` for which levels apply to
 * which module and why, and `RolePermissionsPage` for the editor.
 */

export const ROLES = ['administrator', 'regular'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSION_LEVELS = [
  'no-access',
  'view',
  'edit',
  'edit-selected-countries',
  'country-customized',
  'create-predefined',
] as const
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number]

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  'no-access': 'No Access',
  view: 'View',
  edit: 'Edit',
  'edit-selected-countries': 'Edit Selected Countries',
  'country-customized': 'Country Customized',
  'create-predefined': 'Create Predefined',
}

export const MODULES = [
  'home',
  'users',
  'setup',
  'workbooks',
  'reports',
  'quality',
  'notifications',
  'integration',
] as const
export type ModuleId = (typeof MODULES)[number]

export type PermissionMatrix = Record<ModuleId, PermissionLevel>

/**
 * Regular-user defaults, per UC008's table:
 *   Users, Setup            → View
 *   Workbooks               → Edit selected countries
 *   Reports, Quality Checks,
 *   Notifications           → Customized
 *
 * Note UC007: "Whenever a Regular user does not have access to edit a specific
 * function, they will have view and export access to the corresponding module."
 * So 'no-access' is never a regular-user default.
 */
export const DEFAULT_REGULAR_PERMISSIONS: PermissionMatrix = {
  home: 'view',
  users: 'view',
  setup: 'view',
  workbooks: 'edit-selected-countries',
  reports: 'country-customized',
  quality: 'country-customized',
  notifications: 'country-customized',
  integration: 'view',
}

export const ADMIN_PERMISSIONS: PermissionMatrix = {
  // View, not create-predefined: nothing on Home is authored, so any level
  // above View would be state nothing reads. `domain/users/matrix.ts` offers
  // only View for this module and validates against it, and an administrator
  // matrix that failed its own validator would be the wrong thing to ship.
  home: 'view',
  users: 'create-predefined',
  setup: 'create-predefined',
  workbooks: 'edit',
  reports: 'create-predefined',
  quality: 'create-predefined',
  notifications: 'create-predefined',
  integration: 'edit',
}

/** Levels that permit mutation, in ascending order of scope. */
const EDIT_LEVELS: PermissionLevel[] = [
  'edit',
  'edit-selected-countries',
  'country-customized',
  'create-predefined',
]

export function canView(level: PermissionLevel): boolean {
  return level !== 'no-access'
}

export function canEdit(level: PermissionLevel): boolean {
  return EDIT_LEVELS.includes(level)
}

/** Only this level may author artefacts visible to all users (UC036, UC049). */
export function canCreatePredefined(level: PermissionLevel): boolean {
  return level === 'create-predefined'
}
