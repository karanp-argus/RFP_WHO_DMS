/**
 * Predefined and custom crosses.
 *
 * FR §1 defines a cross as classification categories crossed together, with
 * `HF.1xFS.1` as the worked example ("Compulsory and government schemes financed
 * through internal transfers"). Crosses are stored as multi-dimension tuples on
 * the observation, never as a separate entity — the `members` map here is a
 * *selector* over that tuple space, not an ID that observations point at.
 *
 * UC025 — predefined crosses are admin-authored and visible to all users.
 * UC026 — custom crosses are user-authored and scoped to specific countries.
 */

import { crossCode } from '@/domain/keys'
import type { Cross, Dimensions } from '@/domain/types'

interface Spec {
  members: Dimensions
  label: string
  scope: 'predefined' | 'custom'
  countryScope?: string[]
  createdBy?: string
}

/**
 * The standard cross tables the HA team works with. These mirror the axes that
 * appear in HAPT cross tables and in the SHA 2011 reporting framework: who pays
 * (HF) against what is bought (HC), who provides it (HP), and where the money
 * came from (FS).
 */
const SPECS: Spec[] = [
  {
    members: { HC: 'HC.1', HF: 'HF.1' },
    label: 'Curative care financed by government and compulsory schemes',
    scope: 'predefined',
  },
  {
    members: { HC: 'HC.1', HF: 'HF.3' },
    label: 'Curative care financed out-of-pocket',
    scope: 'predefined',
  },
  {
    members: { HC: 'HC.5', HF: 'HF.3' },
    label: 'Medical goods financed out-of-pocket',
    scope: 'predefined',
  },
  {
    members: { HC: 'HC.6', HF: 'HF.1' },
    label: 'Preventive care financed by government and compulsory schemes',
    scope: 'predefined',
  },
  {
    members: { HP: 'HP.1', HF: 'HF.1' },
    label: 'Hospitals financed by government and compulsory schemes',
    scope: 'predefined',
  },
  {
    members: { HP: 'HP.5', HF: 'HF.3' },
    label: 'Retailers of medical goods financed out-of-pocket',
    scope: 'predefined',
  },
  {
    // The FR's own example (FR §1).
    members: { FS: 'FS.1', HF: 'HF.1' },
    label: 'Compulsory and government schemes financed through internal transfers',
    scope: 'predefined',
  },
  {
    members: { FS: 'FS.2', HF: 'HF.1' },
    label: 'Government schemes financed by transfers of foreign origin',
    scope: 'predefined',
  },
  {
    members: { HC: 'HC.1', HP: 'HP.1' },
    label: 'Curative care delivered by hospitals',
    scope: 'predefined',
  },
  {
    members: { DIS: 'DIS.1.3', HF: 'HF.1' },
    label: 'Malaria financed by government and compulsory schemes',
    scope: 'predefined',
  },
  {
    members: { DIS: 'DIS.1.1', FS: 'FS.7' },
    label: 'HIV/AIDS financed by direct foreign transfers',
    scope: 'predefined',
  },
  {
    members: { DIS: 'DIS.2.1', HF: 'HF.1' },
    label: 'Maternal conditions financed by government and compulsory schemes',
    scope: 'predefined',
  },
  /* --- Custom crosses (UC026): scoped to individual countries --- */
  {
    members: { HC: 'HC.3', HF: 'HF.2.1' },
    label: 'Long-term care financed by voluntary health insurance',
    scope: 'custom',
    countryScope: ['CAN', 'FRA', 'DEU'],
    createdBy: 'u-dmsuser',
  },
  {
    members: { HC: 'HC.4.1', HP: 'HP.4.2' },
    label: 'Laboratory services delivered by diagnostic laboratories',
    scope: 'custom',
    countryScope: ['ARG'],
    createdBy: 'u-dmsuser',
  },
  {
    members: { DIS: 'DIS.4.3', AGE: 'AGE.5' },
    label: 'Cardiovascular disease expenditure, 70 years and over',
    scope: 'custom',
    countryScope: ['JPN', 'ITA'],
    createdBy: 'u-euro',
  },
]

export const SEED_CROSSES: readonly Cross[] = SPECS.map((s, i) => ({
  id: `x-${s.scope === 'predefined' ? 'pre' : 'cus'}-${String(i + 1).padStart(3, '0')}`,
  code: crossCode(s.members),
  label: s.label,
  members: s.members,
  scope: s.scope,
  countryScope: s.countryScope ?? [],
  createdBy: s.createdBy ?? 'system',
}))

export const PREDEFINED_CROSSES: readonly Cross[] = SEED_CROSSES.filter(
  (c) => c.scope === 'predefined',
)

export const CROSS_BY_CODE: ReadonlyMap<string, Cross> = new Map(
  SEED_CROSSES.map((c) => [c.code, c]),
)

/** Crosses visible for a country: all predefined, plus customs scoped to it. */
export function crossesForCountry(iso3: string): readonly Cross[] {
  return SEED_CROSSES.filter((c) => c.scope === 'predefined' || c.countryScope.includes(iso3))
}
