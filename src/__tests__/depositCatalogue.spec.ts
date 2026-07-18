import { describe, it, expect } from 'vitest'
import {
  BUILT_IN_PRODUCTS,
  isBuiltInProduct,
  parseDepositProducts,
} from '@/infrastructure/depositCatalogue'

function product(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'x', name: 'X', annualRate: 0.1, payoutPeriodMonths: 1, ...overrides }
}

// This one also proves the YAML plugin works end to end: if the file were not
// being parsed at build time, there would be nothing here to assert on.
describe('BUILT_IN_PRODUCTS', () => {
  it('comes from data/deposits.yml', () => {
    expect(BUILT_IN_PRODUCTS.map((entry) => entry.id)).toEqual(['kaspi-deposit', 'kaspi-savings'])
  })

  it('carries the rate and the payout period of each deposit', () => {
    expect(BUILT_IN_PRODUCTS).toEqual([
      { id: 'kaspi-deposit', name: 'Kaspi Депозит', annualRate: 0.184, payoutPeriodMonths: 6 },
      { id: 'kaspi-savings', name: 'Kaspi Копилка', annualRate: 0.141, payoutPeriodMonths: 1 },
    ])
  })
})

describe('isBuiltInProduct', () => {
  it('knows the deposits from the file', () => {
    expect(isBuiltInProduct('kaspi-deposit')).toBe(true)
  })

  it('does not claim anything else', () => {
    expect(isBuiltInProduct('custom-1')).toBe(false)
  })
})

// Shipped data: a typo is a programmer error, so every one of these must stop the
// app rather than quietly compute at a rate nobody chose.
describe('parseDepositProducts', () => {
  it('accepts a well-formed list', () => {
    expect(parseDepositProducts([product()])).toEqual([
      { id: 'x', name: 'X', annualRate: 0.1, payoutPeriodMonths: 1 },
    ])
  })

  // Each case asserts *why* it threw. A bare toThrow() would go green on a typo
  // in the validator itself throwing a TypeError.
  it.each([
    ['not a list', {}, /список вкладов/],
    ['an entry that is not an object', ['kaspi'], /ожидался объект/],
    ['a missing id', [product({ id: undefined })], /id/],
    ['an empty id', [product({ id: '  ' })], /id/],
    ['a missing name', [product({ name: undefined })], /name/],
    ['a rate written as a string', [product({ annualRate: '0.184' })], /annualRate/],
    ['a payout period of zero', [product({ payoutPeriodMonths: 0 })], /payoutPeriodMonths/],
    ['a fractional payout period', [product({ payoutPeriodMonths: 1.5 })], /payoutPeriodMonths/],
    ['a duplicate id', [product({ id: 'same' }), product({ id: 'same' })], /больше одного раза/],
  ])('rejects %s', (_case, raw, reason) => {
    expect(() => parseDepositProducts(raw)).toThrow(reason)
  })

  it('names the offending entry so the file can be fixed', () => {
    expect(() => parseDepositProducts([product(), product({ annualRate: null })])).toThrow(
      /запись 2.*annualRate/s,
    )
  })
})
