import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { isOnboarded, markOnboarded, clearOnboarded } from '@/infrastructure/onboardingPersistence'
import { BLANK_START_INPUTS, DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'

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

beforeEach(() => {
  localStorage.clear()
})

describe('onboarding flag', () => {
  it('starts unset and round-trips through mark/clear', () => {
    expect(isOnboarded()).toBe(false)
    markOnboarded()
    expect(isOnboarded()).toBe(true)
    clearOnboarded()
    expect(isOnboarded()).toBe(false)
  })
})

describe('BLANK_START_INPUTS', () => {
  it('blanks every personal start condition', () => {
    expect(BLANK_START_INPUTS.apartment.price).toBe(0)
    expect(BLANK_START_INPUTS.existingApartment.owned).toBe(false)
    expect(BLANK_START_INPUTS.existingApartment.price).toBe(0)
    expect(BLANK_START_INPUTS.cashflow.monthlySalary).toBe(0)
    expect(BLANK_START_INPUTS.cashflow.mortgageShare).toBe(0)
    expect(BLANK_START_INPUTS.cashflow.monthlyRent).toBe(0)
    expect(BLANK_START_INPUTS.cashflow.annualIndexationRate).toBe(0)
    expect(BLANK_START_INPUTS.deposits.savingsBalance).toBe(0)
    expect(BLANK_START_INPUTS.otbasy.hasDeposit).toBe(false)
    expect(BLANK_START_INPUTS.otbasy.balance).toBe(0)
    expect(BLANK_START_INPUTS.otbasy.accruedInterest).toBe(0)
    expect(BLANK_START_INPUTS.otbasy.monthsOpen).toBe(0)
  })

  it('keeps the programme parameters from the defaults', () => {
    // Catalogues, price growth, horizon, start month, Otbasy rates — the shipped
    // parameters a fresh user should not have to re-enter — stay put.
    expect(BLANK_START_INPUTS.apartment.annualGrowthRate).toBe(
      DEFAULT_INPUTS.apartment.annualGrowthRate,
    )
    expect(BLANK_START_INPUTS.horizonMonths).toBe(DEFAULT_INPUTS.horizonMonths)
    expect(BLANK_START_INPUTS.start).toEqual(DEFAULT_INPUTS.start)
    expect(BLANK_START_INPUTS.deposits.products).toEqual(DEFAULT_INPUTS.deposits.products)
    expect(BLANK_START_INPUTS.loans.products).toEqual(DEFAULT_INPUTS.loans.products)
    expect(BLANK_START_INPUTS.otbasy.loanAnnualRate).toBe(DEFAULT_INPUTS.otbasy.loanAnnualRate)
    // The default raise month is a sensible starting point, not a personal fact.
    expect(BLANK_START_INPUTS.cashflow.raiseMonth).toBe(DEFAULT_INPUTS.cashflow.raiseMonth)
  })

  it('does not alias the defaults (mutating one must not touch the other)', () => {
    const blank = structuredClone(BLANK_START_INPUTS)
    expect(blank.deposits.products).not.toBe(DEFAULT_INPUTS.deposits.products)
    expect(DEFAULT_INPUTS.apartment.price).toBeGreaterThan(0)
  })
})
