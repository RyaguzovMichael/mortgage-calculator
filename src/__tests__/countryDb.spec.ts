import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fetchCountryDb } from '@/infrastructure/countryDb'
import { COUNTRIES } from '@/infrastructure/country'
import './fixtures'

const kzDeposits = readFileSync('public/db/kz/deposits.yml', 'utf8')
const kzLoans = readFileSync('public/db/kz/loans.yml', 'utf8')

function mockFetch(handler: (url: string) => { ok: boolean; status?: number; body?: string }) {
  const mock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input)
    const result = handler(url)
    return {
      ok: result.ok,
      status: result.status ?? (result.ok ? 200 : 500),
      text: async () => result.body ?? '',
    } as Response
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('COUNTRIES (build-time define)', () => {
  it('contains kz with its meta from the build scan', () => {
    const kz = COUNTRIES.find((country) => country.code === 'kz')
    expect(kz).toBeDefined()
    expect(kz!.currencySymbol).toBe('₸')
    expect(kz!.otbasy).toBe(true)
    expect(kz!.name.ru).toBe('Казахстан')
  })
})

describe('fetchCountryDb', () => {
  it('fetches and parses the country files relative to the app base', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.endsWith('db/kz/deposits.yml')) return { ok: true, body: kzDeposits }
      if (url.endsWith('db/kz/loans.yml')) return { ok: true, body: kzLoans }
      return { ok: false, status: 404 }
    })
    const db = await fetchCountryDb('kz')
    expect(db.deposits.length).toBeGreaterThan(0)
    expect(db.loans.products.length).toBeGreaterThan(0)
    expect(db.loans.otbasy).not.toBeNull()
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls).toHaveLength(2)
    for (const url of urls) expect(url).toMatch(/db\/kz\/(deposits|loans)\.yml$/)
  })

  it('throws a readable error when a file is missing', async () => {
    mockFetch(() => ({ ok: false, status: 404 }))
    await expect(fetchCountryDb('kz')).rejects.toThrow(/404/)
  })

  it('throws on malformed YAML instead of returning garbage', async () => {
    mockFetch((url) =>
      url.includes('deposits') ? { ok: true, body: '{not: [yaml' } : { ok: true, body: kzLoans },
    )
    await expect(fetchCountryDb('kz')).rejects.toThrow(/deposits\.yml/)
  })

  it('rejects an unknown country before any network call', async () => {
    const fetchMock = mockFetch(() => ({ ok: true, body: '' }))
    await expect(fetchCountryDb('xx')).rejects.toThrow(/xx/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
