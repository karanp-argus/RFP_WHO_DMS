/**
 * Deterministic pseudo-randomness.
 *
 * Every generated value in the prototype derives from a hash of a stable string
 * key — never from `Math.random()`. Two consequences that matter:
 *
 *  1. The demo is identical on every machine and every reload, so the §6 script
 *     never drifts and screenshots stay reproducible.
 *  2. Observations can be derived *on demand* from `(iso3, year, variable)`
 *     rather than materialised up front. The store is a pure function plus a
 *     thin overlay of user edits, which is why a 25-million-row story is
 *     credible without holding 25 million objects in memory.
 */

/** FNV-1a, 32-bit. Fast, well-distributed for short keys. */
export function hashString(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    // h *= 16777619, kept in 32-bit range via Math.imul
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — small, fast, good statistical quality for seeded demo data. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A generator seeded from a string key. */
export function rngFor(key: string): () => number {
  return mulberry32(hashString(key))
}

/**
 * A single stable float in [0,1) for a key — no generator state to thread.
 * This is the workhorse: `unit('ARG|2021|HF.1')` is the same number forever.
 */
export function unit(key: string): number {
  return mulberry32(hashString(key))()
}

/** Stable float in [min,max). */
export function range(key: string, min: number, max: number): number {
  return min + unit(key) * (max - min)
}

/** Stable integer in [min,max] inclusive. */
export function int(key: string, min: number, max: number): number {
  return min + Math.floor(unit(key) * (max - min + 1))
}

/** Stable boolean, true with probability `p`. */
export function chance(key: string, p: number): boolean {
  return unit(key) < p
}

/** Stable pick from a non-empty array. */
export function pick<T>(key: string, items: readonly T[]): T {
  if (items.length === 0) throw new Error(`pick() on empty array for key "${key}"`)
  return items[Math.floor(unit(key) * items.length)]!
}

/**
 * Approximately standard-normal, via the mean of 4 uniforms (Bates).
 * Scaled to ~unit variance. Used to make time-series noise look organic
 * rather than uniformly jittery.
 */
export function gaussian(key: string): number {
  const r = rngFor(key)
  return ((r() + r() + r() + r() - 2) / 2) * 1.732
}

/** Deterministic shuffle — a seeded Fisher–Yates on a copy. */
export function shuffled<T>(key: string, items: readonly T[]): T[] {
  const out = items.slice()
  const r = rngFor(key)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const a = out[i]!
    const b = out[j]!
    out[i] = b
    out[j] = a
  }
  return out
}
