import { describe, it, expect } from 'vitest'
import { enumeratePlans, buildBestPlans, type GeneratorOptions } from '@/engine/bestPlans'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'

// A selling run starting the sale sweep at month 4, and a renting run — the two
// shapes enumeratePlans produces now that the situation is the caller's explicit
// choice rather than something derived from ownership. A generous time budget so the
// deadline filter doesn't hide plans the search tests are about.
const SELLING: GeneratorOptions = {
  situation: 'selling',
  earliestSaleMonth: 4,
  maxMonths: 1_000_000,
}
const RENTING: GeneratorOptions = {
  situation: 'renting',
  earliestSaleMonth: 0,
  maxMonths: 1_000_000,
}

describe('enumeratePlans', () => {
  it('produces plans, all in the chosen situation', () => {
    const selling = enumeratePlans(DEFAULT_INPUTS, SELLING)
    expect(selling.length).toBeGreaterThan(0)
    expect(selling.every((plan) => plan.situation === 'selling')).toBe(true)
    const renting = enumeratePlans(DEFAULT_INPUTS, RENTING)
    expect(renting.every((plan) => plan.situation === 'renting')).toBe(true)
  })

  it('covers cash, Otbasy, and every catalogue loan', () => {
    const loans = new Set(enumeratePlans(DEFAULT_INPUTS, SELLING).map((plan) => plan.loan))
    expect(loans.has('none')).toBe(true)
    expect(loans.has('otbasy')).toBe(true)
    for (const product of DEFAULT_INPUTS.loans.products) expect(loans.has(product.id)).toBe(true)
  })

  // The sweep starts at the earliest month the user can sell and steps every two
  // months for a few points — not the old fixed [0, 3, 6, 12].
  it('sweeps the sale month every two months from the earliest, for selling plans', () => {
    const saleMonths = new Set(
      enumeratePlans(DEFAULT_INPUTS, { ...SELLING, earliestSaleMonth: 4 }).map(
        (plan) => plan.saleMonthOffset,
      ),
    )
    expect([...saleMonths].sort((a, b) => a - b)).toEqual([4, 6, 8, 10])
  })

  // Free/renting plans have nothing to sell, so the sale month is a single fixed
  // value there — no point multiplying the search by an ignored field.
  it('does not vary the sale month when nothing is sold', () => {
    const saleMonths = new Set(
      enumeratePlans(DEFAULT_INPUTS, RENTING).map((plan) => plan.saleMonthOffset),
    )
    expect(saleMonths.size).toBe(1)
  })

  it('skips the term dimension for cash and Otbasy, varies it for ordinary loans', () => {
    const plans = enumeratePlans(DEFAULT_INPUTS, SELLING)
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
    const result = await buildBestPlans(DEFAULT_INPUTS, SELLING, undefined, ONE_BATCH)
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
    const result = await buildBestPlans(DEFAULT_INPUTS, SELLING, undefined, ONE_BATCH)
    const loanWinners = result.winners.filter((winner) => winner.category === 'shortest-loan')
    expect(
      loanWinners.every((winner) => winner.plan.loan !== 'none' && winner.metrics.hasLoan),
    ).toBe(true)
  })

  // The time budget is a hard filter: with an impossibly tight deadline no plan can
  // settle in time, so there are no winners — the case the UI turns into a "raise the
  // limit" prompt.
  it('returns no winners when nothing settles within the time budget', async () => {
    const result = await buildBestPlans(
      DEFAULT_INPUTS,
      { ...SELLING, maxMonths: 1 },
      undefined,
      ONE_BATCH,
    )
    expect(result.winners).toHaveLength(0)
    // Every candidate was still evaluated — the filter sets them aside, it doesn't
    // shorten the search.
    expect(result.total).toBe(enumeratePlans(DEFAULT_INPUTS, SELLING).length)
  })

  it('reports progress that ends at the total', async () => {
    let last = { done: -1, total: -1 }
    const result = await buildBestPlans(DEFAULT_INPUTS, SELLING, (done, total) => {
      last = { done, total }
    })
    expect(last.total).toBe(result.total)
    expect(last.done).toBe(result.total)
    expect(result.total).toBe(enumeratePlans(DEFAULT_INPUTS, SELLING).length)
  })
})
