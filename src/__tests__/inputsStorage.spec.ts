import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
// STORAGE_KEY comes from the module rather than being spelled out here: these two
// tests wrote 'mortgage:inputs:v1' long after the key had been bumped to v3, so
// loadInputs found nothing, returned null on its `raw === null` early-out, and
// both passed without ever reaching the catch or the validator they exist for.
import { DEFAULT_INPUTS, loadInputs, saveInputs, STORAGE_KEY } from '@/infrastructure/inputsStorage'
import { BUILT_IN_PRODUCTS } from '@/infrastructure/depositCatalogue'
import type { DepositProduct, Inputs } from '@/engine/types/inputs'

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

  // The failure this guards: clearing a number field wrote "" into a number slot,
  // the deep watch saved it, and the old all-or-nothing validator then threw the
  // WHOLE blob away on reload — losing price, sale, cashflow, loan terms and every
  // custom deposit over one bad field. Now that field falls back to its default
  // and everything else survives.
  it('repairs a single bad field instead of discarding everything', () => {
    const saved = { ...DEFAULT_INPUTS, horizonMonths: 42 }
    saveInputs(saved)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    raw.apartment.price = '' // what a cleared field leaves behind
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

    const loaded = loadInputs()!
    expect(loaded).not.toBeNull()
    expect(loaded.apartment.price).toBe(DEFAULT_INPUTS.apartment.price) // repaired
    expect(loaded.horizonMonths).toBe(42) // everything else kept
  })

  it('still rejects something that is not the Inputs shape at all', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(loadInputs()).toBeNull()
  })

  // A partial object is repaired, not rejected: it keeps what it can and defaults
  // the rest, which is the whole point — never lose more than the one bad field.
  it('fills missing fields from the defaults instead of rejecting', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ horizonMonths: 12 }))
    const loaded = loadInputs()!
    expect(loaded.horizonMonths).toBe(12)
    expect(loaded.apartment.price).toBe(DEFAULT_INPUTS.apartment.price)
  })
})

describe('the deposit catalogue in storage', () => {
  const own: DepositProduct = {
    id: 'custom-1',
    name: 'Мой вклад',
    annualRate: 0.16,
    payoutPeriodMonths: 3,
  }

  function withOwnDeposit(): Inputs {
    return {
      ...DEFAULT_INPUTS,
      deposits: {
        ...DEFAULT_INPUTS.deposits,
        products: [...DEFAULT_INPUTS.deposits.products, own],
      },
    }
  }

  it('keeps the user’s own deposits', () => {
    saveInputs(withOwnDeposit())
    expect(loadInputs()!.deposits.products).toContainEqual(own)
  })

  // They belong to data/deposits.yml. A stored copy would mean edits to the file
  // never reached anyone who had already used the app.
  it('does not write the built-ins to storage', () => {
    saveInputs(withOwnDeposit())
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Inputs
    expect(stored.deposits.products).toEqual([own])
  })

  it('puts the built-ins back from the file on load', () => {
    saveInputs(withOwnDeposit())
    expect(loadInputs()!.deposits.products).toEqual([...BUILT_IN_PRODUCTS, own])
  })

  it('drops a stored deposit that has taken a built-in’s id', () => {
    saveInputs({
      ...DEFAULT_INPUTS,
      deposits: {
        ...DEFAULT_INPUTS.deposits,
        products: [{ ...own, id: 'kaspi-deposit', annualRate: 0.99 }],
      },
    })
    expect(loadInputs()!.deposits.products).toEqual([...BUILT_IN_PRODUCTS])
  })

  // Rejecting the whole blob would cost the user their price, sale, cashflow and
  // loan terms over one dangling reference.
  it('repairs an unresolvable selection without discarding everything else', () => {
    saveInputs({
      ...DEFAULT_INPUTS,
      horizonMonths: 42,
      deposits: { ...DEFAULT_INPUTS.deposits, savingsProductId: 'deposit-that-went-away' },
    })
    const loaded = loadInputs()!
    expect(loaded.deposits.savingsProductId).toBe(DEFAULT_INPUTS.deposits.savingsProductId)
    expect(loaded.horizonMonths).toBe(42)
  })

  it('leaves a resolvable selection alone', () => {
    saveInputs({
      ...withOwnDeposit(),
      deposits: { ...withOwnDeposit().deposits, savingsProductId: 'custom-1' },
    })
    expect(loadInputs()!.deposits.savingsProductId).toBe('custom-1')
  })
})
