import { describe, it, expect } from 'vitest'
import { simulateAll } from '@/engine/simulate'
import { simulateHalykDelayed } from '@/engine/variants/halykDelayed'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { VariantResult } from '@/engine/types/plan'

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
      (left, right) => right.totals.netWorthAtEnd - left.totals.netWorthAtEnd,
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

  describe('comparison window', () => {
    it('ends the month the last variant clears its debt', () => {
      const report = simulateAll(DEFAULT_INPUTS)
      const slowest = Math.max(...report.variants.map((variant) => variant.debtFreeMonth!))
      expect(report.comparisonMonths).toBe(slowest + 1)
      expect(report.comparisonMonths).toBeLessThan(DEFAULT_INPUTS.horizonMonths)
    })

    it('cuts every variant to the same window, not to its own finish', () => {
      const report = simulateAll(DEFAULT_INPUTS)
      for (const variant of report.variants) {
        expect(variant.rows).toHaveLength(report.comparisonMonths)
      }
    })

    it('totals are recomputed on the window, not carried from the horizon', () => {
      const report = simulateAll(DEFAULT_INPUTS)
      for (const variant of report.variants) {
        const last = variant.rows[variant.rows.length - 1]!
        expect(variant.totals.netWorthAtEnd).toBe(last.netWorth)
        expect(variant.totals.rentPaid).toBeCloseTo(
          variant.rows.reduce((sum, row) => sum + row.rentPaid, 0),
          4,
        )
      }
    })

    // Nothing to cut back to: the window has to fall back on the horizon rather
    // than on some variant's null debt-free month.
    it('runs to the horizon when a variant never gets out of debt', () => {
      const short = { ...DEFAULT_INPUTS, horizonMonths: 6 }
      const report = simulateAll(short)
      expect(report.variants.some((variant) => variant.debtFreeMonth === null)).toBe(true)
      expect(report.comparisonMonths).toBe(6)
    })
  })

  // The reported variant is cut to the comparison window, so it is compared to
  // the reference over that same prefix — the months beyond it were dropped, not
  // computed differently.
  function expectSameRun(reported: VariantResult, reference: VariantResult, months: number): void {
    expect(reported.purchaseMonth).toBe(reference.purchaseMonth)
    expect(reported.debtFreeMonth).toBe(reference.debtFreeMonth)
    expect(reported.rows).toEqual(reference.rows.slice(0, months))
  }

  it('chains the delayed-Halyk window to Otbasy purchase month by default', () => {
    const report = simulateAll(DEFAULT_INPUTS)
    const otbasy = report.variants.find((variant) => variant.id === 'otbasy')!
    const delayed = report.variants.find((variant) => variant.id === 'halyk-delayed')!
    expectSameRun(
      delayed,
      simulateHalykDelayed(DEFAULT_INPUTS, otbasy.purchaseMonth!),
      report.comparisonMonths,
    )
  })

  it('honours an explicit savings window over the chain', () => {
    const inputs = { ...DEFAULT_INPUTS, halykDelayedSavingMonths: 24 }
    const report = simulateAll(inputs)
    const delayed = report.variants.find((variant) => variant.id === 'halyk-delayed')!
    expectSameRun(delayed, simulateHalykDelayed(inputs, 24), report.comparisonMonths)
  })
})
