/**
 * UC041 — the language packs.
 *
 * Coverage is a test rather than a type, on purpose. A `Record<VariableCode,
 * string>` would catch a missing label at compile time and report it as an
 * object-literal error hundreds of lines from the omission, in five files at
 * once; here a gap fails one assertion that names the language and the code.
 *
 * The strongest check in this file is the non-ASCII one. Copying an English line
 * into a pack and forgetting to translate it is the single most likely mistake
 * in 178 lines of content, and in Arabic, Chinese and Russian it is detectable
 * mechanically: a translated label cannot be pure ASCII. French and Spanish get
 * a ratio check instead, because a handful of labels genuinely coincide with the
 * English — `Population`, `Pharmacies`, `Malaria`, `Tuberculosis`.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import {
  DIMENSIONS,
  RTL_LANGUAGES,
  SCALES,
  UNITS,
  WB_INCOME_GROUPS,
  WHO_LANGUAGES,
  WHO_REGIONS,
  type WhoLanguage,
} from '@/domain/constants'
import {
  buildPivot,
  DEFAULT_PRESENTATION,
  ENGLISH_VOCABULARY,
  emptyReport,
  fillTemplate,
  pivotToGrid,
  placement,
  REPORT_AGGREGATIONS,
  REPORT_FIELDS,
  REPORT_UNITS,
  translateUnit,
  type ReportDataAccess,
  type ReportVocabulary,
} from '@/domain/report'
import { CLASSIFICATION_VARIABLES } from '@/data/seed/classifications'
import { LEGACY_FORMULAS, PREDEFINED_FORMULAS } from '@/data/seed/formulas'
import { loadReportVocabulary } from '@/data/seed/translations'

/* --------------------------------------------------------------------------
   Fixture
   -------------------------------------------------------------------------- */

/** Every language that must have a pack: the six of HLR21 minus the original. */
const TRANSLATED: WhoLanguage[] = WHO_LANGUAGES.filter((l) => l !== 'en')

/** Latin-script packs, where an untranslated line cannot be spotted by script. */
const LATIN: WhoLanguage[] = ['fr', 'es']

/** Every code a report can name a label for. */
const CODES = [
  ...CLASSIFICATION_VARIABLES.map((v) => v.code),
  ...PREDEFINED_FORMULAS.map((f) => f.code),
  ...LEGACY_FORMULAS.map((f) => f.code),
]

const ENGLISH_LABEL = new Map<string, string>([
  ...CLASSIFICATION_VARIABLES.map((v) => [v.code, v.label] as const),
  // A formula code that is also a variable keeps the variable's label, which is
  // the precedence `reportAccess.variableLabelOf` uses.
  ...PREDEFINED_FORMULAS.filter((f) => !CLASSIFICATION_VARIABLES.some((v) => v.code === f.code))
    .map((f) => [f.code, f.name] as const),
  ...LEGACY_FORMULAS.map((f) => [f.code, f.name] as const),
])

const PACKS = new Map<WhoLanguage, ReportVocabulary>()

beforeAll(async () => {
  for (const language of TRANSLATED) {
    PACKS.set(language, await loadReportVocabulary(language))
  }
})

function pack(language: WhoLanguage): ReportVocabulary {
  const found = PACKS.get(language)
  if (!found) throw new Error(`No pack loaded for ${language}`)
  return found
}

/**
 * True of a string with no character outside ASCII.
 *
 * A code-point walk rather than a regexp character class: the range escapes
 * in a class are easy to mangle when this file is edited by a tool, and a
 * silently broken class would make the untranslated-line check pass on
 * everything.
 */
function isAsciiOnly(text: string): boolean {
  for (const character of text) {
    if ((character.codePointAt(0) ?? 0) > 127) return false
  }
  return true
}

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

describe('UC041 — loading a language', () => {
  it('resolves English synchronously to the seeded original', async () => {
    await expect(loadReportVocabulary('en')).resolves.toBe(ENGLISH_VOCABULARY)
  })

  it('has a pack for every WHO language other than English', () => {
    for (const language of TRANSLATED) {
      expect(pack(language).language).toBe(language)
    }
  })

  it('falls back to English rather than throwing for an unknown language', async () => {
    // Not reachable from the UI; the guard exists so a stored parameter from an
    // older definition cannot make a report fail to run.
    const unknown = await loadReportVocabulary('xx' as WhoLanguage)
    expect(unknown).toBe(ENGLISH_VOCABULARY)
  })
})

/* --------------------------------------------------------------------------
   Variable labels — the bulk of the content
   -------------------------------------------------------------------------- */

describe('UC041 — variable and indicator labels', () => {
  it.each(TRANSLATED)('%s covers every classification and indicator code', (language) => {
    const missing = CODES.filter((code) => !pack(language).variables[code])
    expect(missing).toEqual([])
  })

  it.each(TRANSLATED)('%s has no blank label and never falls back to a code', (language) => {
    const bad = Object.entries(pack(language).variables).filter(
      ([code, label]) => label.trim().length === 0 || label === code,
    )
    expect(bad).toEqual([])
  })

  it.each(TRANSLATED)('%s translates no more codes than exist in the seed', (language) => {
    // A stale line — a code renamed in `classifications.ts` and left behind in a
    // pack — is dead weight that reads as coverage. Catch it here.
    const orphans = Object.keys(pack(language).variables).filter((c) => !CODES.includes(c))
    expect(orphans).toEqual([])
  })

  it.each(TRANSLATED.filter((l) => !LATIN.includes(l)))(
    '%s labels are all in their own script, so no English line survived',
    (language) => {
      const untranslated = Object.entries(pack(language).variables)
        .filter(([, label]) => isAsciiOnly(label))
        .map(([code]) => code)
      expect(untranslated).toEqual([])
    },
  )

  it.each(LATIN)('%s differs from the English label for almost every code', (language) => {
    const identical = CODES.filter(
      (code) => pack(language).variables[code] === ENGLISH_LABEL.get(code),
    )
    // `Population`, `Pharmacies`, `Malaria` and a few others coincide honestly.
    expect(identical.length / CODES.length).toBeLessThan(0.1)
  })
})

/* --------------------------------------------------------------------------
   The rest of the vocabulary
   -------------------------------------------------------------------------- */

describe('UC041 — headers, units and grouping labels', () => {
  it.each(TRANSLATED)('%s names every pivot field', (language) => {
    for (const field of REPORT_FIELDS) {
      // No inequality assertion: `Variable` and `Classification` are the same
      // word in French, and demanding a difference would force a worse label.
      expect(pack(language).fields[field]).toBeTruthy()
    }
  })

  it.each(TRANSLATED)('%s names every aggregation, scale and report unit', (language) => {
    const p = pack(language)
    for (const a of REPORT_AGGREGATIONS) expect(p.aggregations[a]).toBeTruthy()
    for (const s of SCALES) expect(p.scales[s]).toBeTruthy()
    for (const u of REPORT_UNITS) expect(p.reportUnits[u]).toBeTruthy()
  })

  it.each(TRANSLATED)('%s translates every unit of measure', (language) => {
    for (const unit of Object.values(UNITS)) {
      const translated = pack(language).units[unit]
      expect(translated).toBeTruthy()
      expect(translated).not.toBe(unit)
    }
  })

  it.each(TRANSLATED)('%s names every dimension, region, income group and OECD key', (language) => {
    const p = pack(language)
    for (const d of DIMENSIONS) expect(p.dimensions[d]).toBeTruthy()
    for (const r of WHO_REGIONS) expect(p.regions[r]).toBeTruthy()
    for (const i of WB_INCOME_GROUPS) expect(p.incomes[i]).toBeTruthy()
    for (const key of ['OECD', 'Non-OECD']) expect(p.oecd[key]).toBeTruthy()
  })
})

/* --------------------------------------------------------------------------
   Chrome — the words the report writes about itself
   -------------------------------------------------------------------------- */

describe('UC041 — report chrome', () => {
  it.each(TRANSLATED)('%s fills every chrome key', (language) => {
    const p = pack(language)
    const blank = Object.entries(p.chrome)
      .filter(([, v]) => typeof v !== 'string' || v.trim().length === 0)
      .map(([k]) => k)
    expect(blank).toEqual([])
    // Merged over English, so a pack can never be short of a key.
    expect(Object.keys(p.chrome).sort()).toEqual(Object.keys(ENGLISH_VOCABULARY.chrome).sort())
  })

  it.each(TRANSLATED)('%s keeps every template placeholder', (language) => {
    const c = pack(language).chrome
    expect(c.subtotalTemplate).toContain('{label}')
    expect(c.truncatedCoordinates).toContain('{max}')
    expect(c.truncatedRows).toContain('{dropped}')
    expect(c.truncatedRows).toContain('{total}')
    expect(c.truncatedRows).toContain('{max}')
    expect(c.notConvertedTemplate).toContain('{count}')
  })

  it.each(TRANSLATED)('%s sheet names are legal Excel tab names', (language) => {
    // SheetJS will not write a tab over 31 characters or containing []:*?/\ —
    // a translated name that trips this fails at download time, not here.
    for (const name of [pack(language).chrome.sheetReport, pack(language).chrome.sheetAbout]) {
      expect(name.length).toBeLessThanOrEqual(31)
      expect(name).not.toMatch(/[[\]:*?/\\]/)
    }
  })
})

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

describe('translateUnit', () => {
  it('translates a stored unit of measure', () => {
    expect(translateUnit(UNITS.PERCENT, pack('fr'))).toBe('Pourcentages')
  })

  it('translates only the scale word of a composed currency unit', () => {
    // `presentValue` composes this from the country's own currency, so it cannot
    // be enumerated — the currency code has to survive untouched.
    expect(translateUnit('CAD millions', pack('fr'))).toBe('CAD millions')
    expect(translateUnit('CAD millions', pack('ru'))).toBe('CAD млн')
    expect(translateUnit('US$ billions', pack('es'))).toBe('US$ miles de millones')
  })

  it('translates the count-cell unit', () => {
    expect(translateUnit('Values', pack('ru'))).toBe('Значения')
  })

  it('passes an unrecognised unit through rather than blanking it', () => {
    expect(translateUnit('Widgets per fortnight', pack('fr'))).toBe('Widgets per fortnight')
  })
})

describe('fillTemplate', () => {
  it('substitutes named placeholders', () => {
    expect(fillTemplate('Total {label}', { label: 'Soins curatifs' })).toBe(
      'Total Soins curatifs',
    )
  })

  it('leaves an unknown placeholder visible rather than emptying it', () => {
    expect(fillTemplate('{a} and {b}', { a: 'x' })).toBe('x and {b}')
  })
})

/* --------------------------------------------------------------------------
   End to end — a pivot actually comes back translated
   -------------------------------------------------------------------------- */

describe('UC041 — a run in another language', () => {
  /**
   * The same shape `reportAccess` builds, reduced to what a pivot reads: values
   * are constant so the assertions are about words, not arithmetic.
   */
  function accessFor(vocabulary: ReportVocabulary): ReportDataAccess {
    return {
      valueOf: () => 100,
      fieldKey: (field, c) => (field === 'year' ? String(c.year) : c.code),
      fieldLabel: (field, key) =>
        field === 'variable' ? (vocabulary.variables[key] ?? key) : key,
      unitOf: () => UNITS.NCU_MILLIONS,
      exchangeRate: () => 2,
      currencyOf: () => 'CAD',
    }
  }

  it('writes French chrome and French row labels', async () => {
    const vocabulary = await loadReportVocabulary('fr')
    const definition = {
      ...emptyReport('r-1', 'system', '2026-08-01T00:00:00.000Z'),
      rows: [placement('variable')],
      columns: [placement('year')],
      grandTotal: true,
    }

    const table = buildPivot({
      definition,
      countries: ['CAN'],
      years: [2021, 2022],
      codes: ['HF.1.1', 'HF.1.2'],
      presentation: { ...DEFAULT_PRESENTATION, language: 'fr' },
      data: accessFor(vocabulary),
      vocabulary,
    })

    expect(table.vocabulary.language).toBe('fr')
    expect(table.rows.map((r) => r.label)).toContain('Régimes publics')
    expect(table.rows.at(-1)?.label).toBe('Total général')
    expect(table.columnNodes.at(-1)?.label).toBe('Toutes les colonnes')

    // The exported rectangle carries the same words in the same cells.
    const grid = pivotToGrid(table)
    expect(grid.headerRows.at(-1)?.[0]).toBe('Variable')
    expect(grid.bodyRows.at(-1)?.[0]).toBe('Total général')

    // And the cell unit stays canonical English so the mixed-unit guard works.
    expect(table.units).toContain('CAD millions')
  })

  it('marks Arabic as translated labels without RTL layout', async () => {
    // The pack exists and is Arabic; the direction of the grid is not its job,
    // and the run page states the limit. Guarding the flag here keeps the two
    // claims from drifting apart.
    const vocabulary = await loadReportVocabulary('ar')
    expect(RTL_LANGUAGES).toContain('ar')
    expect(isAsciiOnly(vocabulary.chrome.grandTotal)).toBe(false)
  })
})
