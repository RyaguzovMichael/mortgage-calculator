import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
// STORAGE_KEY comes from the module rather than being spelled out here: these two
// tests wrote 'mortgage:inputs:v1' long after the key had been bumped to v3, so
// loadInputs found nothing, returned null on its `raw === null` early-out, and
// both passed without ever reaching the catch or the validator they exist for.
import { DEFAULT_INPUTS, loadInputs, saveInputs, STORAGE_KEY } from '@/infrastructure/inputsStorage'

// localStorage is not provided by this test environment, so back it with memory.
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

describe('inputsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips inputs', () => {
    const inputs = { ...DEFAULT_INPUTS, horizonMonths: 42 }
    saveInputs(inputs)
    expect(loadInputs()).toEqual(inputs)
  })

  it('returns null when nothing is stored', () => {
    expect(loadInputs()).toBeNull()
  })

  it('returns null on unparseable data', () => {
    localStorage.setItem(STORAGE_KEY,'{ not json')
    expect(loadInputs()).toBeNull()
  })

  it('returns null on a blob of the wrong shape', () => {
    localStorage.setItem(STORAGE_KEY,JSON.stringify({ horizonMonths: 12 }))
    expect(loadInputs()).toBeNull()
  })
})
