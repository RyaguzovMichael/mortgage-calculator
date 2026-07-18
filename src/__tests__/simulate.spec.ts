import { describe, it, expect } from 'vitest'
import { simulateAll } from '@/engine/simulate'
import { runPlan } from '@/engine/runPlan'
import { BUILT_IN_PLANS } from '@/infrastructure/planCatalogue'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { Inputs } from '@/engine/types/inputs'
import type { PurchasePlan, VariantResult } from '@/engine/types/plan'

// simulateAll now takes the built-in catalogue; the app hands it data/plans.yml.
function report(inputs: Inputs) {
  return simulateAll(inputs, BUILT_IN_PLANS)
}

const builtIn = (id: string): PurchasePlan => BUILT_IN_PLANS.find((plan) => plan.id === id)!

// "Halyk отложенно" is no longer a built-in — the after-months/min-down/chained
// shape it used to demonstrate (and the window-chaining machinery it exercised)
// is still a legitimate custom plan, so these tests build one by hand.
function delayedPlan(saveMonths: number | null = null): PurchasePlan {
  return {
    id: 'halyk-delayed-test',
    name: 'Halyk отложенно (test)',
    loan: 'halyk',
    buyWhen: 'after-months',
    saveMonths,
    borrow: 'min',
    repay: 'monthly',
    housing: builtIn('halyk').housing,
  }
}

function simulateHalykDelayed(inputs: Inputs, savingMonths: number): VariantResult {
  return runPlan(inputs, delayedPlan(savingMonths))
}

// Puts the delayed custom plan on the board alongside every built-in.
function withDelayed(inputs: Inputs, saveMonths: number | null = null): Inputs {
  const plan = delayedPlan(saveMonths)
  return {
    ...inputs,
    plans: { custom: [plan], shown: [...BUILT_IN_PLANS.map((p) => p.id), plan.id] },
  }
}

// Show every built-in, so tests that assert on the full field see all three.
function showingAll(inputs: Inputs): Inputs {
  return { ...inputs, plans: { ...inputs.plans, shown: BUILT_IN_PLANS.map((plan) => plan.id) } }
}

describe('simulateAll', () => {
  it('reports the declared target loan', () => {
    expect(report(DEFAULT_INPUTS).targetLoan).toBe(10_000_000)
  })

  it('shows only the plans on the board by default', () => {
    expect(report(DEFAULT_INPUTS).variants.map((variant) => variant.id)).toEqual([
      'halyk',
      'otbasy',
      'all-cash',
    ])
  })

  it('shows every built-in when the board asks for them', () => {
    expect(report(showingAll(DEFAULT_INPUTS)).variants.map((variant) => variant.id)).toEqual([
      'halyk',
      'otbasy',
      'all-cash',
    ])
  })

  it('runs a custom plan added to the catalogue and board', () => {
    const mine: PurchasePlan = {
      id: 'mine',
      name: 'Мой',
      loan: 'halyk',
      buyWhen: 'asap',
      saveMonths: null,
      borrow: 'min',
      repay: 'monthly',
      housing: { situation: 'selling', saleProceeds: 35_000_000, saleMonthOffset: 3 },
    }
    const inputs: Inputs = {
      ...DEFAULT_INPUTS,
      plans: { custom: [mine], shown: ['mine'] },
    }
    expect(report(inputs).variants.map((variant) => variant.id)).toEqual(['mine'])
  })

  describe('delayed Halyk without an Otbasy purchase', () => {
    // Otbasy buys on month 7 by default, so a six-month horizon denies it. Show
    // the delayed plan so its dropping is observable.
    const tooShort = withDelayed({ ...DEFAULT_INPUTS, horizonMonths: 6 })

    it('is dropped: there is no window to chain to', () => {
      const r = report(tooShort)
      expect(r.variants.find((variant) => variant.id === 'otbasy')!.purchaseMonth).toBeNull()
      expect(r.variants.map((variant) => variant.id)).toEqual(['halyk', 'otbasy', 'all-cash'])
    })

    // A shown plan that got dropped is named, so the board can say why it is gone
    // rather than letting it vanish.
    it('names the dropped shown plan', () => {
      expect(report(tooShort).droppedShown).toContain('Halyk отложенно (test)')
    })

    it('is kept when the window is set by hand, which needs no Otbasy', () => {
      const explicit = { ...tooShort, delayedSavingMonths: 3 }
      expect(report(explicit).variants.map((variant) => variant.id)).toEqual([
        'halyk',
        'otbasy',
        'all-cash',
        'halyk-delayed-test',
      ])
    })
  })

  it('picks the highest net worth as best', () => {
    const r = report(DEFAULT_INPUTS)
    const richest = [...r.variants].sort(
      (left, right) => right.totals.netWorthAtEnd - left.totals.netWorthAtEnd,
    )[0]
    expect(r.bestVariant).toBe(richest!.id)
  })

  it('has no best and an empty board when nothing is shown', () => {
    const hidden: Inputs = { ...DEFAULT_INPUTS, plans: { ...DEFAULT_INPUTS.plans, shown: [] } }
    const r = report(hidden)
    expect(r.variants).toEqual([])
    expect(r.bestVariant).toBeNull()
  })

  // bestVariant is chosen over the shown plans only: a hidden plan cannot win a
  // comparison the user did not ask for.
  it('ranks over the shown plans, not the hidden ones', () => {
    const onlyCash: Inputs = {
      ...DEFAULT_INPUTS,
      plans: { ...DEFAULT_INPUTS.plans, shown: ['all-cash'] },
    }
    expect(report(onlyCash).bestVariant).toBe('all-cash')
  })

  describe('comparison window', () => {
    it('ends the month the last shown variant clears its debt', () => {
      const r = report(DEFAULT_INPUTS)
      const slowest = Math.max(...r.variants.map((variant) => variant.debtFreeMonth!))
      expect(r.comparisonMonths).toBe(slowest + 1)
      expect(r.comparisonMonths).toBeLessThan(DEFAULT_INPUTS.horizonMonths)
    })

    it('cuts every variant to the same window, not to its own finish', () => {
      const r = report(DEFAULT_INPUTS)
      for (const variant of r.variants) {
        expect(variant.rows).toHaveLength(r.comparisonMonths)
      }
    })

    it('totals are recomputed on the window, not carried from the horizon', () => {
      const r = report(DEFAULT_INPUTS)
      for (const variant of r.variants) {
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
    it('runs to the horizon when a shown variant never gets out of debt', () => {
      const short = { ...DEFAULT_INPUTS, horizonMonths: 6 }
      const r = report(short)
      expect(r.variants.some((variant) => variant.debtFreeMonth === null)).toBe(true)
      expect(r.comparisonMonths).toBe(6)
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
    const r = report(withDelayed(DEFAULT_INPUTS))
    const otbasy = r.variants.find((variant) => variant.id === 'otbasy')!
    const delayed = r.variants.find((variant) => variant.id === 'halyk-delayed-test')!
    expectSameRun(
      delayed,
      simulateHalykDelayed(DEFAULT_INPUTS, otbasy.purchaseMonth!),
      r.comparisonMonths,
    )
  })

  it('honours an explicit savings window over the chain', () => {
    const inputs = { ...withDelayed(DEFAULT_INPUTS), delayedSavingMonths: 24 }
    const r = report(inputs)
    const delayed = r.variants.find((variant) => variant.id === 'halyk-delayed-test')!
    expectSameRun(delayed, simulateHalykDelayed(inputs, 24), r.comparisonMonths)
  })
})
