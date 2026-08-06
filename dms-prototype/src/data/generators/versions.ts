/**
 * Version history generation (UC043 / UC044).
 *
 * UC044 is explicit about the bound: "Regular user can view up to 10 versions of
 * an observation or variable ... can compare up to 10 versions ... can select one
 * of the past 10 versions and restore it as current."
 *
 * Versions are derived from the same seeded hash as the current value, so the
 * history is stable and the compare/restore beat in the demo behaves identically
 * every time. Countries resubmit whole time series (HLR17: "countries can
 * resubmit all the timeseries"), so version counts cluster — a country-year that
 * has been revised often has been revised across many of its variables.
 */

import { DEMO_NOW } from '@/domain/constants'
import type { ObservationMetadata, ObservationVersion } from '@/domain/types'
import { chance, int, pick, range } from './seedRandom'

export const MAX_VERSIONS = 10

const AUTHORS = [
  'xmart.loader@who.int',
  'dmsadmin@who.int',
  'dmsuser@who.int',
  'ha.analyst.euro@who.int',
  'ha.analyst.searo@who.int',
] as const

const REVISION_REASONS = [
  'Resubmission from country',
  'Methodology revision applied',
  'Corrected currency scale',
  'Reclassified between categories',
  'Audit adjustment',
  'Interpolated value replaced by reported figure',
] as const

/**
 * How many prior versions an observation has.
 *
 * Most have none — a flat history on every cell would be unrealistic and would
 * make the version marker meaningless in the workbook. Roughly a fifth carry
 * revisions, and a small number are heavily revised so the 10-version cap is
 * actually reachable in the demo.
 */
export function versionCount(observationKey: string): number {
  if (!chance(`vc.has|${observationKey}`, 0.22)) return 0
  // Heavily-revised tail.
  if (chance(`vc.many|${observationKey}`, 0.12)) return int(`vc.n2|${observationKey}`, 6, MAX_VERSIONS)
  return int(`vc.n1|${observationKey}`, 1, 4)
}

/**
 * Prior versions for one observation, oldest first.
 *
 * Values walk backwards from the current one by successively larger revisions,
 * so the diff view shows a plausible convergence rather than random numbers.
 * The current value is NOT included — these are strictly prior states.
 */
export function buildVersions(
  observationKey: string,
  currentValue: number | null,
  currentMetadata: ObservationMetadata,
): ObservationVersion[] {
  const n = versionCount(observationKey)
  if (n === 0) return []

  const out: ObservationVersion[] = []
  let value = currentValue

  // Walk back from the present, then reverse into chronological order.
  for (let i = 0; i < n; i++) {
    const k = `${observationKey}|v${i}`
    // Older versions differ more from the current figure.
    const spread = 0.03 + i * 0.02
    value =
      value == null
        ? null
        : Math.max(0, value * (1 + range(`vv|${k}`, -spread, spread)))

    const daysBack = 40 + i * int(`vd|${k}`, 55, 150)
    const commit = new Date(DEMO_NOW.getTime() - daysBack * 86_400_000)

    out.push({
      observationKey,
      // Filled in after the reverse, so numbering is chronological.
      versionNumber: 0,
      value,
      metadata: {
        ...currentMetadata,
        COMMENT: pick(`vr|${k}`, REVISION_REASONS),
      },
      commitDateUtc: commit.toISOString(),
      author: pick(`va|${k}`, AUTHORS),
      batchId: int(`vb|${k}`, 700_000, 859_999),
    })
  }

  out.reverse()
  out.forEach((v, i) => {
    v.versionNumber = i + 1
  })
  return out
}
