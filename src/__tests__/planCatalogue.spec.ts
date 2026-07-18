import { describe, it, expect } from 'vitest'
import { BUILT_IN_PLANS, isBuiltInPlan, parsePurchasePlans } from '@/infrastructure/planCatalogue'

const HOUSING = { situation: 'selling', saleProceeds: 35_000_000, saleMonthOffset: 3 }

function plan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'x',
    name: 'X',
    loan: 'halyk',
    buyWhen: 'asap',
    saveMonths: null,
    borrow: 'max',
    repay: 'monthly',
    housing: HOUSING,
    ...overrides,
  }
}

// Also proves the YAML plugin works end to end: if the file were not parsed at
// build time, there would be nothing here to assert on.
describe('BUILT_IN_PLANS', () => {
  it('comes from data/plans.yml', () => {
    expect(BUILT_IN_PLANS.map((entry) => entry.id)).toEqual([
      'halyk',
      'otbasy',
      'otbasy-hold',
      'all-cash',
    ])
  })

  it('carries the five decisions of each plan', () => {
    expect(BUILT_IN_PLANS.find((entry) => entry.id === 'otbasy')).toEqual({
      id: 'otbasy',
      name: 'Otbasy',
      loan: 'otbasy',
      buyWhen: 'otbasy-gates',
      saveMonths: null,
      borrow: 'max',
      repay: 'lump',
      housing: { situation: 'selling', saleProceeds: 35_000_000, saleMonthOffset: 3 },
    })
  })
})

describe('isBuiltInPlan', () => {
  it('knows the plans from the file', () => {
    expect(isBuiltInPlan('halyk')).toBe(true)
  })

  it('does not claim anything else', () => {
    expect(isBuiltInPlan('plan-1')).toBe(false)
  })
})

// Shipped data: a typo is a programmer error, so every one of these must stop the
// app rather than quietly run a plan nobody described.
describe('parsePurchasePlans', () => {
  it('accepts a well-formed list', () => {
    expect(parsePurchasePlans([plan()])).toEqual([
      {
        id: 'x',
        name: 'X',
        loan: 'halyk',
        buyWhen: 'asap',
        saveMonths: null,
        borrow: 'max',
        repay: 'monthly',
        housing: HOUSING,
      },
    ])
  })

  it('accepts a whole-number saveMonths', () => {
    expect(
      parsePurchasePlans([plan({ buyWhen: 'after-months', saveMonths: 12 })])[0]!.saveMonths,
    ).toBe(12)
  })

  // Each case asserts *why* it threw. A bare toThrow() would go green on a typo in
  // the validator itself throwing a TypeError.
  it.each([
    ['not a list', {}, /список планов/],
    ['an entry that is not an object', ['halyk'], /ожидался объект/],
    ['a missing id', [plan({ id: undefined })], /id/],
    ['an empty id', [plan({ id: '  ' })], /id/],
    ['a missing name', [plan({ name: undefined })], /name/],
    ['an unknown loan', [plan({ loan: 'sberbank' })], /loan/],
    ['an unknown buyWhen', [plan({ buyWhen: 'someday' })], /buyWhen/],
    ['an unknown borrow', [plan({ borrow: 'half' })], /borrow/],
    ['an unknown repay', [plan({ repay: 'someday' })], /repay/],
    ['a fractional saveMonths', [plan({ saveMonths: 1.5 })], /saveMonths/],
    ['a negative saveMonths', [plan({ saveMonths: -1 })], /saveMonths/],
    ['a saveMonths written as a string', [plan({ saveMonths: '12' })], /saveMonths/],
    ['a missing housing', [plan({ housing: undefined })], /housing/],
    [
      'an unknown housing situation',
      [plan({ housing: { ...HOUSING, situation: 'owned' } })],
      /situation/,
    ],
    [
      'a negative saleProceeds',
      [plan({ housing: { ...HOUSING, saleProceeds: -1 } })],
      /saleProceeds/,
    ],
    ['a duplicate id', [plan({ id: 'same' }), plan({ id: 'same' })], /больше одного раза/],
  ])('rejects %s', (_case, raw, reason) => {
    expect(() => parsePurchasePlans(raw)).toThrow(reason)
  })

  it('names the offending entry so the file can be fixed', () => {
    expect(() => parsePurchasePlans([plan(), plan({ loan: 'nope' })])).toThrow(/запись 2.*loan/s)
  })
})
