/**
 * In-memory log of every simulated xMart call.
 *
 * This exists to make the mock/real boundary visible rather than hidden. The
 * header's Dev drawer renders it live, so a demo can show that DMS pulls its
 * data across an API (UC045) and pushes edits back (UC046) — including the
 * request shape, the row count and the latency — instead of asserting it.
 *
 * Being honest about what is simulated is worth more in a WHO evaluation than
 * appearing to be further along than we are.
 */

import { DEMO_NOW } from '@/domain/constants'

export type ApiDirection = 'pull' | 'push'

export interface ApiCall {
  id: number
  /** Sequence within the session, for stable ordering. */
  seq: number
  direction: ApiDirection
  /** Client method invoked, e.g. `getObservations`. */
  method: string
  /** The HTTP shape this would take against the real xMart API. */
  request: string
  params: Record<string, unknown>
  rowCount: number
  durationMs: number
  /** Wall-clock, for a relative "3s ago" in the drawer. */
  at: number
  status: 'ok' | 'error'
  error?: string
}

type Listener = (calls: readonly ApiCall[]) => void

const MAX_ENTRIES = 200

let seq = 0
let calls: ApiCall[] = []
const listeners = new Set<Listener>()

function emit(): void {
  const snapshot = calls
  for (const l of listeners) l(snapshot)
}

export function logApiCall(entry: Omit<ApiCall, 'id' | 'seq' | 'at'>): void {
  seq += 1
  const call: ApiCall = { ...entry, id: seq, seq, at: Date.now() }
  // Newest first, bounded — the drawer is a tail, not an archive.
  calls = [call, ...calls].slice(0, MAX_ENTRIES)
  emit()
}

export function getApiCalls(): readonly ApiCall[] {
  return calls
}

export function clearApiLog(): void {
  calls = []
  emit()
}

export function subscribeApiLog(listener: Listener): () => void {
  listeners.add(listener)
  listener(calls)
  return () => listeners.delete(listener)
}

/**
 * Render a query as the URL the real Annex 3 / xMart API would receive.
 * Used both by the Dev drawer and by the Retrieval API page (Phase 7).
 */
export function buildRequestUrl(
  path: string,
  params: Record<string, unknown>,
  base = 'https://extranet.who.int/xmart-api/odata/HEALTH_ACCOUNTS',
): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`)
    .join('&')
  return qs ? `${base}/${path}?${qs}` : `${base}/${path}`
}

/** Fixed reference point for "as of" labels, so the demo reads consistently. */
export const API_LOG_EPOCH = DEMO_NOW
