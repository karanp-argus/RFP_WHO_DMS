/**
 * Phase 1 acceptance tests.
 *
 * The plan's gate is: `getObservations({country:'CAN', years:[2020,2023]})`
 * returns correct long-format rows in under 300ms, and the API log records the
 * call. These also lock down the two properties everything downstream assumes —
 * determinism, and the long-format round-trip.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { DIMENSIONS, METADATA_FIELDS } from '@/domain/constants'
import { dimsKey, observationKey, parseObservationKey, parseSurveyFk, surveyFk } from '@/domain/keys'
import { COUNTRIES, COUNTRY_BY_ISO3 } from '../seed/countries'
import { CURRENCY_BY_CODE } from '../seed/currencies'
import { CLASSIFICATION_VARIABLES, REPORTED_CODES } from '../seed/classifications'
import { PREDEFINED_FORMULAS } from '../seed/formulas'
import { derivedValue } from '../generators/observations'
import { DEFECTS, defectFor } from '../generators/defects'
import { buildVersions, MAX_VERSIONS } from '../generators/versions'
import { LONG_FORMAT_COLUMNS, fromLongFormat, toCsv, toLongFormat } from '../xmart/longFormat'
import { mockXMartClient } from '../xmart/mockClient'
import { MOCK_LATENCY_MS } from '../xmart/client'
import { clearApiLog, getApiCalls } from '../xmart/apiLog'
import { resetDemoData } from '../db'

beforeEach(() => {
  clearApiLog()
  resetDemoData()
})

describe('seed integrity', () => {
  it('has 194 WHO Member States with unique ISO3 codes', () => {
    expect(COUNTRIES).toHaveLength(194)
    expect(new Set(COUNTRIES.map((c) => c.CODE_ISO_3)).size).toBe(194)
  })

  it('resolves every country currency to a real currency record', () => {
    for (const c of COUNTRIES) {
      expect(CURRENCY_BY_CODE.has(c.CURRENCY_ISO_3)).toBe(true)
    }
  })

  it('transcribes the HF hierarchy from FR §1 verbatim', () => {
    const hf = CLASSIFICATION_VARIABLES.filter((v) => v.dimension === 'HF').map((v) => v.code)
    // The exact set the FR lists, including nec and TOT.
    expect(hf).toEqual([
      'HF.1',
      'HF.1.1',
      'HF.1.2',
      'HF.1.2.1',
      'HF.1.2.2',
      'HF.1.3',
      'HF.2',
      'HF.2.1',
      'HF.2.2',
      'HF.2.3',
      'HF.3',
      'HF.3.1',
      'HF.3.2',
      'HF.4',
      'HF.nec',
      'HF TOT',
    ])
  })

  it('marks aggregates as calculated so the formula engine owns them', () => {
    const byCode = new Map(CLASSIFICATION_VARIABLES.map((v) => [v.code, v]))
    // HF.1 has children, so it is summed, not reported.
    expect(byCode.get('HF.1')?.isCalculated).toBe(true)
    // HF.1.1 is a leaf countries report.
    expect(byCode.get('HF.1.1')?.isCalculated).toBe(false)
    expect(byCode.get('HF TOT')?.isCalculated).toBe(true)
  })

  it('seeds all 16 predefined formulas from HLR8', () => {
    expect(PREDEFINED_FORMULAS).toHaveLength(16)
    const codes = PREDEFINED_FORMULAS.map((f) => f.code)
    expect(codes).toContain('CHE')
    expect(codes).toContain('CHE%GDP_SHA2011')
    expect(codes).toContain('GGHE-D_pc_US$_SHA2011')
  })

  it('keeps both null policies represented, since they behave differently', () => {
    const policies = new Set(PREDEFINED_FORMULAS.map((f) => f.nullPolicy))
    expect(policies).toEqual(new Set(['any-not-null', 'all-not-null']))
  })
})

describe('keys', () => {
  it('round-trips SURVEY_FK', () => {
    expect(surveyFk('ARG', 2021)).toBe('ARG-2021')
    expect(parseSurveyFk('ARG-2021')).toEqual({ iso3: 'ARG', year: 2021 })
    expect(parseSurveyFk('nonsense')).toBeNull()
  })

  it('keys a cross identically regardless of insertion order', () => {
    // A cross is a multi-dimension tuple; {HF,HC} and {HC,HF} are the same cell.
    expect(dimsKey({ HF: 'HF.1', HC: 'HC.1' })).toBe(dimsKey({ HC: 'HC.1', HF: 'HF.1' }))
  })

  it('round-trips an observation key including a cross', () => {
    const dims = { HC: 'HC.1', HF: 'HF.1' }
    const key = observationKey('CAN', 2023, dims)
    expect(parseObservationKey(key)).toEqual({ iso3: 'CAN', year: 2023, dims })
  })
})

describe('determinism', () => {
  it('derives the same value for the same key every time', () => {
    const a = derivedValue('CAN', 2023, 'HF.1.1')
    const b = derivedValue('CAN', 2023, 'HF.1.1')
    expect(a).toBe(b)
  })

  it('derives different values across countries and years', () => {
    const can = derivedValue('CAN', 2023, 'HF.1.1')
    const arg = derivedValue('ARG', 2023, 'HF.1.1')
    expect(can).not.toBe(arg)
  })

  it('produces plausible, smooth time series', () => {
    const series: number[] = []
    for (let y = 2000; y <= 2024; y++) {
      const v = derivedValue('FRA', y, 'HF.1.1')
      if (v != null) series.push(v)
    }
    expect(series.length).toBeGreaterThan(20)
    // No year-on-year change beyond 60% in a clean series — the generator adds
    // trend plus small noise, so wild jumps would mean a bug (or a defect,
    // and FRA carries none).
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1]!
      const cur = series[i]!
      expect(Math.abs(cur - prev) / prev).toBeLessThan(0.6)
    }
  })

  it('leaves genuine sparsity, so workbooks look like real HA data', () => {
    let nulls = 0
    for (const code of REPORTED_CODES) {
      if (derivedValue('KEN', 2015, code) == null) nulls++
    }
    // Roughly 18% of codes are never reported by a given country.
    expect(nulls).toBeGreaterThan(5)
    expect(nulls).toBeLessThan(REPORTED_CODES.length * 0.5)
  })
})

describe('economic plausibility', () => {
  /** Sum the HF leaves — this is what the CHE formula will compute in Phase 3. */
  function cheFromLeaves(iso3: string, year: number): number {
    let che = 0
    for (const code of HF_LEAVES) che += derivedValue(iso3, year, code) ?? 0
    return che
  }

  function ratios(iso3: string, year = 2023) {
    const gdp = derivedValue(iso3, year, 'GDP')!
    const che = cheFromLeaves(iso3, year)
    const oop =
      (derivedValue(iso3, year, 'HF.3.1') ?? 0) + (derivedValue(iso3, year, 'HF.3.2') ?? 0)
    const ext = derivedValue(iso3, year, 'HF.4') ?? 0
    return { cheGdp: (che / gdp) * 100, oopChe: (oop / che) * 100, extChe: (ext / che) * 100 }
  }

  const HF_LEAVES = [
    'HF.1.1',
    'HF.1.2.1',
    'HF.1.2.2',
    'HF.1.3',
    'HF.2.1',
    'HF.2.2',
    'HF.2.3',
    'HF.3.1',
    'HF.3.2',
    'HF.4',
    'HF.nec',
  ]

  function median(xs: number[]): number {
    const s = [...xs].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]!
  }

  function medianBy(income: string, pick: (r: ReturnType<typeof ratios>) => number): number {
    const vals = COUNTRIES.filter((c) => c.GRP_WB_INCOME === income)
      .map((c) => pick(ratios(c.CODE_ISO_3)))
      .filter((v) => Number.isFinite(v))
    return median(vals)
  }

  it('uses real exchange rates, not random draws', () => {
    // An HA economist reads the per-capita US$ indicators; a wrong denominator
    // is immediately visible. EXR sits on the real reference rate at the anchor
    // year, within the small observation wobble the generator applies on top.
    for (const iso3 of ['CAN', 'JPN', 'GBR', 'IND', 'NGA']) {
      const country = COUNTRY_BY_ISO3.get(iso3)!
      const ref = CURRENCY_BY_CODE.get(country.CURRENCY_ISO_3)!.USD_RATE
      const exr = derivedValue(iso3, 2024, 'EXR')!
      expect(Math.abs(exr - ref) / ref).toBeLessThan(0.05)
    }
  })

  it('keeps a USD-denominated economy at a rate of exactly 1', () => {
    for (let y = 2000; y <= 2024; y++) {
      expect(derivedValue('USA', y, 'EXR')).toBeCloseTo(1, 6)
    }
  })

  it('anchors population at the seeded present, not 24 years of growth', () => {
    // Anchoring at 2000 and compounding forward once gave India 2.7 billion.
    for (const iso3 of ['IND', 'CHN', 'USA', 'CAN']) {
      const seeded = COUNTRY_BY_ISO3.get(iso3)!.POP_SMALL
      expect(derivedValue(iso3, 2024, 'POP')).toBeCloseTo(seeded, 0)
    }
  })

  it('produces GDP per capita in the right band for the income group', () => {
    const pc = (iso3: string) => {
      const gdp = derivedValue(iso3, 2023, 'GDP')!
      const exr = derivedValue(iso3, 2023, 'EXR')!
      const pop = derivedValue(iso3, 2023, 'POP')!
      return (gdp * 1e6) / exr / pop
    }
    // High income well above low income, and both inside a defensible range.
    expect(pc('USA')).toBeGreaterThan(30_000)
    expect(pc('USA')).toBeLessThan(150_000)
    expect(pc('ETH')).toBeLessThan(5_000)
    expect(pc('CAN')).toBeGreaterThan(pc('KEN'))
  })

  it('lands CHE%GDP near real-world levels for the demo countries', () => {
    // Canada is the §6 walkthrough subject and its real figure is ~11.5%.
    expect(ratios('CAN').cheGdp).toBeGreaterThan(7)
    expect(ratios('CAN').cheGdp).toBeLessThan(16)
    // Every country should be somewhere defensible.
    for (const c of COUNTRIES) {
      const r = ratios(c.CODE_ISO_3)
      expect(r.cheGdp).toBeGreaterThan(1)
      expect(r.cheGdp).toBeLessThan(25)
    }
  })

  it('makes out-of-pocket fall as income rises', () => {
    // Rich countries pool risk; poorer ones leave households paying directly.
    const hic = medianBy('HIC', (r) => r.oopChe)
    const umc = medianBy('UMC', (r) => r.oopChe)
    const lmc = medianBy('LMC', (r) => r.oopChe)
    expect(hic).toBeLessThan(umc)
    expect(umc).toBeLessThan(lmc)
    expect(hic).toBeLessThan(20)
    expect(lmc).toBeGreaterThan(22)
  })

  it('makes external financing fall as income rises', () => {
    // A high-income country funds essentially none of its health spending
    // externally; for a low-income country it can be a third or more.
    const hic = medianBy('HIC', (r) => r.extChe)
    const lmc = medianBy('LMC', (r) => r.extChe)
    const lic = medianBy('LIC', (r) => r.extChe)
    expect(hic).toBeLessThan(2)
    expect(lmc).toBeGreaterThan(hic)
    expect(lic).toBeGreaterThan(lmc)
  })

  it('keeps residual (n.e.c.) buckets small, never the largest component', () => {
    for (const iso3 of ['CAN', 'FRA', 'KEN', 'IND', 'THA', 'NGA']) {
      const nec = derivedValue(iso3, 2023, 'HF.nec') ?? 0
      const largest = Math.max(
        ...HF_LEAVES.map((c) => derivedValue(iso3, 2023, c) ?? 0),
      )
      expect(nec).toBeLessThan(largest * 0.25)
    }
  })

  it('always reports the two universals of health accounting', () => {
    // Government schemes and household out-of-pocket. Kenya once came out with
    // zero out-of-pocket spending, which discredits the whole dataset.
    for (const c of COUNTRIES) {
      expect(derivedValue(c.CODE_ISO_3, 2023, 'HF.1.1')).not.toBeNull()
      expect(derivedValue(c.CODE_ISO_3, 2023, 'HF.3.1')).not.toBeNull()
    }
  })

  it('leaves compulsory medical savings accounts rare, as in reality', () => {
    // HF.1.3 is essentially a Singapore/China instrument.
    const reporting = COUNTRIES.filter(
      (c) => derivedValue(c.CODE_ISO_3, 2023, 'HF.1.3') != null,
    ).length
    expect(reporting).toBeLessThan(COUNTRIES.length * 0.3)
  })
})

describe('planted defects (Phase 5 depends on these)', () => {
  it('covers every UC053 rule category', () => {
    const kinds = new Set(DEFECTS.map((d) => d.kind))
    expect(kinds).toEqual(
      new Set([
        'gap',
        'spike',
        'category-mismatch',
        'outlier',
        'disappeared',
        'new',
        'atypical-zero',
        'negative',
      ]),
    )
  })

  it('blanks the Kenya HF.2.1 gap across its whole declared range', () => {
    expect(defectFor('KEN', 'HF.2.1', 2015)?.kind).toBe('gap')
    for (let y = 2014; y <= 2016; y++) {
      expect(derivedValue('KEN', y, 'HF.2.1')).toBeNull()
    }
    // And the series resumes either side, so it is a gap not a truncation.
    expect(derivedValue('KEN', 2013, 'HF.2.1')).not.toBeNull()
    expect(derivedValue('KEN', 2017, 'HF.2.1')).not.toBeNull()
  })

  it('makes the Argentina 2018 spike detectable as a growth outlier', () => {
    const before = derivedValue('ARG', 2017, 'HF.3.1')!
    const spike = derivedValue('ARG', 2018, 'HF.3.1')!
    expect(spike / before).toBeGreaterThan(3)
  })

  it('produces a negative value for the Bolivia error case', () => {
    expect(derivedValue('BOL', 2011, 'FS.6')).toBeLessThan(0)
  })

  it('produces exactly zero for the Mozambique warning case', () => {
    expect(derivedValue('MOZ', 2020, 'HF.2.3')).toBe(0)
  })
})

describe('versions (UC043/UC044)', () => {
  it('never exceeds the 10 versions UC044 specifies', () => {
    for (const iso3 of ['CAN', 'ARG', 'KEN', 'FRA', 'IDN']) {
      for (let y = 2018; y <= 2024; y++) {
        for (const code of ['HF.1.1', 'HF.3.1', 'HC.1.1']) {
          const key = observationKey(iso3, y, { HF: code })
          expect(buildVersions(key, 1000, {}).length).toBeLessThanOrEqual(MAX_VERSIONS)
        }
      }
    }
  })

  it('numbers versions chronologically, oldest first', () => {
    // Find a key that actually has history.
    let versions: ReturnType<typeof buildVersions> = []
    for (let y = 2000; y <= 2024 && versions.length < 2; y++) {
      versions = buildVersions(observationKey('CAN', y, { HF: 'HF.1.1' }), 5000, {})
    }
    expect(versions.length).toBeGreaterThan(1)
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]!.versionNumber).toBe(versions[i - 1]!.versionNumber + 1)
      expect(versions[i]!.commitDateUtc >= versions[i - 1]!.commitDateUtc).toBe(true)
    }
  })
})

describe('long format (plan §1.3 contract)', () => {
  it('emits the exact xMart column list in order', () => {
    expect(LONG_FORMAT_COLUMNS[0]).toBe('SURVEY_FK')
    // The 15 dimensions follow, in the screenshot's order.
    expect(LONG_FORMAT_COLUMNS.slice(1, 16)).toEqual([...DIMENSIONS])
    expect(LONG_FORMAT_COLUMNS[16]).toBe('VALUE')
    expect(LONG_FORMAT_COLUMNS.slice(17, 23)).toEqual([...METADATA_FIELDS])
    // Annex 3 mandates an internal ID and a UTC last-modified stamp.
    expect(LONG_FORMAT_COLUMNS).toContain('Sys_ID')
    expect(LONG_FORMAT_COLUMNS).toContain('Sys_CommitDateUtc')
    expect(LONG_FORMAT_COLUMNS).toContain('Sys_IsDeleted')
  })

  it('round-trips an observation without drift', async () => {
    const page = await mockXMartClient.getObservations({
      countries: ['CAN'],
      years: [2023],
      variables: ['HF.1.1'],
    })
    const original = page.rows[0]
    expect(original).toBeDefined()

    const back = fromLongFormat(toLongFormat(original!))
    expect(back.surveyFk).toBe(original!.surveyFk)
    expect(back.iso3).toBe(original!.iso3)
    expect(back.year).toBe(original!.year)
    expect(back.dims).toEqual(original!.dims)
    expect(back.value).toBe(original!.value)
    expect(back.metadata).toEqual(original!.metadata)
    expect(back.sys.Sys_ID).toBe(original!.sys.Sys_ID)
    expect(back.sys.Sys_CommitDateUtc).toBe(original!.sys.Sys_CommitDateUtc)
  })

  it('keeps a sparse cross tuple sparse through the round trip', () => {
    const page = toLongFormat({
      surveyFk: 'CAN-2023',
      iso3: 'CAN',
      year: 2023,
      dims: { HC: 'HC.1', HF: 'HF.1' },
      value: 42,
      metadata: {},
      publishingStatus: 'not-publish',
      sys: {
        Sys_RowId: 'a',
        Sys_Origin: 'o',
        Sys_LoadBatchId: 1,
        Sys_CommitDateUtc: '2026-01-01T00:00:00.000Z',
        Sys_FirstLoadUser: 'u',
        Sys_ID: '1',
        Sys_BatchId: 1,
        Sys_FirstBatchID: 1,
        Sys_IsDeleted: false,
      },
    })
    // Only the two members are populated; the other 13 dimensions stay empty.
    expect(page.HC).toBe('HC.1')
    expect(page.HF).toBe('HF.1')
    expect(page.AGE).toBe('')
    expect(fromLongFormat(page).dims).toEqual({ HC: 'HC.1', HF: 'HF.1' })
  })

  it('quotes CSV fields containing commas', () => {
    const csv = toCsv([
      toLongFormat({
        surveyFk: 'CAN-2023',
        iso3: 'CAN',
        year: 2023,
        dims: { HF: 'HF.1' },
        value: 1,
        metadata: { COMMENT: 'a, b, c' },
        publishingStatus: 'not-publish',
        sys: {
          Sys_RowId: '',
          Sys_Origin: '',
          Sys_LoadBatchId: 0,
          Sys_CommitDateUtc: '',
          Sys_FirstLoadUser: '',
          Sys_ID: '',
          Sys_BatchId: 0,
          Sys_FirstBatchID: 0,
          Sys_IsDeleted: false,
        },
      }),
    ])
    expect(csv).toContain('"a, b, c"')
    expect(csv.split('\r\n')[0]).toBe(LONG_FORMAT_COLUMNS.join(','))
  })
})

describe('mock client — the Phase 1 acceptance gate', () => {
  it('returns Canada 2020–2023 promptly and logs the call', async () => {
    const started = performance.now()
    const page = await mockXMartClient.getObservations({
      countries: ['CAN'],
      yearFrom: 2020,
      yearTo: 2023,
    })
    const elapsed = performance.now() - started

    expect(page.rows.length).toBeGreaterThan(0)

    // The plan's gate was "under 300ms", but the mock deliberately injects
    // MOCK_LATENCY_MS (150–400ms) so the UI exercises real loading states.
    // Wall-clock is therefore bounded by the configured band plus a compute
    // budget; the derivation itself is timed separately below.
    expect(elapsed).toBeLessThan(MOCK_LATENCY_MS[1] + 200)

    // Every row belongs to the requested country and year window.
    for (const o of page.rows) {
      expect(o.iso3).toBe('CAN')
      expect(o.year).toBeGreaterThanOrEqual(2020)
      expect(o.year).toBeLessThanOrEqual(2023)
      expect(o.surveyFk).toBe(surveyFk('CAN', o.year))
    }

    // FR §1: an observation must carry a value OR metadata.
    for (const o of page.rows) {
      expect(o.value != null || Object.keys(o.metadata).length > 0).toBe(true)
    }

    const calls = getApiCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe('getObservations')
    expect(calls[0]!.direction).toBe('pull')
    expect(calls[0]!.rowCount).toBe(page.rows.length)
    expect(calls[0]!.request).toContain('GET ')
    expect(calls[0]!.request).toContain('$format=csv')
  })

  it('derives a country-year slice in single-digit milliseconds', () => {
    // The real performance claim, with the simulated network cost removed.
    // This is what makes the UC057 "up to 25 million rows" conversation honest:
    // any slice is derived on demand rather than held in memory.
    const started = performance.now()
    let cells = 0
    for (let year = 2020; year <= 2023; year++) {
      for (const code of REPORTED_CODES) {
        derivedValue('CAN', year, code)
        cells++
      }
    }
    const elapsed = performance.now() - started

    expect(cells).toBeGreaterThan(400)
    expect(elapsed).toBeLessThan(100)
  })

  it('excludes soft-deleted rows unless asked (Annex 3)', async () => {
    const without = await mockXMartClient.getObservations({ countries: ['CAN'], years: [2023] })
    const withDeleted = await mockXMartClient.getObservations({
      countries: ['CAN'],
      years: [2023],
      includeDeleted: true,
    })
    expect(without.rows.every((o) => !o.sys.Sys_IsDeleted)).toBe(true)
    expect(withDeleted.totalCount).toBeGreaterThan(without.totalCount)
  })

  it('filters by modifiedSince, so incremental pulls work (Annex 3)', async () => {
    const all = await mockXMartClient.getObservations({ countries: ['CAN'], years: [2023] })
    const cutoff = '2026-06-01T00:00:00.000Z'
    const recent = await mockXMartClient.getObservations({
      countries: ['CAN'],
      years: [2023],
      modifiedSince: cutoff,
    })
    expect(recent.totalCount).toBeLessThan(all.totalCount)
    expect(recent.rows.every((o) => o.sys.Sys_CommitDateUtc >= cutoff)).toBe(true)
  })

  it('pages with a large default page size (Annex 3)', async () => {
    const p1 = await mockXMartClient.getObservations({
      countries: ['CAN', 'ARG', 'FRA'],
      yearFrom: 2000,
      yearTo: 2024,
      page: 1,
      pageSize: 50,
    })
    expect(p1.rows).toHaveLength(50)
    expect(p1.hasMore).toBe(true)
    expect(p1.pageSize).toBe(50)

    const p2 = await mockXMartClient.getObservations({
      countries: ['CAN', 'ARG', 'FRA'],
      yearFrom: 2000,
      yearTo: 2024,
      page: 2,
      pageSize: 50,
    })
    // Pages must not overlap.
    const k1 = new Set(p1.rows.map((o) => observationKey(o.iso3, o.year, o.dims)))
    for (const o of p2.rows) {
      expect(k1.has(observationKey(o.iso3, o.year, o.dims))).toBe(false)
    }
  })

  it('returns identical results for identical queries', async () => {
    const a = await mockXMartClient.getObservations({ countries: ['THA'], years: [2019] })
    const b = await mockXMartClient.getObservations({ countries: ['THA'], years: [2019] })
    expect(a.totalCount).toBe(b.totalCount)
    expect(a.rows.map((o) => o.value)).toEqual(b.rows.map((o) => o.value))
  })

  it('records a push with its author, per UC046', async () => {
    const key = observationKey('CAN', 2023, { HF: 'HF.1.1' })
    const result = await mockXMartClient.putObservations([
      { observationKey: key, value: 12345, authorId: 'u-dmsadmin' },
    ])
    expect(result.accepted).toBe(1)
    expect(result.rejected).toBe(0)

    const call = getApiCalls()[0]!
    expect(call.direction).toBe('push')
    expect(call.params.authors).toBe('u-dmsadmin')
  })

  it('serves configuration data for every Setup tab (UC014)', async () => {
    const [countries, currencies, variables, crosses, formulas, metadata] = await Promise.all([
      mockXMartClient.getCountries(),
      mockXMartClient.getCurrencies(),
      mockXMartClient.getVariables(),
      mockXMartClient.getCrosses(),
      mockXMartClient.getFormulas(),
      mockXMartClient.getMetadataFields(),
    ])
    expect(countries).toHaveLength(194)
    expect(currencies.length).toBeGreaterThan(140)
    expect(variables.length).toBeGreaterThan(150)
    expect(crosses.length).toBeGreaterThan(10)
    // 16 predefined + the migrated legacy ones (UC060).
    expect(formulas.length).toBeGreaterThan(16)
    expect(metadata).toHaveLength(6)
    expect(getApiCalls()).toHaveLength(6)
  })

  it('applies a UC029 country override without touching other countries', async () => {
    const formulas = await mockXMartClient.getFormulas()
    const che = formulas.find((f) => f.code === 'CHE')!
    expect(che.countryOverrides.ARG).toBe('HF.1 + HF.2 + HF.3 + HF.4')
    expect(che.countryOverrides.CAN).toBeUndefined()
    expect(che.expression).toBe('HF.1 + HF.2 + HF.3 + HF.4 + HF.nec')
  })
})

describe('country metadata used by grouping (UC022)', () => {
  it('assigns every country a WHO region and income group', () => {
    for (const c of COUNTRIES) {
      expect(['AFR', 'AMR', 'SEAR', 'EUR', 'EMR', 'WPR']).toContain(c.GRP_WHO_REGION)
      expect(['LIC', 'LMC', 'UMC', 'HIC']).toContain(c.GRP_WB_INCOME)
    }
  })

  it('matches WHO regional membership counts', () => {
    const byRegion = new Map<string, number>()
    for (const c of COUNTRIES) {
      byRegion.set(c.GRP_WHO_REGION, (byRegion.get(c.GRP_WHO_REGION) ?? 0) + 1)
    }
    // WHO's actual distribution.
    expect(byRegion.get('AFR')).toBe(47)
    expect(byRegion.get('AMR')).toBe(35)
    expect(byRegion.get('SEAR')).toBe(11)
    expect(byRegion.get('EUR')).toBe(53)
    expect(byRegion.get('EMR')).toBe(21)
    expect(byRegion.get('WPR')).toBe(27)
  })

  it('knows Canada and can resolve its currency', () => {
    const can = COUNTRY_BY_ISO3.get('CAN')!
    expect(can.NAME_SHORT_EN).toBe('Canada')
    expect(can.GRP_WHO_REGION).toBe('AMR')
    expect(can.GRP_OECD).toBe(true)
    expect(CURRENCY_BY_CODE.get(can.CURRENCY_ISO_3)?.TITLE).toBe('Canadian Dollar')
  })
})
