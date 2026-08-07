/**
 * Phase 7 — Annex 3 and the To-Be architecture.
 *
 * The checklist is a scored exhibit, so the tests treat it as one: every
 * mandatory row must be present, must state an answer, and must declare
 * honestly whether the prototype demonstrates it or commits to it. A row that
 * quietly claimed `demonstrated` for OAuth would be the single most damaging
 * thing on the page.
 */

import { describe, expect, it } from 'vitest'
import {
  ANNEX3_MANDATORY_COUNT,
  ANNEX3_REQUIREMENTS,
  ARCHITECTURE_FLOWS,
  ARCHITECTURE_NODES,
  DEFAULT_RETRIEVAL_PARAMS,
  RETRIEVAL_DEFAULT_PAGE_SIZE,
  SYNC_SOURCES,
  retrievalCurl,
  retrievalHeaders,
  retrievalProblems,
  retrievalQueryPairs,
  retrievalUrl,
  syncHealth,
  type RetrievalParams,
} from '@/domain/integration'

function params(partial: Partial<RetrievalParams> = {}): RetrievalParams {
  return { ...DEFAULT_RETRIEVAL_PARAMS, ...partial }
}

describe('the Annex 3 checklist', () => {
  it('carries all ten mandatory rows', () => {
    expect(ANNEX3_MANDATORY_COUNT).toBe(10)
  })

  it('gives every row a requirement, an answer and an evidence level', () => {
    for (const r of ANNEX3_REQUIREMENTS) {
      expect(r.requirement.length).toBeGreaterThan(10)
      expect(r.answer.length).toBeGreaterThan(20)
      expect(['demonstrated', 'design']).toContain(r.evidence)
    }
  })

  it('has unique ids', () => {
    const ids = ANNEX3_REQUIREMENTS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('marks the two rows a browser cannot exhibit as design commitments', () => {
    // OAuth needs an auth server and HTTPS is a deployment property. Claiming
    // either as demonstrated is the dishonesty this test exists to prevent.
    const byId = new Map(ANNEX3_REQUIREMENTS.map((r) => [r.id, r]))
    expect(byId.get('a3-oauth')?.evidence).toBe('design')
    expect(byId.get('a3-https')?.evidence).toBe('design')
    // Everything else mandatory is shown on the page.
    const shown = ANNEX3_REQUIREMENTS.filter(
      (r) => r.category === 'mandatory' && r.evidence === 'demonstrated',
    )
    expect(shown).toHaveLength(8)
  })
})

describe('the request builder', () => {
  it('defaults to CSV, page 1 and 100,000 rows', () => {
    expect(DEFAULT_RETRIEVAL_PARAMS.format).toBe('csv')
    expect(DEFAULT_RETRIEVAL_PARAMS.pageSize).toBe(RETRIEVAL_DEFAULT_PAGE_SIZE)
    const url = retrievalUrl(DEFAULT_RETRIEVAL_PARAMS)
    expect(url).toContain('pageSize=100000')
    expect(url).toContain('format=csv')
  })

  it('is HTTPS and hits one resource', () => {
    expect(retrievalUrl(params())).toMatch(/^https:\/\//)
    expect(retrievalUrl(params())).toContain('/observations?')
  })

  it('omits filters that are not set', () => {
    const keys = retrievalQueryPairs(params()).map(([k]) => k)
    expect(keys).not.toContain('country')
    expect(keys).not.toContain('yearFrom')
    expect(keys).not.toContain('modifiedSince')
    // Absent and `false` mean the same thing; the shorter URL is checkable.
    expect(keys).not.toContain('includeDeleted')
  })

  it('emits the business primary keys when they are set', () => {
    const pairs = Object.fromEntries(
      retrievalQueryPairs(params({ countries: ['CAN', 'ARG'], yearFrom: 2015, yearTo: 2020 })),
    )
    expect(pairs.country).toBe('CAN,ARG')
    expect(pairs.yearFrom).toBe('2015')
    expect(pairs.yearTo).toBe('2020')
  })

  it('encodes a modifiedSince timestamp', () => {
    const url = retrievalUrl(params({ modifiedSince: '2026-01-01T00:00:00Z' }))
    expect(url).toContain('modifiedSince=2026-01-01T00%3A00%3A00Z')
  })

  it('produces a curl with a bearer placeholder, never a fabricated token', () => {
    const curl = retrievalCurl(params())
    expect(curl).toContain('Authorization: Bearer $ACCESS_TOKEN')
    expect(curl).toContain("Accept: text/csv")
  })

  it('rejects an inverted year range and an out-of-bounds page size', () => {
    expect(retrievalProblems(params({ yearFrom: 2020, yearTo: 2015 }))).toHaveLength(1)
    expect(retrievalProblems(params({ pageSize: 0 }))).toHaveLength(1)
    expect(retrievalProblems(params({ pageSize: 9_000_000 }))).toHaveLength(1)
    expect(retrievalProblems(params({ page: 0 }))).toHaveLength(1)
    expect(retrievalProblems(params({ modifiedSince: 'last tuesday' }))).toHaveLength(1)
    expect(retrievalProblems(params())).toEqual([])
  })
})

describe('response headers', () => {
  const meta = {
    page: 1,
    pageSize: 100,
    totalCount: 250,
    hasMore: true,
    maxCommitDateUtc: '2026-07-30T00:00:00.000Z',
    durationMs: 42,
    byteLength: 8_192,
  }

  it('carries the paging metadata out of band, so the body stays pure CSV', () => {
    const headers = Object.fromEntries(retrievalHeaders(params({ pageSize: 100 }), meta))
    expect(headers['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(headers['X-Total-Count']).toBe('250')
    expect(headers['X-Page-Count']).toBe('3')
    expect(headers['X-Last-Modified-Utc']).toBe('2026-07-30T00:00:00.000Z')
  })

  it('offers a next link only while there is a next page', () => {
    const withMore = Object.fromEntries(retrievalHeaders(params({ pageSize: 100 }), meta))
    expect(withMore.Link).toContain('page=2')
    expect(withMore.Link).toContain('rel="next"')

    const last = Object.fromEntries(
      retrievalHeaders(params({ pageSize: 100, page: 3 }), { ...meta, page: 3, hasMore: false }),
    )
    expect(last.Link).toBeUndefined()
  })

  it('never divides by zero on an empty result', () => {
    const empty = Object.fromEntries(
      retrievalHeaders(params(), { ...meta, totalCount: 0, hasMore: false }),
    )
    expect(empty['X-Page-Count']).toBe('1')
  })

  it('switches the content type with the format', () => {
    const json = Object.fromEntries(retrievalHeaders(params({ format: 'json' }), meta))
    expect(json['Content-Type']).toBe('application/json')
  })
})

describe('the To-Be architecture', () => {
  it('every flow connects two declared nodes', () => {
    const ids = new Set(ARCHITECTURE_NODES.map((n) => n.id))
    for (const flow of ARCHITECTURE_FLOWS) {
      expect(ids.has(flow.from)).toBe(true)
      expect(ids.has(flow.to)).toBe(true)
    }
  })

  it('DMS both pulls and pushes, and owns exactly those two edges', () => {
    const dmsEdges = ARCHITECTURE_FLOWS.filter((f) => f.isDms)
    expect(dmsEdges.map((f) => f.useCase).sort()).toEqual(['UC045', 'UC046'])
    // The consumer reads the warehouse, never DMS — that is the whole point of
    // UC056 and the reason DMS owns no master data.
    expect(ARCHITECTURE_FLOWS.some((f) => f.from === 'dms' && f.to === 'publications')).toBe(false)
  })
})

describe('sync health', () => {
  it('judges a source against its own cadence, not one global threshold', () => {
    const hapt = SYNC_SOURCES.find((s) => s.id === 'hapt')
    const macro = SYNC_SOURCES.find((s) => s.id === 'macro')
    expect(hapt && macro).toBeTruthy()
    if (!hapt || !macro) return
    // Four days silent: late for a nightly API, entirely normal for a
    // quarterly load.
    expect(syncHealth(hapt, 4, false)).toBe('stale')
    expect(syncHealth(macro, 4, false)).toBe('ok')
  })

  it('a failure outranks the age', () => {
    const hapt = SYNC_SOURCES[0]
    expect(hapt && syncHealth(hapt, 0, true)).toBe('failed')
  })
})
