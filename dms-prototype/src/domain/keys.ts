/**
 * Key construction and parsing.
 *
 * `SURVEY_FK` is xMart's country × year key (`ARG-2021`, `CAN-2023`), observed
 * in the FR long-format screenshots. Everything that identifies an observation
 * derives from it plus the sparse dimension tuple — see plan §1.3.
 */

import { DIMENSIONS, type DimensionCode } from './constants'
import type { Dimensions } from './types'

/** `('ARG', 2021)` → `'ARG-2021'`. */
export function surveyFk(iso3: string, year: number): string {
  return `${iso3}-${year}`
}

/** `'ARG-2021'` → `{ iso3: 'ARG', year: 2021 }`, or null if malformed. */
export function parseSurveyFk(fk: string): { iso3: string; year: number } | null {
  const m = /^([A-Z]{3})-(\d{4})$/.exec(fk)
  if (!m?.[1] || !m[2]) return null
  return { iso3: m[1], year: Number(m[2]) }
}

/**
 * Canonical string form of a dimension tuple.
 *
 * Emitted in `DIMENSIONS` order so the same tuple always produces the same
 * string regardless of insertion order — `{HF:'HF.1', HC:'HC.1'}` and
 * `{HC:'HC.1', HF:'HF.1'}` are the same observation and must key identically.
 * A single-dimension tuple gives `HF=HF.1`; a cross gives `HC=HC.1|HF=HF.1`.
 */
export function dimsKey(dims: Dimensions): string {
  const parts: string[] = []
  for (const d of DIMENSIONS) {
    const v = dims[d]
    if (v != null && v !== '') parts.push(`${d}=${v}`)
  }
  return parts.join('|')
}

/**
 * Stable identity of one observation: `ARG-2021#HF=HF.1`.
 *
 * Used as the map key in the mock store, the version lookup key, and the
 * `Sys_ID` seed. Deterministic, so it is safe to regenerate.
 */
export function observationKey(iso3: string, year: number, dims: Dimensions): string {
  return `${surveyFk(iso3, year)}#${dimsKey(dims)}`
}

/** Split an observation key back into its parts. */
export function parseObservationKey(
  key: string,
): { iso3: string; year: number; dims: Dimensions } | null {
  const hash = key.indexOf('#')
  if (hash < 0) return null
  const parsed = parseSurveyFk(key.slice(0, hash))
  if (!parsed) return null

  const dims: Dimensions = {}
  const tail = key.slice(hash + 1)
  if (tail) {
    for (const pair of tail.split('|')) {
      const eq = pair.indexOf('=')
      if (eq < 0) return null
      const d = pair.slice(0, eq) as DimensionCode
      if (!DIMENSIONS.includes(d)) return null
      dims[d] = pair.slice(eq + 1)
    }
  }
  return { ...parsed, dims }
}

/**
 * Standard cross notation for a dimension tuple: `HC.1xHF.1`.
 *
 * FR §1 gives `HF.1xFS.1` as the canonical example. Members are ordered by
 * `DIMENSIONS` so the notation is stable.
 */
export function crossCode(dims: Dimensions): string {
  const parts: string[] = []
  for (const d of DIMENSIONS) {
    const v = dims[d]
    if (v != null && v !== '') parts.push(v)
  }
  return parts.join('x')
}

/** How many dimensions a tuple spans. 1 = plain category, ≥2 = a cross. */
export function dimensionCount(dims: Dimensions): number {
  let n = 0
  for (const d of DIMENSIONS) {
    const v = dims[d]
    if (v != null && v !== '') n++
  }
  return n
}

export function isCross(dims: Dimensions): boolean {
  return dimensionCount(dims) >= 2
}

/**
 * The single dimension member of a plain (non-cross) tuple, or null.
 * Lets workbook code treat `{HF:'HF.1'}` as simply the variable `HF.1`.
 */
export function soleMember(dims: Dimensions): string | null {
  let found: string | null = null
  for (const d of DIMENSIONS) {
    const v = dims[d]
    if (v != null && v !== '') {
      if (found !== null) return null
      found = v
    }
  }
  return found
}
