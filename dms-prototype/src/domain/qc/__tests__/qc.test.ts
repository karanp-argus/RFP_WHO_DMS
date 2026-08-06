/**
 * Quality-check domain tests.
 *
 * The fixture is a small synthetic world rather than the seeded corpus: four
 * countries, one classification, ten years, every value written by hand. That
 * is deliberate — a rule test whose expected outcome depends on a hash function
 * tells you the hash has not changed, not that the rule is right. The seeded
 * corpus is exercised separately in `data/__tests__/phase5.test.ts`, where the
 * question being asked is the opposite one: does the real data trip the rules.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THRESHOLDS,
  effectiveThresholds,
  emptyRule,
  findingsByObservation,
  median,
  PREDEFINED_QC_RULES,
  QC_RULE_HEADERS,
  QC_RULE_TYPES,
  robustSigma,
  rowsToRules,
  ruleToRow,
  runQc,
  SEEDED_QC_RULES,
  severityFor,
  thresholdsFor,
  type QcDataAccess,
  type QcRule,
  type QcRunScope,
} from '../index'

/* ==========================================================================
   FIXTURE
   ========================================================================== */

const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]

/** `iso3|year|code` → value. Anything absent is a genuine blank. */
type Values = Record<string, number | null>

interface FixtureOptions {
  values: Values
  children?: Record<string, string[]>
  attributes?: Record<string, string>
  versions?: Record<string, { versionNumber: number; value: number | null }[]>
  notes?: Record<string, string>
}

function fixture(options: FixtureOptions): QcDataAccess {
  const { values, children = {}, attributes = {}, versions = {}, notes = {} } = options

  return {
    valueOf: (iso3, year, code) => values[`${iso3}|${year}|${code}`] ?? null,
    observationKeyOf: (iso3, year, code) => `${iso3}-${year}#X=${code}`,
    childrenOf: (code) => children[code] ?? [],
    labelOf: (code) => `Label for ${code}`,
    countryName: (iso3) => `Country ${iso3}`,
    attributeOf: (iso3) => attributes[iso3] ?? 'GROUP',
    versionsOf: (iso3, year, code) =>
      (versions[`${iso3}|${year}|${code}`] ?? []).map((v) => ({
        ...v,
        commitDateUtc: '2025-01-01T00:00:00.000Z',
        author: 'tester@who.int',
      })),
    noteOf: (iso3, year, code) => notes[`${iso3}|${year}|${code}`],
    cheOf: (iso3, year) => values[`${iso3}|${year}|CHE`] ?? null,
  }
}

function scope(countries: string[], yearFrom = 2015, yearTo = 2024): QcRunScope {
  return { kind: 'countries', label: 'test', countries, yearFrom, yearTo }
}

function rule(overrides: Partial<QcRule> & Pick<QcRule, 'type'>): QcRule {
  return {
    ...emptyRule('r1', overrides.type, 'tester@who.int', '2026-08-01T00:00:00.000Z'),
    name: 'Test rule',
    ...overrides,
  }
}

function run(rules: QcRule[], data: QcDataAccess, s: QcRunScope) {
  return runQc({
    rules,
    scope: s,
    thresholds: DEFAULT_THRESHOLDS,
    data,
    runBy: 'tester@who.int',
    runUtc: '2026-08-01T00:00:00.000Z',
    runId: 'run-1',
  })
}

/* ==========================================================================
   THRESHOLDS (UC054)
   ========================================================================== */

describe('thresholds', () => {
  it('covers every rule type, so no type can silently fall back to zero', () => {
    for (const type of QC_RULE_TYPES) {
      expect(DEFAULT_THRESHOLDS[type], type).toBeDefined()
      expect(DEFAULT_THRESHOLDS[type].warnAt).toBeTypeOf('number')
      expect(DEFAULT_THRESHOLDS[type].failAt).toBeTypeOf('number')
    }
  })

  it('grades a deviation as pass, warning or fail', () => {
    const pair = { warnAt: 10, failAt: 20 }
    expect(severityFor(5, pair)).toBeNull()
    expect(severityFor(10, pair)).toBe('warning')
    expect(severityFor(19.9, pair)).toBe('warning')
    expect(severityFor(20, pair)).toBe('error')
    expect(severityFor(500, pair)).toBe('error')
  })

  it('gives the more severe verdict when an admin inverts the pair', () => {
    // warnAt above failAt is a configuration an administrator can make, and
    // "fail" is the answer that must not be lost to check order.
    expect(severityFor(50, { warnAt: 90, failAt: 20 })).toBe('error')
  })

  it('treats a non-finite deviation as a pass rather than a fail', () => {
    expect(severityFor(Number.NaN, { warnAt: 1, failAt: 2 })).toBeNull()
    expect(severityFor(Number.POSITIVE_INFINITY, { warnAt: 1, failAt: 2 })).toBeNull()
  })

  it('applies an administrator override over the delivered set (UC054)', () => {
    const set = effectiveThresholds({ 'yoy-relative': { warnAt: 5, failAt: 9 } })
    expect(set['yoy-relative']).toEqual({ warnAt: 5, failAt: 9 })
    // Untouched types keep their delivered pair.
    expect(set['table-consistency']).toEqual(DEFAULT_THRESHOLDS['table-consistency'])
  })

  it("prefers a rule's own pair over the global set", () => {
    const own = rule({ type: 'yoy-relative', thresholds: { warnAt: 1, failAt: 2 } })
    const shared = rule({ type: 'yoy-relative', thresholds: null })
    expect(thresholdsFor(own, DEFAULT_THRESHOLDS)).toEqual({ warnAt: 1, failAt: 2 })
    expect(thresholdsFor(shared, DEFAULT_THRESHOLDS)).toEqual(DEFAULT_THRESHOLDS['yoy-relative'])
  })
})

/* ==========================================================================
   STATISTICS
   ========================================================================== */

describe('robust statistics', () => {
  it('takes the median of odd and even length series', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('is not dragged by the outlier it is measuring', () => {
    const peers = [10, 11, 12, 13, 14]
    const withOutlier = [...peers, 900]
    // A standard deviation triples; the robust spread barely moves, which is
    // the whole reason the outlier rule uses it.
    const sigmaClean = robustSigma(peers)!
    const sigmaDirty = robustSigma(withOutlier)!
    expect(sigmaDirty / sigmaClean).toBeLessThan(2)
  })

  it('falls back to a standard deviation when the MAD is zero', () => {
    // Four identical members and one different: MAD is 0, so a naive robust
    // sigma would be 0 and every member would be infinitely far from the median.
    const sigma = robustSigma([5, 5, 5, 5, 9])
    expect(sigma).not.toBeNull()
    expect(sigma!).toBeGreaterThan(0)
    expect(Number.isFinite(sigma!)).toBe(true)
  })

  it('returns null when there is no spread at all', () => {
    expect(robustSigma([7, 7, 7])).toBeNull()
  })
})

/* ==========================================================================
   GROWTH RULES
   ========================================================================== */

describe('year-on-year growth', () => {
  const data = fixture({
    values: {
      'AAA|2015|V': 100,
      'AAA|2016|V': 105,
      'AAA|2017|V': 300, // +186%
      'AAA|2018|V': 60, // -80%
    },
  })

  it('flags a spike and a collapse when the comparison is "outside"', () => {
    const result = run(
      [rule({ type: 'yoy-relative', variables: ['V'], comparison: 'outside' })],
      data,
      scope(['AAA'], 2015, 2018),
    )
    expect(result.findings.map((f) => f.year).sort()).toEqual([2017, 2018])
  })

  it('flags only the rise when the comparison is "above"', () => {
    const result = run(
      [rule({ type: 'yoy-relative', variables: ['V'], comparison: 'above' })],
      data,
      scope(['AAA'], 2015, 2018),
    )
    expect(result.findings.map((f) => f.year)).toEqual([2017])
  })

  it('flags only the fall when the comparison is "below"', () => {
    const result = run(
      [rule({ type: 'yoy-relative', variables: ['V'], comparison: 'below' })],
      data,
      scope(['AAA'], 2015, 2018),
    )
    expect(result.findings.map((f) => f.year)).toEqual([2018])
  })

  it('measures absolute growth in the value’s own units', () => {
    const result = run(
      [
        rule({
          type: 'yoy-absolute',
          variables: ['V'],
          thresholds: { warnAt: 100, failAt: 150 },
        }),
      ],
      data,
      scope(['AAA'], 2015, 2018),
    )
    const spike = result.findings.find((f) => f.year === 2017)
    expect(spike?.deviation).toBe(195)
    expect(spike?.severity).toBe('error')
    expect(spike?.deviationUnit).toBe('absolute')
  })

  it('never compares against a blank', () => {
    const gappy = fixture({ values: { 'AAA|2016|V': 100, 'AAA|2018|V': 900 } })
    const result = run(
      [rule({ type: 'yoy-relative', variables: ['V'] })],
      gappy,
      scope(['AAA'], 2015, 2018),
    )
    // 2018 has no 2017 to compare with — a missing prior year is not a 900% rise.
    expect(result.findings).toHaveLength(0)
  })

  it('does not divide by a zero base', () => {
    const zeroed = fixture({ values: { 'AAA|2016|V': 0, 'AAA|2017|V': 500 } })
    const result = run(
      [rule({ type: 'yoy-relative', variables: ['V'] })],
      zeroed,
      scope(['AAA'], 2015, 2018),
    )
    expect(result.findings).toHaveLength(0)
  })
})

describe('version growth', () => {
  it('compares the current value against the earliest retained version', () => {
    const data = fixture({
      values: { 'AAA|2020|V': 150 },
      versions: {
        'AAA|2020|V': [
          { versionNumber: 1, value: 100 },
          { versionNumber: 2, value: 120 },
          { versionNumber: 3, value: 145 },
        ],
      },
    })
    const result = run(
      [rule({ type: 'version-growth', variables: ['V'] })],
      data,
      scope(['AAA'], 2020, 2020),
    )
    // 150 against the *original* 100 is +50%, not the +3.4% of the last step —
    // comparing consecutive versions reports nothing at any usable threshold.
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]!.deviation).toBeCloseTo(50)
    expect(result.findings[0]!.expected).toBe(100)
  })

  it('says nothing about an observation that has never been revised', () => {
    const data = fixture({ values: { 'AAA|2020|V': 150 } })
    const result = run(
      [rule({ type: 'version-growth', variables: ['V'] })],
      data,
      scope(['AAA'], 2020, 2020),
    )
    expect(result.findings).toHaveLength(0)
  })
})

/* ==========================================================================
   CONTINUITY RULES
   ========================================================================== */

describe('reporting continuity', () => {
  /** Reports `OTHER` throughout; `V` only from 2021. */
  const lateStarter = fixture({
    values: {
      ...Object.fromEntries(YEARS.map((y) => [`AAA|${y}|OTHER`, 10])),
      'AAA|2021|V': 5,
      'AAA|2022|V': 6,
      'AAA|2023|V': 7,
      'AAA|2024|V': 8,
    },
  })

  it('reports a code that appears after years of active reporting', () => {
    const result = run(
      [rule({ type: 'new-observation', variables: ['V', 'OTHER'] })],
      lateStarter,
      scope(['AAA']),
    )
    const finding = result.findings.find((f) => f.code === 'V')
    expect(finding).toBeDefined()
    expect(finding!.year).toBe(2021)
    expect(finding!.deviation).toBe(6) // 2015–2020 reported OTHER but not V
    expect(finding!.severity).toBe('error') // ≥ 5 years of silence
  })

  it('does not report every code of a country whose whole series starts late', () => {
    // Nothing at all before 2021 — the country simply was not reporting, and
    // "new observation vs prior reporting" has no prior reporting to compare to.
    const wholeSeriesLate = fixture({
      values: {
        'AAA|2021|V': 5,
        'AAA|2022|V': 6,
        'AAA|2021|OTHER': 1,
        'AAA|2022|OTHER': 2,
      },
    })
    const result = run(
      [rule({ type: 'new-observation', variables: ['V', 'OTHER'] })],
      wholeSeriesLate,
      scope(['AAA']),
    )
    expect(result.findings).toHaveLength(0)
  })

  it('reports an established series that stops while the country keeps reporting', () => {
    const stopped = fixture({
      values: {
        ...Object.fromEntries(YEARS.map((y) => [`AAA|${y}|OTHER`, 10])),
        ...Object.fromEntries(
          [2015, 2016, 2017, 2018, 2019, 2020, 2021].map((y) => [`AAA|${y}|V`, 5]),
        ),
      },
    })
    const result = run(
      [rule({ type: 'disappeared-observation', variables: ['V', 'OTHER'] })],
      stopped,
      scope(['AAA']),
    )
    const finding = result.findings.find((f) => f.code === 'V')
    expect(finding).toBeDefined()
    expect(finding!.year).toBe(2021) // the last year it was reported
    expect(finding!.deviation).toBe(7) // an unbroken run of seven years
    expect(finding!.severity).toBe('error')
  })

  it('measures a mid-series hole and anchors the finding on its first year', () => {
    const gappy = fixture({
      values: {
        'AAA|2015|V': 1,
        'AAA|2016|V': 2,
        'AAA|2020|V': 3,
        'AAA|2021|V': 4,
      },
    })
    const result = run(
      [rule({ type: 'missing-observation', variables: ['V'] })],
      gappy,
      scope(['AAA']),
    )
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]!.year).toBe(2017)
    expect(result.findings[0]!.deviation).toBe(3) // 2017, 2018, 2019
    expect(result.findings[0]!.severity).toBe('error') // ≥ 3 consecutive
    expect(result.findings[0]!.message).toContain('2017–2019')
  })

  it('does not treat a series that has not started or has ended as a hole', () => {
    const bounded = fixture({
      values: { 'AAA|2018|V': 1, 'AAA|2019|V': 2, 'AAA|2020|V': 3 },
    })
    const result = run(
      [rule({ type: 'missing-observation', variables: ['V'] })],
      bounded,
      scope(['AAA']),
    )
    expect(result.findings).toHaveLength(0)
  })
})

/* ==========================================================================
   CONSISTENCY RULES
   ========================================================================== */

describe('category consistency', () => {
  it('flags a year where a child breaks from its own median share', () => {
    const values: Values = {}
    for (const y of YEARS) {
      // A stable 30 / 70 split, except 2022 where the first child collapses.
      const a = y === 2022 ? 5 : 30
      values[`AAA|${y}|A`] = a
      values[`AAA|${y}|B`] = 70
      values[`AAA|${y}|P`] = a + 70
    }
    const data = fixture({ values, children: { P: ['A', 'B'] } })
    const result = run(
      [rule({ type: 'category-consistency', variables: ['P'] })],
      data,
      scope(['AAA']),
    )
    const finding = result.findings.find((f) => f.code === 'A' && f.year === 2022)
    expect(finding).toBeDefined()
    expect(finding!.severity).toBe('error')
    // The baseline is the median share, so the offending year cannot move it.
    expect(finding!.expected).toBeCloseTo(30, 0)
  })

  it('needs five observed years before it claims a baseline', () => {
    const values: Values = {}
    for (const y of [2015, 2016, 2017]) {
      values[`AAA|${y}|A`] = y === 2017 ? 1 : 30
      values[`AAA|${y}|P`] = y === 2017 ? 71 : 100
    }
    const data = fixture({ values, children: { P: ['A'] } })
    const result = run(
      [rule({ type: 'category-consistency', variables: ['P'] })],
      data,
      scope(['AAA']),
    )
    expect(result.findings).toHaveLength(0)
  })
})

describe('table consistency', () => {
  const data = fixture({
    values: {
      'AAA|2020|HF TOT': 1000,
      'AAA|2020|HC TOT': 1080, // 8% apart → error at 5/10? no: 8 ≥ 5, < 10 → warning
      'AAA|2021|HF TOT': 1000,
      'AAA|2021|HC TOT': 1250, // 25% apart → error
      'AAA|2022|HF TOT': 1000,
      'AAA|2022|HC TOT': 1020, // 2% apart → pass
    },
  })

  it('compares two sides that should reconcile', () => {
    const result = run(
      [rule({ type: 'table-consistency', leftCodes: ['HF TOT'], rightCodes: ['HC TOT'] })],
      data,
      scope(['AAA'], 2020, 2022),
    )
    expect(result.findings).toHaveLength(2)
    expect(result.findings.find((f) => f.year === 2021)!.severity).toBe('error')
    expect(result.findings.find((f) => f.year === 2020)!.severity).toBe('warning')
  })

  it('stays silent when either side is incomplete', () => {
    // A half-present side is a reporting gap, and the continuity rules are the
    // ones that should say so — reporting it as a reconciliation failure would
    // blame the wrong thing.
    const partial = fixture({
      values: { 'AAA|2020|L1': 100, 'AAA|2020|R1': 50 },
    })
    const result = run(
      [rule({ type: 'table-consistency', leftCodes: ['L1', 'L2'], rightCodes: ['R1'] })],
      partial,
      scope(['AAA'], 2020, 2020),
    )
    expect(result.findings).toHaveLength(0)
  })
})

/* ==========================================================================
   PLAUSIBILITY RULES
   ========================================================================== */

describe('atypical entries', () => {
  const data = fixture({
    values: {
      'AAA|2020|V': -40,
      'AAA|2020|CHE': 1000,
      'AAA|2021|V': 0,
      'AAA|2021|CHE': 1000,
      'AAA|2022|V': 25,
      'AAA|2022|CHE': 1000,
      // A zero with no total behind it is a country that reports nothing, not
      // an atypical entry.
      'BBB|2021|V': 0,
    },
  })

  it('fails a negative value and warns on a zero against a positive total', () => {
    const result = run(
      [rule({ type: 'atypical-entry', variables: ['V'], comparison: 'above' })],
      data,
      scope(['AAA', 'BBB'], 2020, 2022),
    )
    expect(result.findings).toHaveLength(2)
    expect(result.findings.find((f) => f.year === 2020)!.severity).toBe('error')
    expect(result.findings.find((f) => f.year === 2021)!.severity).toBe('warning')
  })

  it('lets an administrator promote zeros to failures (UC054)', () => {
    const result = runQc({
      rules: [rule({ type: 'atypical-entry', variables: ['V'], comparison: 'above' })],
      scope: scope(['AAA'], 2020, 2022),
      thresholds: effectiveThresholds({ 'atypical-entry': { warnAt: 1, failAt: 1 } }),
      data,
      runBy: 't',
      runUtc: '2026-08-01T00:00:00.000Z',
      runId: 'r',
    })
    expect(result.findings.every((f) => f.severity === 'error')).toBe(true)
  })
})

describe('group outliers', () => {
  /**
   * Five peers holding a roughly steady 20% share; one jumps in 2020.
   *
   * The peers wobble by a point or two year on year rather than sitting on an
   * exact constant. That is not decoration: with a perfectly flat group the
   * median absolute deviation is zero, the rule falls back to a standard
   * deviation computed over a sample that contains the outlier, and the very
   * country under test drags the yardstick out to meet itself. Real peer groups
   * move a little, and the rule is built for that.
   */
  function peerGroup(jump: number): QcDataAccess {
    const values: Values = {}
    const members = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']
    members.forEach((iso3, i) => {
      YEARS.forEach((y, yi) => {
        values[`${iso3}|${y}|CHE`] = 1000
        // Deterministic, so the test cannot become flaky, but uneven enough
        // across countries and years to give the group a real spread.
        values[`${iso3}|${y}|V`] = 200 + i + ((yi * (i + 3)) % 5)
      })
    })
    values['AAA|2020|V'] = 200 + jump * 10
    return fixture({
      values,
      attributes: Object.fromEntries(members.map((m) => [m, 'PEERS'])),
    })
  }

  it('finds the country that moved when its peers did not', () => {
    const result = run(
      [
        rule({
          type: 'group-outlier',
          variables: ['V'],
          groupBy: 'GRP_WB_INCOME',
          normalise: 'share-of-che-change',
        }),
      ],
      peerGroup(30),
      scope(['AAA', 'BBB', 'CCC', 'DDD', 'EEE'], 2016, 2024),
    )
    const flagged = result.findings.filter((f) => f.year === 2020)
    expect(flagged.map((f) => f.iso3)).toEqual(['AAA'])
    expect(flagged[0]!.severity).toBe('error')
  })

  it('refuses to judge a group too small to be a comparison', () => {
    const values: Values = {}
    for (const iso3 of ['AAA', 'BBB', 'CCC']) {
      for (const y of YEARS) {
        values[`${iso3}|${y}|CHE`] = 1000
        values[`${iso3}|${y}|V`] = iso3 === 'AAA' && y === 2020 ? 900 : 200
      }
    }
    const data = fixture({
      values,
      attributes: { AAA: 'TINY', BBB: 'TINY', CCC: 'TINY' },
    })
    const result = run(
      [
        rule({
          type: 'group-outlier',
          variables: ['V'],
          groupBy: 'GRP_WHO_REGION',
          normalise: 'share-of-che-change',
        }),
      ],
      data,
      scope(['AAA', 'BBB', 'CCC']),
    )
    // Three members is not a peer group; "far from the median" would describe
    // the group's size rather than the country.
    expect(result.findings).toHaveLength(0)
  })

  it('does nothing without a grouping attribute', () => {
    const result = run(
      [rule({ type: 'group-outlier', variables: ['V'], groupBy: null })],
      peerGroup(30),
      scope(['AAA', 'BBB', 'CCC', 'DDD', 'EEE']),
    )
    expect(result.findings).toHaveLength(0)
  })
})

/* ==========================================================================
   THE RUN
   ========================================================================== */

describe('runQc', () => {
  const data = fixture({
    values: {
      'AAA|2016|V': 100,
      'AAA|2017|V': 400,
      'BBB|2016|V': 100,
      'BBB|2017|V': 400,
    },
    notes: { 'AAA|2017|V': 'Currency redenomination, confirmed with the country.' },
  })

  const spike = rule({ id: 'spike', type: 'yoy-relative', variables: ['V'] })

  it('excludes a country from a rule entirely (UC048)', () => {
    const excluded: QcRule = { ...spike, excludedCountries: ['BBB'] }
    const result = run([excluded], data, scope(['AAA', 'BBB'], 2016, 2017))
    expect(result.findings.map((f) => f.iso3)).toEqual(['AAA'])
    // The exclusion is reported, not silently applied.
    expect(result.ruleStats[0]!.excluded).toBe(1)
  })

  it('skips a disabled rule without counting it as run', () => {
    const result = run([{ ...spike, isEnabled: false }], data, scope(['AAA'], 2016, 2017))
    expect(result.findings).toHaveLength(0)
    expect(result.ruleStats).toHaveLength(0)
    expect(result.summary.ruleIds).toHaveLength(0)
  })

  it('honours a rule’s own year window inside the run scope', () => {
    const windowed: QcRule = { ...spike, yearFrom: 2018 }
    const result = run([windowed], data, scope(['AAA'], 2016, 2017))
    expect(result.findings).toHaveLength(0)
  })

  it('carries the observation’s note onto the finding', () => {
    const result = run([spike], data, scope(['AAA'], 2016, 2017))
    expect(result.findings[0]!.note).toContain('Currency redenomination')
  })

  it('reports rather than hides a run that hit its check budget', () => {
    const result = runQc({
      rules: [spike],
      scope: scope(['AAA', 'BBB'], 2016, 2017),
      thresholds: DEFAULT_THRESHOLDS,
      data,
      runBy: 't',
      runUtc: '2026-08-01T00:00:00.000Z',
      runId: 'r',
      maxChecks: 1,
    })
    expect(result.ruleStats[0]!.truncated).toBe(true)
  })

  it('sorts findings most serious first', () => {
    const mixed = fixture({
      values: {
        'AAA|2016|V': 100,
        'AAA|2017|V': 150, // +50% → warning
        'BBB|2016|V': 100,
        'BBB|2017|V': 400, // +300% → error
      },
    })
    const result = run([spike], mixed, scope(['AAA', 'BBB'], 2016, 2017))
    expect(result.findings.map((f) => f.severity)).toEqual(['error', 'warning'])
  })

  it('summarises what it checked and what it found', () => {
    const result = run([spike], data, scope(['AAA', 'BBB'], 2016, 2017))
    expect(result.summary.errors).toBe(2)
    expect(result.summary.warnings).toBe(0)
    expect(result.summary.countriesWithFindings).toBe(2)
    expect(result.summary.observationsChecked).toBeGreaterThan(0)
    expect(result.summary.runBy).toBe('tester@who.int')
  })

  it('gives one ring per cell, keeping the worse verdict (UC052)', () => {
    const key = 'AAA-2017#X=V'
    const byCell = findingsByObservation([
      {
        ...run([spike], data, scope(['AAA'], 2016, 2017)).findings[0]!,
        severity: 'warning',
        observationKey: key,
      },
      {
        ...run([spike], data, scope(['AAA'], 2016, 2017)).findings[0]!,
        id: 'other',
        severity: 'error',
        observationKey: key,
      },
    ])
    expect(byCell.size).toBe(1)
    expect(byCell.get(key)!.severity).toBe('error')
  })
})

/* ==========================================================================
   THE DELIVERED RULE SET (UC053)
   ========================================================================== */

describe('the delivered rule set', () => {
  it('covers every UC053 category', () => {
    const covered = new Set(PREDEFINED_QC_RULES.map((r) => r.type))
    for (const type of QC_RULE_TYPES) {
      expect(covered.has(type), `no delivered rule of type ${type}`).toBe(true)
    }
  })

  it('marks every shipped rule as developer-authored, and seeds a contrast', () => {
    expect(PREDEFINED_QC_RULES.every((r) => r.origin === 'dev')).toBe(true)
    // UC053 requires dev rules to be distinguishable from admin ones, which is
    // only visible on arrival if there is an admin rule to distinguish from.
    const origins = new Set(SEEDED_QC_RULES.map((r) => r.origin))
    expect(origins.has('admin')).toBe(true)
    expect(origins.has('user')).toBe(true)
  })

  it('gives every rule a bounded set of codes to sweep', () => {
    for (const r of PREDEFINED_QC_RULES) {
      const named = r.variables.length + r.leftCodes.length + r.rightCodes.length
      expect(named, `${r.id} names no codes`).toBeGreaterThan(0)
    }
  })

  it('has unique ids', () => {
    const ids = SEEDED_QC_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives outlier rules a grouping attribute and consistency rules two sides', () => {
    for (const r of PREDEFINED_QC_RULES) {
      if (r.type === 'group-outlier') expect(r.groupBy, r.id).not.toBeNull()
      if (r.type === 'table-consistency') {
        expect(r.leftCodes.length, r.id).toBeGreaterThan(0)
        expect(r.rightCodes.length, r.id).toBeGreaterThan(0)
      }
    }
  })
})

/* ==========================================================================
   EXPORT / IMPORT (UC051)
   ========================================================================== */

describe('rule set exchange', () => {
  it('round-trips a rule through the flat sheet form', () => {
    const original = PREDEFINED_QC_RULES.find((r) => r.type === 'table-consistency')!
    const row = ruleToRow(original)
    const { rules, errors } = rowsToRules(
      [Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))],
      'importer@who.int',
      '2026-08-01T00:00:00.000Z',
    )
    expect(errors).toHaveLength(0)
    const imported = rules[0]!
    expect(imported.id).toBe(original.id)
    expect(imported.type).toBe(original.type)
    expect(imported.leftCodes).toEqual(original.leftCodes)
    expect(imported.rightCodes).toEqual(original.rightCodes)
    expect(imported.thresholds).toEqual(original.thresholds)
    expect(imported.variables).toEqual(original.variables)
  })

  it('never lets an import mint a developer-authored rule', () => {
    const row = Object.fromEntries(
      Object.entries(ruleToRow(PREDEFINED_QC_RULES[0]!)).map(([k, v]) => [k, String(v)]),
    )
    const { rules } = rowsToRules([{ ...row, Origin: 'dev' }], 'importer@who.int', 'now')
    // The dev badge is the whole of UC053's distinguishability requirement, and
    // a spreadsheet anyone can edit is not a source of authority for it.
    expect(rules[0]!.origin).toBe('admin')
  })

  it('keeps a blank threshold blank rather than importing it as zero', () => {
    const shared = PREDEFINED_QC_RULES.find((r) => r.thresholds === null)!
    const row = ruleToRow(shared)
    expect(row['Warn at']).toBe('')
    const { rules } = rowsToRules(
      [Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))],
      'i',
      'now',
    )
    // Zero would fire on everything; null means "use the global UC054 pair".
    expect(rules[0]!.thresholds).toBeNull()
  })

  it('rejects a bad row against its line number rather than importing a dud', () => {
    const { rules, errors } = rowsToRules(
      [
        { 'Rule ID': 'x', Name: 'Fine', Type: 'yoy-relative' },
        { 'Rule ID': 'y', Name: 'Bad type', Type: 'not-a-type' },
        { 'Rule ID': '', Name: 'No id', Type: 'yoy-relative' },
        { 'Rule ID': 'z', Name: 'Half a threshold', Type: 'yoy-relative', 'Warn at': 'abc' },
      ],
      'i',
      'now',
    )
    expect(rules).toHaveLength(1)
    expect(errors).toHaveLength(3)
    expect(errors[0]).toContain('Row 3')
    expect(errors[1]).toContain('Row 4')
    expect(errors[2]).toContain('Row 5')
  })

  it('exports every header the importer looks for', () => {
    const row = ruleToRow(PREDEFINED_QC_RULES[0]!)
    for (const header of QC_RULE_HEADERS) {
      expect(Object.hasOwn(row, header), `missing column ${header}`).toBe(true)
    }
  })
})
