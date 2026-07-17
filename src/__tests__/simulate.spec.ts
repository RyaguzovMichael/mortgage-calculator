import { describe, it, expect } from 'vitest'
import { simulateAll } from '@/engine/simulate'
import { simulateHalykDelayed } from '@/engine/variants/halykDelayed'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'

describe('simulateAll', () => {
  it('reports the declared target loan', () => {
    expect(simulateAll(DEFAULT_INPUTS).targetLoan).toBe(10_000_000)
  })

  it('returns all four variants', () => {
    expect(simulateAll(DEFAULT_INPUTS).variants.map((variant) => variant.id)).toEqual([
      'halyk-immediate',
      'halyk-delayed',
      'otbasy',
      'all-cash',
    ])
  })

  it('picks the highest net worth as best', () => {
    const report = simulateAll(DEFAULT_INPUTS)
    const richest = [...report.variants].sort(
      (left, right) => right.totals.netWorthAtHorizon - left.totals.netWorthAtHorizon,
    )[0]
    expect(report.bestVariant).toBe(richest!.id)
  })

  // totalLoss silently mis-ranks once the price moves, because the variants then
  // buy at different prices and the apartment no longer cancels out.
  it('does not fall back to total loss when prices grow', () => {
    const growing = {
      ...DEFAULT_INPUTS,
      apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.1 },
    }
    const report = simulateAll(growing)
    const cheapest = [...report.variants].sort(
      (left, right) => left.totals.totalLoss - right.totals.totalLoss,
    )[0]
    expect(report.bestVariant).not.toBe(cheapest!.id)
  })

  it('chains the delayed-Halyk window to Otbasy purchase month by default', () => {
    const report = simulateAll(DEFAULT_INPUTS)
    const otbasy = report.variants.find((variant) => variant.id === 'otbasy')!
    const delayed = report.variants.find((variant) => variant.id === 'halyk-delayed')!
    const chained = simulateHalykDelayed(DEFAULT_INPUTS, otbasy.purchaseMonth!)
    expect(delayed.purchaseMonth).toBe(chained.purchaseMonth)
    expect(delayed.totals.totalLoss).toBeCloseTo(chained.totals.totalLoss, 6)
  })

  it('honours an explicit savings window over the chain', () => {
    const report = simulateAll({ ...DEFAULT_INPUTS, halykDelayedSavingMonths: 24 })
    const delayed = report.variants.find((variant) => variant.id === 'halyk-delayed')!
    const explicit = simulateHalykDelayed({ ...DEFAULT_INPUTS, halykDelayedSavingMonths: 24 }, 24)
    expect(delayed.totals.totalLoss).toBeCloseTo(explicit.totals.totalLoss, 6)
  })
})
