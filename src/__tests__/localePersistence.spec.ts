import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { loadLocale, saveLocale, LOCALE_STORAGE_KEY } from '@/infrastructure/localePersistence'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

beforeAll(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('localePersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to ru when nothing is stored', () => {
    expect(loadLocale()).toBe('ru')
  })

  it('round-trips an explicit choice', () => {
    saveLocale('en')
    expect(loadLocale()).toBe('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
  })

  it('falls back to ru on a garbage stored value', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr')
    expect(loadLocale()).toBe('ru')
  })
})
