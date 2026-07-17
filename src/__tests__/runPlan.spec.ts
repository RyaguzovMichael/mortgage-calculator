import { describe, it, expect } from 'vitest'
import { runPlan } from '@/engine/runPlan'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { Inputs } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'

// A market that grows, so "buy later" costs more and the choices separate.
const GROWING: Inputs = {
  ...DEFAULT_INPUTS,
  apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.05 },
}

function plan(overrides: Partial<PurchasePlan>): PurchasePlan {
  return {
    id: 'test',
    name: 'Test',
    loan: 'halyk',
    buyWhen: 'asap',
    saveMonths: null,
    borrow: 'max',
    repay: 'monthly',
    ...overrides,
  }
}

describe('runPlan built from the constructor', () => {
  it('borrow min opens a smaller loan than borrow max, so it pays less interest', () => {
    const max = runPlan(DEFAULT_INPUTS, plan({ borrow: 'max' }))
    const min = runPlan(DEFAULT_INPUTS, plan({ borrow: 'min', buyWhen: 'after-months', saveMonths: 0 }))
    expect(min.totals.loanInterestPaid).toBeLessThan(max.totals.loanInterestPaid)
  })

  // Both repayment styles settle the loan. They differ less than you'd expect in
  // the current model: payScheduled applies the whole month's budget, so there is
  // rarely a surplus for "lump" to save — the distinction bites only on the final
  // partial month. (A known limitation, noted for later, not fixed in this refactor
  // because changing payScheduled would move every number.)
  it('settles the loan under either repayment style', () => {
    const monthly = runPlan(DEFAULT_INPUTS, plan({ repay: 'monthly' }))
    const lump = runPlan(DEFAULT_INPUTS, plan({ repay: 'lump' }))
    expect(monthly.debtFreeMonth).not.toBeNull()
    expect(lump.debtFreeMonth).not.toBeNull()
  })

  it('after-months buys later, and later means a higher price when the market grows', () => {
    const asap = runPlan(GROWING, plan({ buyWhen: 'asap' }))
    const waited = runPlan(GROWING, plan({ buyWhen: 'after-months', saveMonths: 24 }))
    expect(waited.purchaseMonth!).toBeGreaterThan(asap.purchaseMonth!)
    expect(waited.purchasePrice!).toBeGreaterThan(asap.purchasePrice!)
  })

  it('loan none never borrows and is debt-free the moment it buys', () => {
    const cash = runPlan(DEFAULT_INPUTS, plan({ loan: 'none' }))
    expect(cash.debtFreeMonth).toBe(cash.purchaseMonth)
    for (const row of cash.rows) expect(row.loanBalance).toBe(0)
  })

  // The whole point of the constructor: a combination none of the four built-ins
  // use (Otbasy gates + aggressive monthly repayment) still runs and settles.
  it('runs a combination the built-ins do not have', () => {
    const hybrid = runPlan(DEFAULT_INPUTS, plan({ loan: 'otbasy', buyWhen: 'otbasy-gates', repay: 'monthly' }))
    expect(hybrid.purchaseMonth).not.toBeNull()
    expect(hybrid.rows[hybrid.rows.length - 1]!.loanBalance).toBe(0)
  })

  it('carries its id and name onto the result', () => {
    const result = runPlan(DEFAULT_INPUTS, plan({ id: 'my-plan' }))
    expect(result.id).toBe('my-plan')
  })
})
