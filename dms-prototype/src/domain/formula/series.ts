/**
 * Series arithmetic — HLR8's "filling data series" and "extrapolate for
 * previous and future values".
 *
 * A series here is one variable for one country across years: exactly the row
 * of a country workbook. Gaps are real and common — a country reports 2010 and
 * 2014 but nothing between — so every function below is written around holes
 * rather than assuming a dense array.
 *
 * Two rules hold throughout, and both are the same rule the null policy states:
 *
 *  · **Interpolation needs a known point on each side.** With only one side it
 *    returns blank and leaves the job to extrapolation, which is a different
 *    and more arguable operation that a user opts into.
 *  · **Extrapolation needs two known points** to establish a trend. One point
 *    is a level, not a direction; carrying it forward would invent a flat
 *    series and present it as data.
 */

export interface SeriesPoint {
  year: number
  value: number | null
}

export type ExtrapolationDirection = 'auto' | 'backward' | 'forward'
export type ExtrapolationMethod = 'linear' | 'cagr'

interface KnownPoint {
  year: number
  value: number
}

/** Build a series by reading one value per year. */
export function buildSeries(
  years: readonly number[],
  read: (year: number) => number | null,
): SeriesPoint[] {
  return years.map((year) => ({ year, value: read(year) }))
}

/** The reported points, ascending by year, holes removed. */
export function knownPoints(series: readonly SeriesPoint[]): KnownPoint[] {
  return series
    .filter((p): p is KnownPoint => p.value != null && Number.isFinite(p.value))
    .slice()
    .sort((a, b) => a.year - b.year)
}

export function valueAt(series: readonly SeriesPoint[], year: number): number | null {
  return series.find((p) => p.year === year)?.value ?? null
}

/* --------------------------------------------------------------------------
   Interpolation
   -------------------------------------------------------------------------- */

/**
 * Straight line between the nearest reported years either side of `year`.
 *
 * A year that already has a value returns it unchanged, so `INTERPOLATE(HF.1)`
 * is safe to apply across a whole row: it fills the holes and leaves the
 * reported figures alone.
 */
export function interpolateAt(series: readonly SeriesPoint[], year: number): number | null {
  const direct = valueAt(series, year)
  if (direct != null) return direct

  const points = knownPoints(series)
  let before: KnownPoint | undefined
  let after: KnownPoint | undefined
  for (const p of points) {
    if (p.year < year) before = p
    else if (p.year > year) {
      after = p
      break
    }
  }
  if (!before || !after) return null

  const span = after.year - before.year
  if (span === 0) return before.value
  const t = (year - before.year) / span
  const result = before.value + (after.value - before.value) * t
  return Number.isFinite(result) ? result : null
}

/* --------------------------------------------------------------------------
   Extrapolation
   -------------------------------------------------------------------------- */

/**
 * Project beyond the reported range.
 *
 * `linear` continues the slope of the two nearest reported points. `cagr`
 * continues their compound annual rate, which is the right shape for a
 * monetary series — but it requires both anchor values to be positive, so it
 * falls back to linear rather than returning blank when they are not. That
 * fallback is deliberate: a user who asked to extrapolate an expenditure series
 * that happens to contain a zero should get a number and a visible method, not
 * silence.
 */
export function extrapolateAt(
  series: readonly SeriesPoint[],
  year: number,
  direction: ExtrapolationDirection = 'auto',
  method: ExtrapolationMethod = 'linear',
): number | null {
  const direct = valueAt(series, year)
  if (direct != null) return direct

  const points = knownPoints(series)
  if (points.length < 2) return null

  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return null

  // Inside the reported range this is interpolation, whatever the caller asked.
  if (year > first.year && year < last.year) return interpolateAt(series, year)

  const goBackward = direction === 'backward' || (direction === 'auto' && year < first.year)
  if (direction === 'forward' && year < first.year) return null
  if (direction === 'backward' && year > last.year) return null

  // The anchor is the reported point nearest the target year; `other` is the
  // next one in, and the pair defines the trend that gets continued.
  const anchor = goBackward ? first : last
  const other = goBackward ? points[1] : points[points.length - 2]
  if (!other) return null

  const span = anchor.year - other.year
  if (span === 0) return anchor.value

  if (method === 'cagr' && anchor.value > 0 && other.value > 0) {
    const rate = Math.pow(anchor.value / other.value, 1 / span) - 1
    const result = anchor.value * Math.pow(1 + rate, year - anchor.year)
    return Number.isFinite(result) ? result : null
  }

  const slope = (anchor.value - other.value) / span
  const result = anchor.value + slope * (year - anchor.year)
  return Number.isFinite(result) ? result : null
}

/* --------------------------------------------------------------------------
   Whole-series fill (Phase 4's series tools)
   -------------------------------------------------------------------------- */

export interface FillOptions {
  /** Fill holes between reported years. */
  interpolate?: boolean
  /** Fill years before the first reported one. */
  extrapolateBackward?: boolean
  /** Fill years after the last reported one. */
  extrapolateForward?: boolean
  method?: ExtrapolationMethod
}

export interface FilledPoint extends SeriesPoint {
  /** How this point got its value — the preview in UC-scope series tools shows it. */
  origin: 'reported' | 'interpolated' | 'extrapolated' | 'blank'
}

/**
 * Fill a series, tagging every point with how it was obtained.
 *
 * The `origin` tag is not decoration: a filled value must never be
 * indistinguishable from a reported one, in the grid or in an export.
 */
export function fillSeries(
  series: readonly SeriesPoint[],
  options: FillOptions = {},
): FilledPoint[] {
  const {
    interpolate = true,
    extrapolateBackward = false,
    extrapolateForward = false,
    method = 'linear',
  } = options

  const points = knownPoints(series)
  const first = points[0]
  const last = points[points.length - 1]

  return series.map((p) => {
    if (p.value != null) return { ...p, origin: 'reported' }
    if (!first || !last) return { ...p, origin: 'blank' }

    if (p.year > first.year && p.year < last.year) {
      if (!interpolate) return { ...p, origin: 'blank' }
      const v = interpolateAt(series, p.year)
      return v == null ? { ...p, origin: 'blank' } : { year: p.year, value: v, origin: 'interpolated' }
    }

    const wantsBackward = p.year < first.year && extrapolateBackward
    const wantsForward = p.year > last.year && extrapolateForward
    if (!wantsBackward && !wantsForward) return { ...p, origin: 'blank' }

    const v = extrapolateAt(series, p.year, wantsBackward ? 'backward' : 'forward', method)
    return v == null ? { ...p, origin: 'blank' } : { year: p.year, value: v, origin: 'extrapolated' }
  })
}

/* --------------------------------------------------------------------------
   Growth
   -------------------------------------------------------------------------- */

/**
 * Percentage change, the form UC053's year-on-year rules compare against a
 * threshold. Blank when either end is missing, and blank rather than infinite
 * when the base is zero.
 */
export function growthPercent(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null
  const result = ((current - previous) / previous) * 100
  return Number.isFinite(result) ? result : null
}
