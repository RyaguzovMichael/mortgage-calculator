import { describe, it, expect } from 'vitest'
import {
  BUILT_IN_LOANS,
  BUILT_IN_LOAN_PRODUCT,
  OTBASY_PARAM_DEFAULTS,
  isBuiltInLoanProduct,
  parseLoans,
} from '@/infrastructure/loanCatalogue'

const DESCRIPTION = { ru: 'РУ описание', en: 'EN description' }

function halykEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'halyk',
    name: 'Halyk',
    description: DESCRIPTION,
    annualRate: 0.24,
    downPaymentFraction: 0.2,
    maxTermMonths: 240,
    ...overrides,
  }
}

function otbasyEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'otbasy',
    name: 'Otbasy',
    description: DESCRIPTION,
    loanAnnualRate: 0.085,
    maxTermMonths: 240,
    depositAnnualRate: 0.02,
    minBalanceFraction: 0.5,
    ccTarget: 5,
    govBonusRate: 0.2,
    govBonusCap: 865000,
    govBonusMonth: 2,
    seedFromSale: 5_000_000,
    ...overrides,
  }
}

// Also proves the YAML plugin works end to end: if the file were not parsed at
// build time, there would be nothing here to assert on.
describe('BUILT_IN_LOANS', () => {
  it('comes from data/loans.yml', () => {
    expect(BUILT_IN_LOANS.map((entry) => entry.id)).toEqual(['halyk', 'otbasy'])
  })

  it('carries a bilingual description for each loan', () => {
    for (const loan of BUILT_IN_LOANS) {
      expect(loan.description.ru.length).toBeGreaterThan(0)
      expect(loan.description.en.length).toBeGreaterThan(0)
    }
  })
})

describe('BUILT_IN_LOAN_PRODUCT / OTBASY_PARAM_DEFAULTS', () => {
  it('matches the numbers in data/loans.yml', () => {
    expect(BUILT_IN_LOAN_PRODUCT).toEqual({
      id: 'halyk',
      name: 'Halyk',
      annualRate: 0.24,
      downPaymentFraction: 0.2,
      maxTermMonths: 240,
    })
    expect(OTBASY_PARAM_DEFAULTS).toEqual({
      loanAnnualRate: 0.085,
      maxTermMonths: 240,
      depositAnnualRate: 0.02,
      minBalanceFraction: 0.5,
      ccTarget: 5,
      govBonusRate: 0.2,
      govBonusCap: 865000,
      govBonusMonth: 2,
      seedFromSale: 5_000_000,
    })
  })
})

// Shipped data: a typo is a programmer error, so every one of these must stop the
// app rather than quietly compute the mortgage at a rate nobody chose.
describe('isBuiltInLoanProduct', () => {
  it('knows the built-in Halyk product', () => {
    expect(isBuiltInLoanProduct('halyk')).toBe(true)
  })

  it('does not claim a custom credit', () => {
    expect(isBuiltInLoanProduct('credit-1')).toBe(false)
  })

  it('does not claim otbasy — it is not a loan-product catalogue entry', () => {
    expect(isBuiltInLoanProduct('otbasy')).toBe(false)
  })
})

describe('parseLoans', () => {
  it('accepts a well-formed list', () => {
    const parsed = parseLoans([halykEntry(), otbasyEntry()])
    expect(parsed.halyk).toEqual({
      id: 'halyk',
      name: 'Halyk',
      annualRate: 0.24,
      downPaymentFraction: 0.2,
      maxTermMonths: 240,
    })
    expect(parsed.meta.map((m) => m.id)).toEqual(['halyk', 'otbasy'])
  })

  it.each([
    ['not a list', {}, /список кредитов/],
    ['an entry that is not an object', ['halyk'], /ожидался объект/],
    ['an unknown id', [halykEntry({ id: 'sberbank' }), otbasyEntry()], /id/],
    ['a missing name', [halykEntry({ name: undefined }), otbasyEntry()], /name/],
    [
      'a missing description',
      [halykEntry({ description: undefined }), otbasyEntry()],
      /description/,
    ],
    [
      'a description missing the en form',
      [halykEntry({ description: { ru: 'только ру' } }), otbasyEntry()],
      /description: en/,
    ],
    [
      'a rate written as a string',
      [halykEntry({ annualRate: '0.24' }), otbasyEntry()],
      /annualRate/,
    ],
    [
      'a fractional maxTermMonths',
      [halykEntry({ maxTermMonths: 240.5 }), otbasyEntry()],
      /maxTermMonths/,
    ],
    ['a duplicate id', [halykEntry(), halykEntry()], /больше одного раза/],
    ['a missing halyk entry', [otbasyEntry()], /halyk/],
    ['a missing otbasy entry', [halykEntry()], /otbasy/],
  ])('rejects %s', (_case, raw, reason) => {
    expect(() => parseLoans(raw)).toThrow(reason)
  })
})
