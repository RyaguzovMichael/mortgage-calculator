import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import './fixtures'
import { useKz } from './fixtures'
import { COUNTRIES } from '@/infrastructure/country'
import { setCurrentCountry } from '@/infrastructure/currentCountry'
import { parseDepositProducts } from '@/infrastructure/depositCatalogue'
import { parseLoans } from '@/infrastructure/loanCatalogue'
import { loadInputs, saveInputs, storageKey } from '@/infrastructure/inputsStorage'
import { DEFAULT_INPUTS } from './fixtures'

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
  useKz()
})

function fakeRussia() {
  const meta = {
    code: 'ru',
    name: { ru: 'Россия', en: 'Russia' },
    currencySymbol: '₽',
    otbasy: false,
    defaults: {
      horizonMonths: 60,
      apartmentAnnualGrowthRate: 0.05,
      annualIndexationRate: 0.05,
      raiseMonth: 6,
    },
  }
  const readDb = (file: string): unknown =>
    parseYaml(readFileSync(`public/db/kz/${file}`, 'utf8'))
  // A stand-in second "country": same shipped files, different currency and no
  // otbasy — what matters for the storage test is the key namespacing.
  setCurrentCountry(meta, {
    deposits: parseDepositProducts(readDb('deposits.yml')),
    loans: parseLoans(readDb('loans.yml'), { requireOtbasy: false }),
  })
}

describe('per-country storage', () => {
  it('namespaces the inputs key per country', () => {
    expect(storageKey('kz')).not.toBe(storageKey('ru'))
    expect(storageKey('kz')).toContain('kz')
  })

  it('keeps each country’s data separate and restores it on switch', () => {
    const kzInputs = { ...structuredClone(DEFAULT_INPUTS), horizonMonths: 42 }
    saveInputs(kzInputs)

    fakeRussia()
    // Russia sees nothing of KZ's data.
    expect(loadInputs()).toBeNull()
    const ruInputs = { ...structuredClone(structuredClone(DEFAULT_INPUTS)), horizonMonths: 99 }
    saveInputs(ruInputs)
    expect(loadInputs()!.horizonMonths).toBe(99)

    // Back in KZ: the KZ blob is untouched.
    useKz()
    expect(loadInputs()!.horizonMonths).toBe(42)
  })

  it('keeps otbasy plans in the blob when the country has the programme disabled', () => {
    fakeRussia()
    const otbasyPlan = {
      id: 'plan-otbasy',
      name: 'Otbasy plan',
      loan: 'otbasy' as const,
      buyWhen: 'otbasy-gates' as const,
      saveMonths: null,
      borrow: 'max' as const,
      repay: 'monthly' as const,
      term: 'max' as const,
      situation: 'selling' as const,
      saleMonthOffset: 3,
      savingsProductId: 'kaspi-deposit',
    }
    saveInputs({
      ...structuredClone(DEFAULT_INPUTS),
      plans: { custom: [otbasyPlan], generated: [], shown: ['plan-otbasy'] },
    })
    // The engine-facing views filter the plan out; the stored blob must keep it,
    // so flipping the flag back on resurrects the user's plan untouched.
    expect(loadInputs()!.plans.custom.map((plan) => plan.loan)).toContain('otbasy')
    expect(loadInputs()!.plans.shown).toContain('plan-otbasy')
  })

  it('stores Russia under its own key', () => {
    fakeRussia()
    saveInputs({ ...structuredClone(DEFAULT_INPUTS), horizonMonths: 77 })
    expect(localStorage.getItem(storageKey('ru'))).not.toBeNull()
    expect(localStorage.getItem(storageKey('kz'))).toBeNull()
    expect(COUNTRIES.map((c) => c.code)).toContain('kz')
  })
})
