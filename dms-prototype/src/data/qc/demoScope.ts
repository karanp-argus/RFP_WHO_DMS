/**
 * The curated country set a quality-check run opens on.
 *
 * **Why this exists rather than a WHO region.** PROTOTYPE_PLAN's Phase 5
 * acceptance was written as *"running the full predefined set over EURO
 * produces a report with real findings that trace back to the defects planted
 * in Phase 1"*. It cannot: the fourteen defect countries were chosen in Phase 1
 * and not one of them is in the European Region. A EURO run does produce real
 * findings — reconciliation breaks, version drift, reporting gaps and outliers
 * all arise from the generator's own variation — but none of them trace to a
 * planted defect, so the beat the plan describes would not land.
 *
 * The scope below is the correction: every country carrying a declared defect,
 * plus enough peers that each grouping attribute forms a real comparison
 * population. Running by region, income group or OECD membership is unchanged
 * and fully supported from the run dialog — this is a starting point, not a
 * restriction, and the plan's Phase 5 outcome records the revision.
 *
 * **The peers are not padding.** UC053's outlier rules compare a country
 * against a peer group, and a group needs at least five members before "far
 * from the median" describes the country rather than the group's size. Every
 * WHO region and every World Bank income group in this set clears that bar.
 */

import { DEFECT_COUNTRIES } from '../generators/defects'
import { COUNTRY_BY_ISO3 } from '../seed/countries'

/**
 * Peer countries, chosen to fill out the grouping attributes.
 *
 * Picked by hand rather than sampled, per PROTOTYPE_PLAN §7's mitigation for
 * "demo data looks synthetic": these are countries an HA audience knows, and
 * seeing them beside the defect countries is what makes a regional median read
 * as a real comparison rather than an arbitrary one.
 */
const PEER_COUNTRIES = [
  // High income — the OECD comparison group.
  'CAN', 'GBR', 'FRA', 'DEU', 'JPN', 'USA', 'ITA', 'ESP', 'AUS', 'KOR',
  // Upper middle income.
  'BRA', 'MEX', 'COL', 'MYS', 'TUR', 'CHN', 'RUS', 'ROU',
  // Lower middle income.
  'IND', 'PHL', 'EGY', 'MAR', 'UKR', 'UZB', 'JOR', 'TUN',
  // Low income.
  'UGA', 'TZA', 'NPL', 'MWI', 'RWA', 'AFG',
]

/**
 * The default run scope: defect countries first, then peers, ISO3-sorted within
 * each block so the order is stable across runs and screenshots.
 *
 * Filtered against the seeded country list, so a typo here produces a smaller
 * scope rather than a run that asks xMart for a country that does not exist.
 */
export const QC_DEMO_COUNTRIES: readonly string[] = [
  ...[...DEFECT_COUNTRIES].sort(),
  ...[...PEER_COUNTRIES].sort(),
].filter((iso3, i, all) => all.indexOf(iso3) === i && COUNTRY_BY_ISO3.has(iso3))

export const QC_DEMO_SCOPE_LABEL = 'Quality Checks demo set'

export const QC_DEMO_SCOPE_HINT =
  'Every country carrying a known data defect, plus peers so each region and income group forms a real comparison group.'
