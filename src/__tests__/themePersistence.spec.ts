import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import {
  loadThemeOverride,
  saveThemeOverride,
  THEME_STORAGE_KEY,
} from '@/infrastructure/themePersistence'

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

describe('themePersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to null (follow system) when nothing is stored', () => {
    expect(loadThemeOverride()).toBeNull()
  })

  it('round-trips an explicit light/dark override', () => {
    saveThemeOverride('dark')
    expect(loadThemeOverride()).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    saveThemeOverride('light')
    expect(loadThemeOverride()).toBe('light')
  })

  it('clears the stored key when set back to null', () => {
    saveThemeOverride('dark')
    saveThemeOverride(null)
    expect(loadThemeOverride()).toBeNull()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('falls back to null on a garbage stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    expect(loadThemeOverride()).toBeNull()
  })
})
