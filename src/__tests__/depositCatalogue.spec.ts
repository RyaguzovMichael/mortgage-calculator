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
    expect(BUILT_IN_PRODUCTS.map((entry) => entry.id)).toEqual([
      'kaspi-deposit',
      'kaspi-savings',
      'halyk-universal-6m',
      'halyk-universal-12m',
      'halyk-maximum-3m',
      'halyk-maximum-6m',
      'halyk-maximum-12m',
      'halyk-maximum-24m',
      'freedom-kopilka-6m',
      'freedom-kopilka-12m',
      'freedom-kopilka-13m',
      'freedom-kopilka-24m',
      'freedom-kopilka-36m',
      'freedom-strategy-3m',
      'freedom-strategy-6m',
      'freedom-strategy-12m',
      'freedom-strategy-24m',
    ])
  })

  it('carries the rate and the payout period of each deposit', () => {
    expect(BUILT_IN_PRODUCTS).toEqual([
      { id: 'kaspi-deposit', name: 'Kaspi Депозит', annualRate: 0.141, payoutPeriodMonths: 1 },
      {
        id: 'kaspi-savings',
        name: 'Накопительный Kaspi Депозит',
        annualRate: 0.184,
        payoutPeriodMonths: 3,
      },
      {
        id: 'halyk-universal-6m',
        name: 'Halyk Универсальный (6 мес)',
        annualRate: 0.1432,
        payoutPeriodMonths: 1,
      },
      {
        id: 'halyk-universal-12m',
        name: 'Halyk Универсальный (12 мес)',
        annualRate: 0.1406,
        payoutPeriodMonths: 1,
      },
      {
        id: 'halyk-maximum-3m',
        name: 'Halyk Максимальный (3 мес)',
        annualRate: 0.1667,
        payoutPeriodMonths: 3,
      },
      {
        id: 'halyk-maximum-6m',
        name: 'Halyk Максимальный (6 мес)',
        annualRate: 0.158,
        payoutPeriodMonths: 6,
      },
      {
        id: 'halyk-maximum-12m',
        name: 'Halyk Максимальный (12 мес)',
        annualRate: 0.1493,
        payoutPeriodMonths: 12,
      },
      {
        id: 'halyk-maximum-24m',
        name: 'Halyk Максимальный (24 мес)',
        annualRate: 0.1215,
        payoutPeriodMonths: 24,
      },
      {
        id: 'freedom-kopilka-6m',
        name: 'Freedom Копилка (6 мес)',
        annualRate: 0.138,
        payoutPeriodMonths: 1,
      },
      {
        id: 'freedom-kopilka-12m',
        name: 'Freedom Копилка (12 мес)',
        annualRate: 0.149,
        payoutPeriodMonths: 1,
      },
      {
        id: 'freedom-kopilka-13m',
        name: 'Freedom Копилка (13 мес)',
        annualRate: 0.156,
        payoutPeriodMonths: 1,
      },
      {
        id: 'freedom-kopilka-24m',
        name: 'Freedom Копилка (24 мес)',
        annualRate: 0.0979,
        payoutPeriodMonths: 1,
      },
      {
        id: 'freedom-kopilka-36m',
        name: 'Freedom Копилка (36 мес)',
        annualRate: 0.098,
        payoutPeriodMonths: 1,
      },
      {
        id: 'freedom-strategy-3m',
        name: 'Freedom Стратегия (3 мес)',
        annualRate: 0.1808,
        payoutPeriodMonths: 3,
      },
      {
        id: 'freedom-strategy-6m',
        name: 'Freedom Стратегия (6 мес)',
        annualRate: 0.164,
        payoutPeriodMonths: 6,
      },
      {
        id: 'freedom-strategy-12m',
        name: 'Freedom Стратегия (12 мес)',
        annualRate: 0.136,
        payoutPeriodMonths: 12,
      },
      {
        id: 'freedom-strategy-24m',
        name: 'Freedom Стратегия (24 мес)',
        annualRate: 0.0795,
        payoutPeriodMonths: 24,
      },
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
