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

// The lump/never arbitrage tests below need a deposit that both beats the
// Otbasy loan rate (8.5%) and locks for long enough that "lump" cannot yank
// the balance out the moment it clears the loan — a custom product, not one
// of the catalogue's, so the scenario does not drift if data/deposits.yml
// changes.
const LOCKED_HIGH_RATE_ID = 'locked-high-rate'
const WITH_LOCKED_HIGH_RATE: Inputs = {
  ...DEFAULT_INPUTS,
  deposits: {
    ...DEFAULT_INPUTS.deposits,
    products: [
      ...DEFAULT_INPUTS.deposits.products,
      { id: LOCKED_HIGH_RATE_ID, name: 'Locked', annualRate: 0.184, payoutPeriodMonths: 6 },
    ],
  },
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
    term: 'max',
    situation: 'selling',
    saleMonthOffset: 3,
    savingsProductId: 'kaspi-deposit',
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
      WITH_LOCKED_HIGH_RATE,
      plan({
        loan: 'otbasy',
        buyWhen: 'otbasy-gates',
        repay: 'monthly',
        savingsProductId: LOCKED_HIGH_RATE_ID,
      }),
    )
    const lump = runPlan(
      WITH_LOCKED_HIGH_RATE,
      plan({
        loan: 'otbasy',
        buyWhen: 'otbasy-gates',
        repay: 'lump',
        savingsProductId: LOCKED_HIGH_RATE_ID,
      }),
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
      WITH_LOCKED_HIGH_RATE,
      plan({
        loan: 'otbasy',
        buyWhen: 'otbasy-gates',
        repay: 'lump',
        savingsProductId: LOCKED_HIGH_RATE_ID,
      }),
    )
    const never = runPlan(
      WITH_LOCKED_HIGH_RATE,
      plan({
        loan: 'otbasy',
        buyWhen: 'otbasy-gates',
        repay: 'never',
        savingsProductId: LOCKED_HIGH_RATE_ID,
      }),
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
    cashflow: { ...DEFAULT_INPUTS.cashflow, monthlySalary: 0, monthlyRent: 0 },
    deposits: {
      savingsBalance: 9_800_000,
      products: [{ id: 'hot', name: 'Hot', annualRate: 1.0, payoutPeriodMonths: 6 }],
    },
    otbasy: { ...DEFAULT_INPUTS.otbasy, hasDeposit: false },
  }
  const cashPlan = plan({ loan: 'none', situation: 'free', savingsProductId: 'hot' })

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
      situation: 'free',
      savingsProductId: 'hot',
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

describe('the 50%-of-salary lending cap', () => {
  // No flat to sell, so the target loan is the whole price; huge savings so the
  // down payment never binds and only the annuity-vs-income gate can defer a buy.
  // Share is 1.0, so a pure "annuity <= free cash" gate would allow a payment up to
  // the full salary — the 50% cap is what actually holds it to half.
  const rich = (price: number): Inputs => ({
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, price, annualGrowthRate: 0 },
    existingApartment: { owned: false, price: 0 },
    cashflow: {
      ...DEFAULT_INPUTS.cashflow,
      monthlySalary: 1_000_000,
      mortgageShare: 1,
      annualIndexationRate: 0,
    },
    deposits: { ...DEFAULT_INPUTS.deposits, savingsBalance: 50_000_000 },
  })
  const freePlan = plan({ loan: 'halyk', borrow: 'max', situation: 'free' })

  it('buys when the annuity is under half the salary', () => {
    // 25M price → 20M loan → ~403k/mo, under the 500k ceiling.
    expect(runPlan(rich(25_000_000), freePlan).purchaseMonth).toBe(0)
  })

  it('refuses the loan when the annuity exceeds half the salary', () => {
    // 40M price → 32M loan → ~645k/mo. The borrower is willing (share 1.0, free
    // cash 1,000,000) and can cover the down payment, but the bank will not lend
    // past 500k, so the purchase never happens.
    expect(runPlan(rich(40_000_000), freePlan).purchaseMonth).toBeNull()
  })
})

describe('shortest-term plans', () => {
  // repay: never so the term itself drives the payoff (monthly would prepay the
  // surplus regardless of term). Same plan, only term differs.
  const hold = (term: 'max' | 'shortest'): Inputs['plans']['custom'][number] =>
    plan({ loan: 'halyk', borrow: 'max', repay: 'never', term })

  it('opens a shorter, higher-paying loan than its max-term twin', () => {
    const max = runPlan(DEFAULT_INPUTS, hold('max'))
    const shortest = runPlan(DEFAULT_INPUTS, hold('shortest'))

    // A month both variants own the flat (purchase lands on the sale month, 3).
    const paymentAt = (result: typeof max, month: number): number => result.rows[month]!.loanPayment
    expect(paymentAt(shortest, 12)).toBeGreaterThan(paymentAt(max, 12))

    // The max-term loan (240 months) cannot clear inside the 60-month horizon;
    // the shortest one is sized to finish far sooner.
    expect(max.debtFreeMonth).toBeNull()
    expect(shortest.debtFreeMonth).not.toBeNull()
  })
})
