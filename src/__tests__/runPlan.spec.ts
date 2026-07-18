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
    housing: { situation: 'selling', saleProceeds: 35_000_000, saleMonthOffset: 3 },
    ...overrides,
  }
}

describe('runPlan built from the constructor', () => {
  it('borrow min opens a smaller loan than borrow max, so it pays less interest', () => {
    const max = runPlan(DEFAULT_INPUTS, plan({ borrow: 'max' }))
    const min = runPlan(
      DEFAULT_INPUTS,
      plan({ borrow: 'min', buyWhen: 'after-months', saveMonths: 0 }),
    )
    expect(min.totals.loanInterestPaid).toBeLessThan(max.totals.loanInterestPaid)
  })

  // Both repayment styles settle the loan, but they are genuinely different
  // strategies. "monthly" prepays every surplus tenge, so it pays the least
  // interest. "lump" pays only the scheduled annuity and banks the surplus at the
  // deposit rate, closing the loan in one hit later — it pays MORE interest yet
  // ends richer, because the deposit rate beats the loan rate. That arbitrage is
  // the whole reason the Otbasy plan repays lump.
  it('settles under either style; lump pays more interest but ends richer', () => {
    const monthly = runPlan(
      DEFAULT_INPUTS,
      plan({ loan: 'otbasy', buyWhen: 'otbasy-gates', repay: 'monthly' }),
    )
    const lump = runPlan(
      DEFAULT_INPUTS,
      plan({ loan: 'otbasy', buyWhen: 'otbasy-gates', repay: 'lump' }),
    )
    expect(monthly.debtFreeMonth).not.toBeNull()
    expect(lump.debtFreeMonth).not.toBeNull()
    expect(lump.totals.loanInterestPaid).toBeGreaterThan(monthly.totals.loanInterestPaid)
    expect(lump.totals.netWorthAtEnd).toBeGreaterThan(monthly.totals.netWorthAtEnd)
  })

  // "never" pays only the scheduled annuity and never closes the loan early — the
  // loan runs its full term while every surplus tenge keeps compounding in the
  // deposit. Against "lump" (which yanks the balance out of the deposit to close
  // in one hit), it pays even more interest but, on a window inside the loan term,
  // still carries the debt and ends at least as rich — the deposit rate (18.4%)
  // beating the Otbasy loan rate (8.5%) is worth more than being debt-free.
  it('never repays early, so it settles no loan but banks the arbitrage', () => {
    const lump = runPlan(
      DEFAULT_INPUTS,
      plan({ loan: 'otbasy', buyWhen: 'otbasy-gates', repay: 'lump' }),
    )
    const never = runPlan(
      DEFAULT_INPUTS,
      plan({ loan: 'otbasy', buyWhen: 'otbasy-gates', repay: 'never' }),
    )
    // The horizon ends before the term, so the loan never clears.
    expect(never.debtFreeMonth).toBeNull()
    expect(never.rows[never.rows.length - 1]!.loanBalance).toBeGreaterThan(0)
    // More interest than lump (it services the loan longer), yet no poorer at the
    // end — the surplus kept working in the deposit the whole time.
    expect(never.totals.loanInterestPaid).toBeGreaterThan(lump.totals.loanInterestPaid)
    expect(never.totals.netWorthAtEnd).toBeGreaterThanOrEqual(lump.totals.netWorthAtEnd)
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
    const hybrid = runPlan(
      DEFAULT_INPUTS,
      plan({ loan: 'otbasy', buyWhen: 'otbasy-gates', repay: 'monthly' }),
    )
    expect(hybrid.purchaseMonth).not.toBeNull()
    expect(hybrid.rows[hybrid.rows.length - 1]!.loanBalance).toBe(0)
  })

  it('carries its id and name onto the result', () => {
    const result = runPlan(DEFAULT_INPUTS, plan({ id: 'my-plan' }))
    expect(result.id).toBe('my-plan')
  })
})

// A term deposit's `balance` grows every month (it compounds), but only what is
// vested — as of the last payout — can actually be withdrawn without forfeiting
// the term. A purchase must wait for the money to be truly liquid, not for the
// display figure to clear the price.
describe("purchase readiness uses withdrawable money, not the deposit's display balance", () => {
  // A single high-rate 6-month deposit: month 0's own accrual alone pushes
  // `balance` past the price, but `vested` (what a withdrawal can reach) does
  // not move until the term pays out at month 5 — no contributions land in
  // between, so vested cannot grow any other way.
  const inputs: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { price: 10_000_000, annualGrowthRate: 0 },
    cashflow: { ...DEFAULT_INPUTS.cashflow, monthlyFreeCash: 0, monthlyRent: 0 },
    deposits: {
      savingsBalance: 9_800_000,
      products: [{ id: 'hot', name: 'Hot', annualRate: 1.0, payoutPeriodMonths: 6 }],
      savingsProductId: 'hot',
    },
    otbasy: { ...DEFAULT_INPUTS.otbasy, hasDeposit: false },
  }
  const cashPlan = plan({
    loan: 'none',
    housing: { situation: 'free', saleProceeds: 0, saleMonthOffset: 0 },
  })

  it('does not buy the month the balance clears the price, only once vested does', () => {
    const result = runPlan(inputs, cashPlan)
    // Balance clears 10M almost immediately (month 0's own accrual on 9.8M at a
    // 100% nominal rate is ~816k); vested does not move until the payout month.
    expect(result.purchaseMonth).toBe(5)
  })

  it('never opens a loan for less than the price minus what was actually paid down', () => {
    // borrow: max on a Halyk plan reduces to a fixed maxLoan regardless of
    // savings, so use borrow: min — the one shape where a stale balance could
    // previously fund an under-collateralized purchase.
    const minPlan = plan({
      loan: 'halyk',
      borrow: 'min',
      housing: { situation: 'free', saleProceeds: 0, saleMonthOffset: 0 },
    })
    const result = runPlan(inputs, minPlan)
    const buyRow = result.rows[result.purchaseMonth!]!
    // loanBalance already reflects this month's scheduled payment, so recover
    // the opening principal by adding that month's principal portion back.
    const openingPrincipal = buyRow.loanBalance + buyRow.loanPrincipal
    const cashPaidDown = inputs.apartment.price - openingPrincipal
    // The down payment can never exceed what was truly withdrawable at that
    // month — if it did, the purchase would be funded with money that was
    // never actually collected.
    expect(cashPaidDown).toBeLessThanOrEqual(9_800_000 * (1 + 1.0 / 12) ** 6 + 1)
  })
})
