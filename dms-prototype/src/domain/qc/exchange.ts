/**
 * UC051 (bonus) — export and import the rule set as a spreadsheet.
 *
 * The point of the use case is that a rule set is *portable*: it can be edited
 * outside DMS, reviewed by someone who does not have an account, and moved
 * between environments. So the exported shape is deliberately flat and readable
 * — one rule per row, lists as semicolon-separated text — rather than an
 * embedded JSON blob in a cell, which would round-trip perfectly and be
 * unreadable and uneditable by the person the use case is for.
 *
 * Import is validated rather than trusted. A row naming a rule type that does
 * not exist, or a threshold that is not a number, comes back as an error
 * against its row number instead of silently producing a rule that never fires.
 */

import { QC_COMPARISONS, QC_GROUP_ATTRIBUTES, QC_NORMALISATIONS, QC_RULE_TYPES } from './ruleTypes'
import type {
  QcComparison,
  QcGroupAttribute,
  QcNormalisation,
  QcRule,
  QcRuleType,
} from './ruleTypes'

/** Column order of the exported sheet. Import matches on these names. */
export const QC_RULE_HEADERS = [
  'Rule ID',
  'Name',
  'Description',
  'Type',
  'Origin',
  'Enabled',
  'Variables',
  'Left codes',
  'Right codes',
  'Group by',
  'Normalisation',
  'Comparison',
  'Warn at',
  'Fail at',
  'Excluded countries',
  'Year from',
  'Year to',
  'Visibility',
  'Created by',
] as const

const LIST_SEPARATOR = '; '

function joinList(values: readonly string[]): string {
  return values.join(LIST_SEPARATOR)
}

function splitList(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ruleToRow(rule: QcRule): Record<string, string | number> {
  return {
    'Rule ID': rule.id,
    Name: rule.name,
    Description: rule.description,
    Type: rule.type,
    Origin: rule.origin,
    Enabled: rule.isEnabled ? 'Yes' : 'No',
    Variables: joinList(rule.variables),
    'Left codes': joinList(rule.leftCodes),
    'Right codes': joinList(rule.rightCodes),
    'Group by': rule.groupBy ?? '',
    Normalisation: rule.normalise,
    Comparison: rule.comparison,
    // Blank rather than 0 when the rule uses the global UC054 pair: a 0 here
    // would re-import as "warn at zero", which fires on everything.
    'Warn at': rule.thresholds ? rule.thresholds.warnAt : '',
    'Fail at': rule.thresholds ? rule.thresholds.failAt : '',
    'Excluded countries': joinList(rule.excludedCountries),
    'Year from': rule.yearFrom ?? '',
    'Year to': rule.yearTo ?? '',
    Visibility: rule.visibility,
    'Created by': rule.createdBy,
  }
}

export interface RuleImportResult {
  rules: QcRule[]
  errors: string[]
}

/**
 * Rows back into rules.
 *
 * Imported rules always land as `origin: 'admin'` regardless of what the file
 * says. An import must not be able to mint a rule that claims to have shipped
 * with the product — that badge is the whole of UC053's distinguishability
 * requirement, and a spreadsheet anyone can edit is not a source of authority
 * for it.
 */
export function rowsToRules(
  rows: readonly Record<string, string>[],
  importedBy: string,
  nowUtc: string,
): RuleImportResult {
  const rules: QcRule[] = []
  const errors: string[] = []

  rows.forEach((row, i) => {
    const line = i + 2 // +1 for the header, +1 for 1-based rows
    const id = (row['Rule ID'] ?? '').trim()
    const name = (row['Name'] ?? '').trim()
    const type = (row['Type'] ?? '').trim() as QcRuleType

    if (!id) {
      errors.push(`Row ${line}: no rule ID.`)
      return
    }
    if (!name) {
      errors.push(`Row ${line}: no name.`)
      return
    }
    if (!QC_RULE_TYPES.includes(type)) {
      errors.push(`Row ${line}: "${row['Type']}" is not a rule type.`)
      return
    }

    const warnRaw = (row['Warn at'] ?? '').trim()
    const failRaw = (row['Fail at'] ?? '').trim()
    let thresholds: QcRule['thresholds'] = null
    if (warnRaw !== '' || failRaw !== '') {
      const warnAt = Number(warnRaw)
      const failAt = Number(failRaw)
      if (!Number.isFinite(warnAt) || !Number.isFinite(failAt)) {
        errors.push(`Row ${line}: thresholds must both be numbers, or both blank.`)
        return
      }
      thresholds = { warnAt, failAt }
    }

    const comparisonRaw = (row['Comparison'] ?? 'outside').trim() as QcComparison
    const comparison = QC_COMPARISONS.includes(comparisonRaw) ? comparisonRaw : 'outside'

    const normaliseRaw = (row['Normalisation'] ?? 'share-of-che').trim() as QcNormalisation
    const normalise = QC_NORMALISATIONS.includes(normaliseRaw) ? normaliseRaw : 'share-of-che'

    const groupRaw = (row['Group by'] ?? '').trim() as QcGroupAttribute
    const groupBy = QC_GROUP_ATTRIBUTES.includes(groupRaw) ? groupRaw : null

    const yearFrom = Number((row['Year from'] ?? '').trim())
    const yearTo = Number((row['Year to'] ?? '').trim())

    rules.push({
      id,
      name,
      description: (row['Description'] ?? '').trim(),
      type,
      origin: 'admin',
      createdBy: importedBy,
      createdUtc: nowUtc,
      updatedUtc: nowUtc,
      isEnabled: !/^no$|^false$|^0$/i.test((row['Enabled'] ?? 'Yes').trim()),
      variables: splitList(row['Variables'] ?? ''),
      excludedCountries: splitList(row['Excluded countries'] ?? ''),
      thresholds,
      comparison,
      groupBy,
      normalise,
      leftCodes: splitList(row['Left codes'] ?? ''),
      rightCodes: splitList(row['Right codes'] ?? ''),
      yearFrom: Number.isFinite(yearFrom) && yearFrom > 0 ? yearFrom : null,
      yearTo: Number.isFinite(yearTo) && yearTo > 0 ? yearTo : null,
      visibility: (row['Visibility'] ?? '').trim() === 'private' ? 'private' : 'shared',
    })
  })

  if (rows.length > 0 && rules.length === 0 && errors.length === 0) {
    errors.push('No rules could be read from the file.')
  }
  return { rules, errors }
}
