import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
// STORAGE_KEY comes from the module rather than being spelled out here: these two
// tests wrote 'mortgage:inputs:v1' long after the key had been bumped to v3, so
// loadInputs found nothing, returned null on its `raw === null` early-out, and
// both passed without ever reaching the catch or the validator they exist for.
import {
  DEFAULT_INPUTS,
  DEFAULT_SAVINGS_PRODUCT_ID,
  loadInputs,
  saveInputs,
  STORAGE_KEY,
} from '@/infrastructure/inputsStorage'
import { BUILT_IN_PRODUCTS } from '@/infrastructure/depositCatalogue'
import { BUILT_IN_LOAN_PRODUCTS } from '@/infrastructure/loanCatalogue'
import type { DepositProduct, Inputs, LoanProduct } from '@/engine/types/inputs'

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
    localStorage.setItem(STORAGE_KEY, '{ not json')
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

  // The deposit a plan stores money in is now a per-plan field, repaired per plan.
  // Rejecting the whole blob would cost the user their price, cashflow and loan
  // terms over one dangling reference.
  it('repairs a plan’s unresolvable deposit without discarding everything else', () => {
    const plan = {
      id: 'plan-1',
      name: 'Мой',
      loan: 'halyk',
      buyWhen: 'asap',
      saveMonths: null,
      borrow: 'max',
      repay: 'monthly',
      term: 'max',
      situation: 'selling',
      saleMonthOffset: 3,
      savingsProductId: 'deposit-that-went-away',
    } as const
    saveInputs({
      ...DEFAULT_INPUTS,
      horizonMonths: 42,
      plans: { custom: [{ ...plan }], generated: [], shown: [] },
    })
    const loaded = loadInputs()!
    expect(loaded.plans.custom[0]!.savingsProductId).toBe(DEFAULT_SAVINGS_PRODUCT_ID)
    expect(loaded.horizonMonths).toBe(42)
  })

  it('leaves a plan’s resolvable deposit alone', () => {
    const plan = {
      id: 'plan-1',
      name: 'Мой',
      loan: 'halyk',
      buyWhen: 'asap',
      saveMonths: null,
      borrow: 'max',
      repay: 'monthly',
      term: 'max',
      situation: 'selling',
      saleMonthOffset: 3,
      savingsProductId: 'custom-1',
    } as const
    saveInputs({ ...withOwnDeposit(), plans: { custom: [{ ...plan }], generated: [], shown: [] } })
    expect(loadInputs()!.plans.custom[0]!.savingsProductId).toBe('custom-1')
  })
})

describe('the loan catalogue in storage', () => {
  const own: LoanProduct = {
    id: 'credit-1',
    name: 'Мой кредит',
    annualRate: 0.19,
    downPaymentFraction: 0.15,
    maxTermMonths: 180,
  }

  function withOwnLoan(): Inputs {
    return {
      ...DEFAULT_INPUTS,
      loans: { ...DEFAULT_INPUTS.loans, products: [...DEFAULT_INPUTS.loans.products, own] },
    }
  }

  it('keeps the user’s own credits', () => {
    saveInputs(withOwnLoan())
    expect(loadInputs()!.loans.products).toContainEqual(own)
  })

  // Halyk belongs to data/loans.yml. A stored copy would mean edits to the file
  // never reached anyone who had already used the app.
  it('does not write the built-in Halyk product to storage', () => {
    saveInputs(withOwnLoan())
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Inputs
    expect(stored.loans.products).toEqual([own])
  })

  it('puts Halyk back from the file on load', () => {
    saveInputs(withOwnLoan())
    expect(loadInputs()!.loans.products).toEqual([...BUILT_IN_LOAN_PRODUCTS, own])
  })
})

describe('the plan catalogue in storage', () => {
  const mine = {
    id: 'plan-1',
    name: 'Мой план',
    loan: 'halyk',
    buyWhen: 'after-months',
    saveMonths: 12,
    borrow: 'min',
    repay: 'monthly',
    term: 'max',
    situation: 'selling',
    saleMonthOffset: 3,
    savingsProductId: 'kaspi-deposit',
  } as const

  function withOwnPlan(): Inputs {
    return {
      ...DEFAULT_INPUTS,
      plans: { custom: [{ ...mine }], generated: [], shown: ['halyk', 'plan-1'] },
    }
  }

  it('round-trips the user’s own plans and board choice', () => {
    saveInputs(withOwnPlan())
    const loaded = loadInputs()!
    expect(loaded.plans.custom).toEqual([mine])
    expect(loaded.plans.shown).toEqual(['halyk', 'plan-1'])
  })

  // Built-in plan definitions live in data/plans.yml, never in the blob — only the
  // user's own plans are stored. (The shown list may name built-ins; those are ids,
  // a board preference, not the definition.)
  it('stores only the custom plans, never the built-in definitions', () => {
    saveInputs(withOwnPlan())
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Inputs
    expect(stored.plans.custom).toEqual([mine])
  })

  it('defaults the board when the plans field is missing entirely', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ horizonMonths: 12 }))
    expect(loadInputs()!.plans).toEqual(DEFAULT_INPUTS.plans)
  })
})
