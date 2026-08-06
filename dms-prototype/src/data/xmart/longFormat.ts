/**
 * The xMart long-format row contract.
 *
 * Column order is transcribed from the FR's embedded screenshots (plan §1.3) and
 * must not be reordered: the Annex 3 CSV emits these columns in this sequence,
 * and "CSV is 1/3 the size of json and by definition tabular format" is the
 * RFP's stated reason for preferring it.
 *
 * `toLongFormat` / `fromLongFormat` are exact inverses — the round-trip is what
 * lets DMS pull a slice, edit it, and push it back (UC045/UC046) without any
 * shape drift.
 */

import { DIMENSIONS, METADATA_FIELDS } from '@/domain/constants'
import { parseSurveyFk } from '@/domain/keys'
import type { Dimensions, Observation, ObservationMetadata } from '@/domain/types'

/** Every column of the observation table, in xMart's order. */
export const LONG_FORMAT_COLUMNS = [
  'SURVEY_FK',
  ...DIMENSIONS,
  'VALUE',
  ...METADATA_FIELDS,
  'Sys_RowId',
  'Sys_Origin',
  'Sys_LoadBatchId',
  'Sys_CommitDateUtc',
  'Sys_FirstLoadUser',
  'Sys_ID',
  'Sys_BatchId',
  'Sys_FirstBatchID',
  'Sys_IsDeleted',
] as const

export type LongFormatColumn = (typeof LONG_FORMAT_COLUMNS)[number]

/** A single long-format row. Absent dimensions are empty strings, as in xMart. */
export type LongFormatRow = Record<LongFormatColumn, string | number | boolean | null>

export function toLongFormat(o: Observation): LongFormatRow {
  const row = {} as LongFormatRow

  row.SURVEY_FK = o.surveyFk
  for (const d of DIMENSIONS) row[d] = o.dims[d] ?? ''
  row.VALUE = o.value
  for (const f of METADATA_FIELDS) row[f] = o.metadata[f] ?? ''

  row.Sys_RowId = o.sys.Sys_RowId
  row.Sys_Origin = o.sys.Sys_Origin
  row.Sys_LoadBatchId = o.sys.Sys_LoadBatchId
  row.Sys_CommitDateUtc = o.sys.Sys_CommitDateUtc
  row.Sys_FirstLoadUser = o.sys.Sys_FirstLoadUser
  row.Sys_ID = o.sys.Sys_ID
  row.Sys_BatchId = o.sys.Sys_BatchId
  row.Sys_FirstBatchID = o.sys.Sys_FirstBatchID
  row.Sys_IsDeleted = o.sys.Sys_IsDeleted

  return row
}

export function fromLongFormat(row: LongFormatRow): Observation {
  const fk = String(row.SURVEY_FK ?? '')
  const parsed = parseSurveyFk(fk)
  if (!parsed) throw new Error(`Invalid SURVEY_FK in long-format row: "${fk}"`)

  const dims: Dimensions = {}
  for (const d of DIMENSIONS) {
    const v = row[d]
    if (v != null && v !== '') dims[d] = String(v)
  }

  const metadata: ObservationMetadata = {}
  for (const f of METADATA_FIELDS) {
    const v = row[f]
    if (v != null && v !== '') metadata[f] = String(v)
  }

  const rawValue = row.VALUE
  return {
    surveyFk: fk,
    iso3: parsed.iso3,
    year: parsed.year,
    dims,
    value: rawValue == null || rawValue === '' ? null : Number(rawValue),
    metadata,
    // Publishing status is DMS-side, not an xMart column — it defaults on the
    // way in and is carried separately when DMS pushes changes back.
    publishingStatus: 'not-publish',
    sys: {
      Sys_RowId: String(row.Sys_RowId ?? ''),
      Sys_Origin: String(row.Sys_Origin ?? ''),
      Sys_LoadBatchId: Number(row.Sys_LoadBatchId ?? 0),
      Sys_CommitDateUtc: String(row.Sys_CommitDateUtc ?? ''),
      Sys_FirstLoadUser: String(row.Sys_FirstLoadUser ?? ''),
      Sys_ID: String(row.Sys_ID ?? ''),
      Sys_BatchId: Number(row.Sys_BatchId ?? 0),
      Sys_FirstBatchID: Number(row.Sys_FirstBatchID ?? 0),
      Sys_IsDeleted: row.Sys_IsDeleted === true || row.Sys_IsDeleted === 'true',
    },
  }
}

/**
 * Serialise rows to CSV in the Annex 3 shape.
 *
 * Annex 3 mandates CSV output, an internal ID (`Sys_ID`) "for later linking back
 * to the DMS", and a UTC last-modified stamp (`Sys_CommitDateUtc`) — all three
 * are columns above, so nothing extra is needed here beyond correct quoting.
 */
export function toCsv(rows: readonly LongFormatRow[]): string {
  const esc = (v: string | number | boolean | null): string => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const lines: string[] = [LONG_FORMAT_COLUMNS.join(',')]
  for (const r of rows) {
    lines.push(LONG_FORMAT_COLUMNS.map((c) => esc(r[c])).join(','))
  }
  // CRLF: Annex 3 consumers are Windows/xMart tooling.
  return lines.join('\r\n')
}
