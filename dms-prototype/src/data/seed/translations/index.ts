/**
 * UC041 — loading a report's language.
 *
 * **Every pack is behind a dynamic `import()`, and that is a hard requirement,
 * not a preference.** The classification seed is reached from `mockClient`,
 * which `index.html` references directly: inlining five languages of variable
 * labels into it would put roughly 100 kB of text on the sign-in screen, where
 * nothing can use it. The critical path is at 225 kB gzipped against a 250 kB
 * budget, so `audit:bundle` would have failed the moment it went in. Reports are
 * a lazy route and a language is chosen there, one at a time — which is exactly
 * the shape a dynamic import serves.
 *
 * The `switch` is literal rather than `import('./' + language)` for the same
 * reason: a template gives the bundler a glob, and a glob loads all five packs
 * to satisfy a request for one.
 *
 * English is not a pack. Its labels are the seeded records themselves, so
 * `ENGLISH_VOCABULARY` resolves synchronously and carries empty override maps —
 * one source of truth instead of a copy that can drift from the seed.
 */

import { ENGLISH_VOCABULARY, type ReportVocabulary } from '@/domain/report'
import type { WhoLanguage } from '@/domain/constants'
import type { LanguagePack } from './types'

/**
 * A pack is parsed once per session. Runs are frequent — the builder previews on
 * every edit — and reparsing 178 lines each time is waste that shows up as a
 * stutter in the one interaction UC041 is judged on.
 */
const CACHE = new Map<WhoLanguage, ReportVocabulary>()

/** `HF.1.1|Régimes publics` → one entry. Blank lines are skipped. */
function parseVariables(block: string, language: WhoLanguage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of block.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const i = line.indexOf('|')
    if (i < 1 || i === line.length - 1) {
      throw new Error(`Malformed ${language} variable translation: "${line}"`)
    }
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

/**
 * Merge a pack over English.
 *
 * The spread order is the whole point: a key the pack does not carry keeps its
 * English value, so a variable added to the classification seed after the packs
 * were written appears under its English name in a French report rather than as
 * a blank column of numbers with no row labels.
 */
function toVocabulary(pack: LanguagePack): ReportVocabulary {
  return {
    language: pack.language,
    chrome: { ...ENGLISH_VOCABULARY.chrome, ...pack.chrome },
    fields: { ...ENGLISH_VOCABULARY.fields, ...pack.fields },
    aggregations: { ...ENGLISH_VOCABULARY.aggregations, ...pack.aggregations },
    scales: { ...ENGLISH_VOCABULARY.scales, ...pack.scales },
    reportUnits: { ...ENGLISH_VOCABULARY.reportUnits, ...pack.reportUnits },
    units: { ...ENGLISH_VOCABULARY.units, ...pack.units },
    variables: parseVariables(pack.variables, pack.language),
    dimensions: { ...ENGLISH_VOCABULARY.dimensions, ...pack.dimensions },
    regions: { ...ENGLISH_VOCABULARY.regions, ...pack.regions },
    incomes: { ...ENGLISH_VOCABULARY.incomes, ...pack.incomes },
    oecd: { ...ENGLISH_VOCABULARY.oecd, ...pack.oecd },
  }
}

async function importPack(language: WhoLanguage): Promise<LanguagePack | null> {
  switch (language) {
    case 'fr':
      return (await import('./fr')).default
    case 'es':
      return (await import('./es')).default
    case 'ru':
      return (await import('./ru')).default
    case 'zh':
      return (await import('./zh')).default
    case 'ar':
      return (await import('./ar')).default
    default:
      return null
  }
}

/**
 * The report vocabulary for one language.
 *
 * Never rejects on a missing pack: a language with no translations falls back to
 * English, because a report that fails to run is worse than a report whose
 * labels are in the wrong language and says so.
 */
export async function loadReportVocabulary(
  language: WhoLanguage,
): Promise<ReportVocabulary> {
  if (language === 'en') return ENGLISH_VOCABULARY

  const hit = CACHE.get(language)
  if (hit) return hit

  const pack = await importPack(language)
  if (!pack) return ENGLISH_VOCABULARY

  const vocabulary = toVocabulary(pack)
  CACHE.set(language, vocabulary)
  return vocabulary
}

/** Test-only door onto the merge, so a pack can be checked without a bundler. */
export { parseVariables, toVocabulary }
export type { LanguagePack }
