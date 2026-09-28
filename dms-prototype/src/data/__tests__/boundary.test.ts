/**
 * Structural rule 2 — all data access goes through `XMartClient`.
 *
 * Kept as a test rather than a note because it drifted once already: by Phase 8
 * four modules outside the client were reading or writing the `db.ts` overlay
 * directly, which quietly made "when xMart is real, one file changes" untrue.
 *
 * The overlay has exactly two sanctioned importers: the mock client, whose
 * warehouse it is, and `workbookStore`, which is the unsaved-edit layer. Tests
 * may import it to reset state between cases.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { observationKey } from '@/domain/keys'
import { resetMockWarehouse, mockXMartClient } from '../xmart/mockClient'

const ALLOWED_DB_IMPORTERS = new Set(['/src/data/xmart/mockClient.ts', '/src/stores/workbookStore.ts'])

const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

beforeEach(() => {
  resetMockWarehouse()
})

describe('structural rule 2 — the db.ts overlay', () => {
  it('is imported only by the mock client and the workbook store', () => {
    // Any specifier ending in `/db` — `@/data/db`, `../db`, `../../data/db`.
    const importsDb = /from\s+['"][^'"]*\/db['"]/
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('/__tests__/') && path !== '/src/data/db.ts')
      .filter(([path, source]) => importsDb.test(source) && !ALLOWED_DB_IMPORTERS.has(path))
      .map(([path]) => path)

    expect(Object.keys(SOURCES).length).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })
})

describe('putObservations — the warehouse holds what it accepts', () => {
  async function canHf11(year: number) {
    const page = await mockXMartClient.getObservations({
      countries: ['CAN'],
      years: [year],
      variables: ['HF.1.1'],
    })
    const row = page.rows[0]
    expect(row).toBeDefined()
    return row!
  }

  it('serves a pushed value on the next read', async () => {
    const before = await canHf11(2020)
    const key = observationKey(before.iso3, before.year, before.dims)

    const put = await mockXMartClient.putObservations([
      { observationKey: key, value: 12_345, authorId: 'test@who.int' },
    ])

    expect(put.accepted).toBe(1)
    expect((await canHf11(2020)).value).toBe(12_345)
  })

  it('leaves the value alone on a metadata-only push', async () => {
    // A save that defaulted untouched fields to null would blank the figure.
    const before = await canHf11(2021)
    const key = observationKey(before.iso3, before.year, before.dims)

    await mockXMartClient.putObservations([
      { observationKey: key, metadata: { COMMENT: 'checked' }, authorId: 'test@who.int' },
    ])

    const after = await canHf11(2021)
    expect(after.value).toBe(before.value)
    expect(after.metadata.COMMENT).toBe('checked')
  })

  it('does not store a rejected change', async () => {
    const put = await mockXMartClient.putObservations([
      { observationKey: 'no-hash-here', value: 1, authorId: 'test@who.int' },
    ])
    expect(put.rejected).toBe(1)
    expect(put.accepted).toBe(0)
  })
})
