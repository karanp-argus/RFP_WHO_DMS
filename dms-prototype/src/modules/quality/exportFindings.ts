/**
 * UC055 — *"download the report"*.
 *
 * Two formats, and the difference between them is deliberate rather than a
 * checkbox. The **.csv** is one flat sheet of findings, which is what gets
 * pasted into an email or loaded into whatever the reviewer already uses. The
 * **.xlsx** carries three sheets — the run itself, the per-rule accounting, and
 * the findings — because a spreadsheet that arrives without the scope and
 * thresholds it was produced under is a list of numbers nobody can reproduce.
 *
 * The rule sheet includes rules that found **nothing**. A report that only
 * lists what fired cannot be told apart from one where half the rules failed to
 * run, and the second is the case worth catching.
 */

import { downloadCsv, downloadXlsx, type SheetSpec } from '@/lib/exporters'
import {
  QC_RULE_ORIGIN_LABELS,
  QC_RULE_TYPE_LABELS,
  QC_SEVERITY_LABELS,
  type QcFinding,
  type QcRuleStat,
  type QcRunSummary,
} from '@/domain/qc'

const FINDING_HEADERS = [
  'Status',
  'Country code',
  'Country',
  'Year',
  'Variable code',
  'Variable',
  'Rule',
  'Rule type',
  'Rule origin',
  'Expected',
  'Actual',
  'Deviation',
  'Unit',
  'What was found',
  'Observation note',
  'Observation key',
] as const

function findingRow(f: QcFinding): Record<string, unknown> {
  return {
    Status: QC_SEVERITY_LABELS[f.severity],
    'Country code': f.iso3,
    Country: f.countryName,
    Year: f.year,
    'Variable code': f.code,
    Variable: f.variableLabel,
    Rule: f.ruleName,
    'Rule type': QC_RULE_TYPE_LABELS[f.ruleType],
    'Rule origin': QC_RULE_ORIGIN_LABELS[f.ruleOrigin],
    // Blank rather than an empty string stand-in: these columns are numeric and
    // a reader will sum them.
    Expected: f.expected ?? '',
    Actual: f.actual ?? '',
    Deviation: f.deviation,
    Unit: f.deviationUnit,
    'What was found': f.message,
    'Observation note': f.note ?? '',
    // The key the workbook opens on, so a finding stays actionable outside DMS.
    'Observation key': f.observationKey,
  }
}

export function downloadFindingsCsv(findings: readonly QcFinding[], stem = 'qc-findings'): void {
  downloadCsv(findings.map(findingRow), [...FINDING_HEADERS], stem)
}

export function downloadRunXlsx(
  summary: QcRunSummary,
  ruleStats: readonly QcRuleStat[],
  findings: readonly QcFinding[],
  stem = 'qc-report',
): void {
  const runSheet: SheetSpec = {
    name: 'Run',
    headers: ['Field', 'Value'],
    rows: [
      { Field: 'Report ID', Value: summary.id },
      { Field: 'Run at (UTC)', Value: summary.runUtc },
      { Field: 'Run from', Value: summary.runBy },
      { Field: 'Scope', Value: summary.scope.label },
      { Field: 'Countries in scope', Value: summary.scope.countries.length },
      { Field: 'Country codes', Value: summary.scope.countries.join(', ') },
      { Field: 'Years', Value: `${summary.scope.yearFrom}–${summary.scope.yearTo}` },
      { Field: 'Rules run', Value: summary.ruleIds.length },
      { Field: 'Values checked', Value: summary.observationsChecked },
      { Field: 'Failures', Value: summary.errors },
      { Field: 'Warnings', Value: summary.warnings },
      { Field: 'Countries with findings', Value: summary.countriesWithFindings },
    ],
  }

  const rulesSheet: SheetSpec = {
    name: 'Rules',
    headers: [
      'Rule',
      'Type',
      'Origin',
      'Values checked',
      'Failures',
      'Warnings',
      'Countries excluded',
      'Stopped early',
    ],
    rows: ruleStats.map((s) => ({
      Rule: s.ruleName,
      Type: QC_RULE_TYPE_LABELS[s.ruleType],
      Origin: QC_RULE_ORIGIN_LABELS[s.ruleOrigin],
      'Values checked': s.checked,
      Failures: s.errors,
      Warnings: s.warnings,
      'Countries excluded': s.excluded,
      'Stopped early': s.truncated ? 'Yes' : 'No',
    })),
  }

  const findingsSheet: SheetSpec = {
    name: 'Findings',
    headers: [...FINDING_HEADERS],
    rows: findings.map(findingRow),
  }

  downloadXlsx([runSheet, rulesSheet, findingsSheet], stem)
}
