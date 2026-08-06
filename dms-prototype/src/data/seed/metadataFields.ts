/**
 * Observation metadata field definitions (UC027).
 *
 * The five observation fields are the ones visible in the FR's long-format
 * screenshots. UC027 requires the Metadata screen to show "2 different areas"
 * — observations and old-DMS formulas — and three field types: free text, date,
 * and list of values. The LOV contents for EST_METHOD and DATA_TYPE are taken
 * from the values actually appearing in the screenshots ("Derived as Estimated",
 * "Derived by ...", "Estimated", "Partially Derived").
 */

import type { MetadataFieldDef } from '@/domain/types'

export const METADATA_FIELD_DEFS: readonly MetadataFieldDef[] = [
  {
    code: 'SOURCES',
    label: 'Sources',
    type: 'text',
    area: 'observation',
    order: 0,
  },
  {
    code: 'COMMENT',
    label: 'Comment',
    type: 'text',
    area: 'observation',
    order: 1,
  },
  {
    code: 'WEB_LINK',
    label: 'Web link',
    type: 'text',
    area: 'observation',
    order: 2,
  },
  {
    code: 'EST_METHOD',
    label: 'Method of estimation',
    type: 'lov',
    lov: [
      'Reported by country',
      'Derived as Estimated',
      'Derived by WHO',
      'Derived from national accounts',
      'Interpolated',
      'Extrapolated',
    ],
    area: 'observation',
    order: 3,
  },
  {
    code: 'DATA_TYPE',
    label: 'Data type',
    type: 'lov',
    lov: ['Reported', 'Estimated', 'Partially Derived', 'Provisional'],
    area: 'observation',
    order: 4,
  },
  {
    // UC060: the migrated old-DMS formula, held as plain text for reference.
    code: 'OLD_DMS_FORMULA',
    label: 'Old DMS formula (migrated)',
    type: 'text',
    area: 'old-dms-formula',
    order: 5,
  },
]

export const METADATA_FIELD_BY_CODE: ReadonlyMap<string, MetadataFieldDef> = new Map(
  METADATA_FIELD_DEFS.map((f) => [f.code, f]),
)

/** Observation-area fields in display order — the default MetadataDrawer order. */
export const OBSERVATION_METADATA_FIELDS: readonly MetadataFieldDef[] =
  METADATA_FIELD_DEFS.filter((f) => f.area === 'observation').sort((a, b) => a.order - b.order)
