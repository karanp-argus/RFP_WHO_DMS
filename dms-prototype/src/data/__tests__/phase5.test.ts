/**
 * Phase 5 acceptance — the delivered rules against the real seeded corpus.
 *
 * `domain/qc/__tests__/qc.test.ts` asks whether each rule computes what it
 * claims on a fixture nobody can argue with. This asks the opposite and more
 * important question: run the shipped rule set over the actual data and does it
 * find the fourteen defects Phase 1 planted, at the countries and years the
 * demo script navigates to.
 *
 * That is the phase's stated "done when", and it is a regression test in the
 * strongest sense — every one of these findings is a beat in the demo, so a
 * generator change that quietly silences one is a change that breaks the
 * presentation without breaking a build.
 *
 * It is also the test that caught the defects being inert in the first place.
 * Three of the fourteen were planted on series their country never reported,
 * and one continuity kind never suppressed a value at all; all four passed
 * every Phase 1 test, because Phase 1 asserted the shape of the corpus and
 * never asked whether the defects in it did anything.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { FIRST_YEAR, LAST_YEAR } from '@/domain/constants'
import { observationKey } from '@/domain/keys'
import {
  DEFAULT_THRESHOLDS,
  QC_RULE_TYPES,
  SEEDED_QC_RULES,
  findingsByObservation,
  runQc,
  type QcFinding,
  type QcRunResult,
} from '@/domain/qc'
import { mockXMartClient } from '../xmart/mockClient'
import { buildQcAccess, reportedCodesFor } from '../qc/qcAccess'
import { QC_DEMO_COUNTRIES } from '../qc/demoScope'
import { DEFECTS, type DefectKind } from '../generators/defects'
import { COUNTRY_BY_ISO3 } from '../seed/countries'

/** The rule category each planted defect kind is meant to be caught by. */
const EXPECTED_RULE_TYPE: Record<DefectKind, string> = {
  gap: 'missing-observation',
  spike: 'yoy-relative',
  'category-mismatch': 'category-consistency',
  outlier: 'group-outlier',
  disappeared: 'disappeared-observation',
  new: 'new-observation',
  'atypical-zero': 'atypical-entry',
  negative: 'atypical-entry',
}

let result: QcRunResult
let findings: QcFinding[]

beforeAll(async () => {
  const [variables, formulas, countries] = await Promise.all([
    mockXMartClient.getVariables(),
    mockXMartClient.getFormulas(),
    mockXMartClient.getCountries(),
  ])

  const codes = reportedCodesFor(SEEDED_QC_RULES, variables, ['CHE'])
  const page = await mockXMartClient.getObservations({
    countries: QC_DEMO_COUNTRIES,
    yearFrom: FIRST_YEAR,
    yearTo: LAST_YEAR,
    variables: codes,
    pageSize: 5_000_000,
  })

  const observations = new Map(
    page.rows.map((o) => [observationKey(o.iso3, o.year, o.dims), o]),
  )
  const reported = new Map<string, number | null>()
  for (const o of page.rows) {
    const dims = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
    const code = dims[0]
    if (dims.length === 1 && code) reported.set(`${o.iso3}|${o.year}|${code}`, o.value)
  }

  // Only the codes the version-growth rule names, over its own year window.
  const versionRule = SEEDED_QC_RULES.find((r) => r.type === 'version-growth')!
  const versionKeys: string[] = []
  for (const iso3 of QC_DEMO_COUNTRIES) {
    for (let y = versionRule.yearFrom ?? FIRST_YEAR; y <= LAST_YEAR; y++) {
      for (const code of versionRule.variables) {
        const dimension = variables.find((v) => v.code === code)?.dimension
        if (dimension) versionKeys.push(observationKey(iso3, y, { [dimension]: code }))
      }
    }
  }
  const versions = await mockXMartClient.getVersionsBulk(versionKeys)

  const { access } = buildQcAccess({
    observations,
    reported,
    versions,
    variables,
    countries,
    formulas,
  })

  result = runQc({
    rules: SEEDED_QC_RULES,
    scope: {
      kind: 'countries',
      label: 'Quality Checks demo set',
      countries: [...QC_DEMO_COUNTRIES],
      yearFrom: FIRST_YEAR,
      yearTo: LAST_YEAR,
    },
    thresholds: DEFAULT_THRESHOLDS,
    data: access,
    runBy: 'phase5.test',
    runUtc: '2026-08-01T09:00:00.000Z',
    runId: 'phase5',
  })
  findings = result.findings
}, 120_000)

/* ==========================================================================
   THE ACCEPTANCE CRITERION
   ========================================================================== */

describe('every planted defect is found', () => {
  for (const defect of DEFECTS) {
    const where = `${defect.iso3} ${defect.code} ${defect.year}${defect.yearTo ? `–${defect.yearTo}` : ''}`

    it(`${defect.kind}: ${where}`, () => {
      const hits = findings.filter((f) => f.iso3 === defect.iso3 && f.code === defect.code)
      expect(hits.length, `no finding at all for ${where}`).toBeGreaterThan(0)

      const expectedType = EXPECTED_RULE_TYPE[defect.kind]
      const byRightRule = hits.filter((f) => f.ruleType === expectedType)
      expect(
        byRightRule.length,
        `${where} was found, but not by a ${expectedType} rule — found by ${[
          ...new Set(hits.map((h) => h.ruleType)),
        ].join(', ')}`,
      ).toBeGreaterThan(0)
    })
  }
})

/* ==========================================================================
   TRACEABILITY — the reason the defects were declared rather than random
   ========================================================================== */

describe('findings trace back to something a human wrote', () => {
  it('carries the defect note onto the finding for every planted defect', () => {
    const withoutNote: string[] = []
    for (const defect of DEFECTS) {
      const hits = findings.filter(
        (f) =>
          f.iso3 === defect.iso3 &&
          f.code === defect.code &&
          f.ruleType === EXPECTED_RULE_TYPE[defect.kind],
      )
      if (!hits.some((h) => h.note === defect.note)) {
        withoutNote.push(`${defect.iso3} ${defect.code} (${defect.kind})`)
      }
    }
    // A presenter must be able to say "this is Kenya 2016, and here is why the
    // rule fired" from the report itself, without opening the seed files.
    expect(withoutNote).toEqual([])
  })

  it('anchors every finding on a cell the workbook can open', () => {
    for (const finding of findings.slice(0, 500)) {
      expect(finding.observationKey).toMatch(/^[A-Z]{3}-\d{4}#/)
    }
  })
})

/* ==========================================================================
   THE RUN AS A WHOLE
   ========================================================================== */

describe('the delivered run', () => {
  it('exercises every UC053 rule category against real data', () => {
    const firedTypes = new Set(findings.map((f) => f.ruleType))
    const silent = QC_RULE_TYPES.filter((t) => !firedTypes.has(t))
    // A category that finds nothing on a corpus seeded with defects for it is
    // a category that is not really implemented.
    expect(silent).toEqual([])
  })

  it('finds both severities, because UC053 requires both', () => {
    expect(result.summary.errors).toBeGreaterThan(0)
    expect(result.summary.warnings).toBeGreaterThan(0)
  })

  it('reports every rule it ran, including the ones that found nothing', () => {
    const enabled = SEEDED_QC_RULES.filter((r) => r.isEnabled)
    expect(result.ruleStats).toHaveLength(enabled.length)
    for (const stat of result.ruleStats) {
      expect(stat.checked, `${stat.ruleId} checked nothing`).toBeGreaterThan(0)
    }
  })

  it('completes without hitting the check budget', () => {
    // Truncation is reported rather than hidden, but a delivered rule set over
    // the delivered scope should not be reaching the bound at all.
    expect(result.ruleStats.filter((s) => s.truncated)).toEqual([])
  })

  it('applies the UC048 exclusions the absolute-growth rule ships with', () => {
    const stat = result.ruleStats.find((s) => s.ruleId === 'qc-yoy-abs-major-schemes')!
    expect(stat.excluded).toBeGreaterThan(0)
    const excluded = new Set(
      SEEDED_QC_RULES.find((r) => r.id === 'qc-yoy-abs-major-schemes')!.excludedCountries,
    )
    const leaked = findings.filter(
      (f) => f.ruleId === 'qc-yoy-abs-major-schemes' && excluded.has(f.iso3),
    )
    expect(leaked).toEqual([])
  })

  it('rings one cell per observation, keeping the worse verdict (UC052)', () => {
    const byCell = findingsByObservation(findings)
    expect(byCell.size).toBeGreaterThan(0)
    expect(byCell.size).toBeLessThanOrEqual(findings.length)
    for (const [key, finding] of byCell) {
      const all = findings.filter((f) => f.observationKey === key)
      if (all.some((f) => f.severity === 'error')) expect(finding.severity).toBe('error')
    }
  })
})

/* ==========================================================================
   THE DEMO SCOPE
   ========================================================================== */

describe('the demo scope', () => {
  it('contains every country carrying a planted defect', () => {
    for (const defect of DEFECTS) {
      expect(QC_DEMO_COUNTRIES, `${defect.iso3} missing from the demo scope`).toContain(
        defect.iso3,
      )
    }
  })

  it('gives every grouping attribute a real comparison population', () => {
    // The outlier rules refuse to judge a group of fewer than five, so a scope
    // whose groups are smaller than that silently disables half of UC053.
    const byRegion = new Map<string, number>()
    const byIncome = new Map<string, number>()
    for (const iso3 of QC_DEMO_COUNTRIES) {
      const country = COUNTRY_BY_ISO3.get(iso3)
      if (!country) continue
      byRegion.set(country.GRP_WHO_REGION, (byRegion.get(country.GRP_WHO_REGION) ?? 0) + 1)
      byIncome.set(country.GRP_WB_INCOME, (byIncome.get(country.GRP_WB_INCOME) ?? 0) + 1)
    }
    for (const [group, n] of [...byRegion, ...byIncome]) {
      expect(n, `group ${group} has only ${n} countries`).toBeGreaterThanOrEqual(5)
    }
  })

  it('names only countries that exist', () => {
    for (const iso3 of QC_DEMO_COUNTRIES) {
      expect(COUNTRY_BY_ISO3.has(iso3), `${iso3} is not a seeded country`).toBe(true)
    }
  })
})
