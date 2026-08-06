/**
 * Workbook selection ⇄ URL search params.
 *
 * Plan §2.4 makes this a requirement rather than a nicety: the filter chips
 * that replace the legacy filter-dropdown row **serialise to the URL**, so a
 * workbook selection is a shareable link. It is also the mechanism behind the
 * Phase 8 `?scenario=` demo shortcuts, so the format has to survive being
 * written by hand.
 *
 * Shape, chosen to stay readable in an address bar:
 *
 *     /workbooks/view?c=CAN&v=HF.1,HF.2,HF.3&y=2000-2024&type=country
 *                    &f=country:GRP_WHO_REGION:EUR~AMR
 *
 * Years collapse to `2000-2024` when contiguous and list individually when not,
 * because a 25-year comma list is the difference between a link someone will
 * paste into an email and one they will not.
 *
 * Pure — takes and returns `URLSearchParams`, never touches `window`.
 */

import type { AttributeFilter, WorkbookSelection, WorkbookType } from './shape'
import { AXES, type AxisId } from './shape'

const PARAM = {
  countries: 'c',
  variables: 'v',
  years: 'y',
  type: 'type',
  filter: 'f',
} as const

/** `~` separates filter values: `,` is taken and `|` is ugly when encoded. */
const FILTER_VALUE_SEPARATOR = '~'

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

export function selectionToSearchParams(
  selection: WorkbookSelection,
  type?: WorkbookType,
): URLSearchParams {
  const params = new URLSearchParams()
  if (selection.countries.length > 0) params.set(PARAM.countries, selection.countries.join(','))
  if (selection.variables.length > 0) params.set(PARAM.variables, selection.variables.join(','))
  if (selection.years.length > 0) params.set(PARAM.years, encodeYears(selection.years))
  if (type) params.set(PARAM.type, type)

  // One `f` entry per filter, so removing a chip is removing one param value.
  for (const filter of selection.filters) {
    params.append(
      PARAM.filter,
      `${filter.axis}:${filter.key}:${filter.values.join(FILTER_VALUE_SEPARATOR)}`,
    )
  }
  return params
}

/** `[2000…2024]` → `2000-2024`; `[2000,2005]` → `2000,2005`. */
export function encodeYears(years: readonly number[]): string {
  if (years.length === 0) return ''
  const sorted = [...new Set(years)].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first == null || last == null) return ''
  if (sorted.length > 2 && last - first + 1 === sorted.length) return `${first}-${last}`
  return sorted.join(',')
}

export function decodeYears(text: string): number[] {
  const out = new Set<number>()
  for (const part of text.split(',')) {
    const trimmed = part.trim()
    if (trimmed === '') continue
    const range = /^(\d{4})-(\d{4})$/.exec(trimmed)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
        for (let y = from; y <= to; y++) out.add(y)
      }
      continue
    }
    const single = Number(trimmed)
    if (Number.isFinite(single)) out.add(single)
  }
  return [...out].sort((a, b) => a - b)
}

/* --------------------------------------------------------------------------
   Reading
   -------------------------------------------------------------------------- */

export interface ParsedSelection {
  selection: WorkbookSelection
  type: WorkbookType | null
}

/**
 * Read a selection back out of the URL.
 *
 * Deliberately forgiving — a hand-written or truncated link should open the
 * part it can rather than erroring, because the alternative during a demo is a
 * blank screen. Unknown axes and malformed filters are dropped silently; the
 * pickers then show what did survive.
 */
export function selectionFromSearchParams(params: URLSearchParams): ParsedSelection {
  const list = (key: string): string[] =>
    (params.get(key) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')

  const rawType = params.get(PARAM.type)
  const type = AXES.includes(rawType as AxisId) ? (rawType as WorkbookType) : null

  const filters: AttributeFilter[] = []
  for (const raw of params.getAll(PARAM.filter)) {
    const parsed = parseFilter(raw)
    if (parsed) filters.push(parsed)
  }

  return {
    selection: {
      countries: list(PARAM.countries),
      variables: list(PARAM.variables),
      years: decodeYears(params.get(PARAM.years) ?? ''),
      filters,
    },
    type,
  }
}

function parseFilter(raw: string): AttributeFilter | null {
  const firstColon = raw.indexOf(':')
  const secondColon = raw.indexOf(':', firstColon + 1)
  if (firstColon < 0 || secondColon < 0) return null

  const axis = raw.slice(0, firstColon) as AxisId
  if (!AXES.includes(axis)) return null

  const key = raw.slice(firstColon + 1, secondColon)
  const values = raw
    .slice(secondColon + 1)
    .split(FILTER_VALUE_SEPARATOR)
    .map((v) => v.trim())
    .filter((v) => v !== '')

  if (key === '' || values.length === 0) return null
  // `label` is cosmetic and is re-derived from the attribute definitions on
  // arrival — a URL should not have to carry display text.
  return { axis, key, label: key, values }
}
