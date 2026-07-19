import { describe, it, expect } from 'vitest'
import { enumeratePlans, buildBestPlans } from '@/engine/bestPlans'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { Inputs } from '@/engine/types/inputs'

const notOwning: Inputs = {
  ...DEFAULT_INPUTS,
  existingApartment: { owned: false, price: 0 },
}

describe('enumeratePlans', () => {
  it('only produces selling plans when a flat is owned', () => {
    const plans = enumeratePlans(DEFAULT_INPUTS)
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.every((plan) => plan.situation === 'selling')).toBe(true)
  })

  it('produces free and renting plans (and no selling) when no flat is owned', () => {
    const situations = new Set(enumeratePlans(notOwning).map((plan) => plan.situation))
    expect(situations).toEqual(new Set(['free', 'renting']))
  })

  it('covers cash, Otbasy, and every catalogue loan', () => {
    const loans = new Set(enumeratePlans(DEFAULT_INPUTS).map((plan) => plan.loan))
    expect(loans.has('none')).toBe(true)
    expect(loans.has('otbasy')).toBe(true)
    for (const product of DEFAULT_INPUTS.loans.products) expect(loans.has(product.id)).toBe(true)
  })

  it('varies the sale month for selling plans', () => {
    const saleMonths = new Set(enumeratePlans(DEFAULT_INPUTS).map((plan) => plan.saleMonthOffset))
    expect(saleMonths.size).toBeGreaterThan(1)
  })

  // Free/renting plans have nothing to sell, so the sale month is a single fixed
  // value there — no point multiplying the search by an ignored field.
  it('does not vary the sale month when there is nothing to sell', () => {
    const saleMonths = new Set(enumeratePlans(notOwning).map((plan) => plan.saleMonthOffset))
    expect(saleMonths.size).toBe(1)
  })

  it('skips the term dimension for cash and Otbasy, varies it for ordinary loans', () => {
    const plans = enumeratePlans(DEFAULT_INPUTS)
    // Cash and Otbasy always run their own term.
    expect(plans.filter((p) => p.loan === 'none').every((p) => p.term === 'max')).toBe(true)
    expect(plans.filter((p) => p.loan === 'otbasy').every((p) => p.term === 'max')).toBe(true)
    // An ordinary credit appears both ways.
    const halyk = plans.filter((p) => p.loan === 'halyk').map((p) => p.term)
    expect(halyk).toContain('max')
    expect(halyk).toContain('shortest')
  })
})

// A batch big enough to run in one pass, so the tests do not pay a setTimeout per
// batch (the batching itself is exercised by the progress test below).
const ONE_BATCH = 1_000_000

describe('buildBestPlans', () => {
  it('returns at most one winner per category, all from the known set', async () => {
    const result = await buildBestPlans(DEFAULT_INPUTS, undefined, ONE_BATCH)
    const categories = result.winners.map((winner) => winner.category)
    expect(new Set(categories).size).toBe(categories.length)
    const known = new Set([
      'earliest-move-in',
      'shortest-rent',
      'best-assets',
      'lowest-price',
      'shortest-loan',
    ])
    for (const category of categories) expect(known.has(category)).toBe(true)
  })

  it('never lets a cash plan win shortest-loan', async () => {
    const result = await buildBestPlans(DEFAULT_INPUTS, undefined, ONE_BATCH)
    const loanWinners = result.winners.filter((winner) => winner.category === 'shortest-loan')
    expect(
      loanWinners.every((winner) => winner.plan.loan !== 'none' && winner.metrics.hasLoan),
    ).toBe(true)
  })

  it('reports progress that ends at the total', async () => {
    let last = { done: -1, total: -1 }
    const result = await buildBestPlans(DEFAULT_INPUTS, (done, total) => {
      last = { done, total }
    })
    expect(last.total).toBe(result.total)
    expect(last.done).toBe(result.total)
    expect(result.total).toBe(enumeratePlans(DEFAULT_INPUTS).length)
  })
})
