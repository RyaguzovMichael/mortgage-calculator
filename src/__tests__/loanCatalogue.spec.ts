import { describe, it, expect } from 'vitest'
import {
  BUILT_IN_LOANS,
  BUILT_IN_LOAN_PRODUCTS,
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

function halykFeeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'halyk-fee',
    name: 'Halyk (с комиссией)',
    description: DESCRIPTION,
    annualRate: 0.225,
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
    expect(BUILT_IN_LOANS.map((entry) => entry.id)).toEqual([
      'halyk',
      'halyk-fee',
      'halyk-7-20-25',
      'halyk-construction',
      'freedom-construction',
      'freedom-secondary',
      'freedom-7-20-25',
      'otbasy',
    ])
  })

  it('carries a bilingual description for each loan', () => {
    for (const loan of BUILT_IN_LOANS) {
      expect(loan.description.ru.length).toBeGreaterThan(0)
      expect(loan.description.en.length).toBeGreaterThan(0)
    }
  })
})

describe('BUILT_IN_LOAN_PRODUCTS / OTBASY_PARAM_DEFAULTS', () => {
  it('matches the numbers in data/loans.yml', () => {
    expect(BUILT_IN_LOAN_PRODUCTS).toEqual([
      {
        id: 'halyk',
        name: 'Halyk',
        annualRate: 0.24,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
      {
        id: 'halyk-fee',
        name: 'Halyk (с комиссией)',
        annualRate: 0.225,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
      {
        id: 'halyk-7-20-25',
        name: 'Halyk 7-20-25',
        annualRate: 0.07,
        downPaymentFraction: 0.2,
        maxTermMonths: 300,
      },
      {
        id: 'halyk-construction',
        name: 'Halyk (новостройка)',
        annualRate: 0.18,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
      {
        id: 'freedom-construction',
        name: 'Freedom (новостройка)',
        annualRate: 0.22,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
      {
        id: 'freedom-secondary',
        name: 'Freedom (вторичное жильё)',
        annualRate: 0.22,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
      {
        id: 'freedom-7-20-25',
        name: 'Freedom 7-20-25',
        annualRate: 0.07,
        downPaymentFraction: 0.2,
        maxTermMonths: 300,
      },
    ])
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
  it('knows all built-in Halyk products', () => {
    expect(isBuiltInLoanProduct('halyk')).toBe(true)
    expect(isBuiltInLoanProduct('halyk-fee')).toBe(true)
    expect(isBuiltInLoanProduct('halyk-7-20-25')).toBe(true)
    expect(isBuiltInLoanProduct('halyk-construction')).toBe(true)
  })

  it('knows the Freedom Bank products', () => {
    expect(isBuiltInLoanProduct('freedom-construction')).toBe(true)
    expect(isBuiltInLoanProduct('freedom-secondary')).toBe(true)
    expect(isBuiltInLoanProduct('freedom-7-20-25')).toBe(true)
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
    const parsed = parseLoans([halykEntry(), halykFeeEntry(), otbasyEntry()])
    expect(parsed.products).toEqual([
      {
        id: 'halyk',
        name: 'Halyk',
        annualRate: 0.24,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
      {
        id: 'halyk-fee',
        name: 'Halyk (с комиссией)',
        annualRate: 0.225,
        downPaymentFraction: 0.2,
        maxTermMonths: 240,
      },
    ])
    expect(parsed.meta.map((m) => m.id)).toEqual(['halyk', 'halyk-fee', 'otbasy'])
  })

  it.each([
    ['not a list', {}, /список кредитов/],
    ['an entry that is not an object', ['halyk'], /ожидался объект/],
    ['a missing id', [halykEntry({ id: undefined }), otbasyEntry()], /id/],
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
    ['only otbasy, no loan product at all', [otbasyEntry()], /хотя бы один кредит/],
    ['a missing otbasy entry', [halykEntry()], /otbasy/],
  ])('rejects %s', (_case, raw, reason) => {
    expect(() => parseLoans(raw)).toThrow(reason)
  })
})
