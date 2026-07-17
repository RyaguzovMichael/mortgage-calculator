import { describe, it, expect } from 'vitest'
import { simulateHalykImmediate } from '@/engine/variants/halykImmediate'
import { simulateHalykDelayed } from '@/engine/variants/halykDelayed'
import { simulateOtbasy } from '@/engine/variants/otbasy'
import { simulateAllCash } from '@/engine/variants/allCash'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import { existingBalance, type Inputs } from '@/engine/types/inputs'
import type { VariantResult } from '@/engine/types/plan'

function withRent(monthlyRent: number): Inputs {
  return { ...DEFAULT_INPUTS, cashflow: { ...DEFAULT_INPUTS.cashflow, monthlyRent } }
}

function allVariants(inputs: Inputs): VariantResult[] {
  return [
    simulateHalykImmediate(inputs),
    simulateHalykDelayed(inputs, 11),
    simulateOtbasy(inputs),
    simulateAllCash(inputs),
  ]
}

describe('every variant', () => {
  const results = allVariants(DEFAULT_INPUTS)

  it.each(results.map((result) => [result.id, result] as const))(
    '%s keeps interest + principal === payment on every row',
    (_id, result) => {
      for (const row of result.rows) {
        expect(row.loanInterest + row.loanPrincipal).toBeCloseTo(row.loanPayment, 6)
      }
    },
  )

  it.each(results.map((result) => [result.id, result] as const))(
    '%s buys the apartment and ends debt-free within the horizon',
    (_id, result) => {
      expect(result.purchaseMonth).not.toBeNull()
      expect(result.debtFreeMonth).not.toBeNull()
      expect(result.rows[result.rows.length - 1]?.loanBalance).toBe(0)
    },
  )

  it.each(results.map((result) => [result.id, result] as const))(
    '%s never carries a negative balance anywhere',
    (_id, result) => {
      for (const row of result.rows) {
        expect(row.loanBalance).toBeGreaterThanOrEqual(0)
        expect(row.savingsBalance).toBeGreaterThanOrEqual(0)
        expect(row.otbasyBalance).toBeGreaterThanOrEqual(0)
      }
    },
  )

  it.each(results.map((result) => [result.id, result] as const))(
    '%s totals reconcile with its rows',
    (_id, result) => {
      const rentPaid = result.rows.reduce((sum, row) => sum + row.rentPaid, 0)
      const interestPaid = result.rows.reduce((sum, row) => sum + row.loanInterest, 0)
      const earned = result.rows.reduce((sum, row) => sum + row.depositInterestEarned, 0)
      const bonus = result.rows.reduce((sum, row) => sum + row.govBonus, 0)
      expect(result.totals.rentPaid).toBeCloseTo(rentPaid, 4)
      expect(result.totals.loanInterestPaid).toBeCloseTo(interestPaid, 4)
      expect(result.totals.depositInterestEarned).toBeCloseTo(earned, 4)
      expect(result.totals.govBonusReceived).toBeCloseTo(bonus, 4)
      expect(result.totals.totalLoss).toBeCloseTo(rentPaid + interestPaid - earned - bonus, 4)
    },
  )
})

describe('Halyk immediate', () => {
  it('pays no rent — it buys the month the sale lands', () => {
    const result = simulateHalykImmediate(DEFAULT_INPUTS)
    expect(result.totals.rentPaid).toBe(0)
    expect(result.purchaseMonth).toBe(DEFAULT_INPUTS.sale.monthOffset)
  })

  // The prototype never checked this: the down payment has to be real money, and
  // a small sale leaves the contribution out of reach for a while.
  it('waits for the down payment to become affordable, renting meanwhile', () => {
    const result = simulateHalykImmediate({
      ...DEFAULT_INPUTS,
      sale: { ...DEFAULT_INPUTS.sale, proceeds: 5_000_000, monthOffset: 0 },
    })
    expect(result.purchaseMonth).toBeGreaterThan(0)
    expect(result.totals.rentPaid).toBeGreaterThan(0)
  })
})

describe('rent', () => {
  it('is what makes saving expensive — at zero rent the savers win', () => {
    const free = withRent(0)
    const immediate = simulateHalykImmediate(free)
    expect(simulateAllCash(free).totals.totalLoss).toBeLessThan(immediate.totals.totalLoss)
    expect(simulateHalykDelayed(free, 11).totals.totalLoss).toBeLessThan(immediate.totals.totalLoss)
  })
})

describe('deposit rate', () => {
  it('with nothing to earn, buying immediately wins', () => {
    // One deposit means one rate to switch off — there is nowhere else for money
    // to be earning.
    const inputs: Inputs = {
      ...DEFAULT_INPUTS,
      deposits: { ...DEFAULT_INPUTS.deposits, savingsAnnualRate: 0 },
      otbasy: { ...DEFAULT_INPUTS.otbasy, depositAnnualRate: 0 },
    }
    const immediate = simulateHalykImmediate(inputs).totals.totalLoss
    expect(immediate).toBeLessThan(simulateAllCash(inputs).totals.totalLoss)
    expect(immediate).toBeLessThan(simulateOtbasy(inputs).totals.totalLoss)
  })
})

describe('apartment price', () => {
  const growing: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.12 },
  }

  // The stated rate is the year-over-year change, not a nominal rate to be
  // compounded monthly: 12% must mean 12% after a year, not 12.68%.
  it('grows by exactly the stated rate over twelve months', () => {
    const rows = simulateHalykImmediate(growing).rows
    expect(rows[12]!.apartmentPrice).toBeCloseTo(DEFAULT_INPUTS.apartment.price * 1.12, 2)
    expect(rows[24]!.apartmentPrice).toBeCloseTo(DEFAULT_INPUTS.apartment.price * 1.12 ** 2, 2)
  })

  it('holds at the list price when growth is off', () => {
    for (const result of allVariants(DEFAULT_INPUTS)) {
      expect(result.purchasePrice).toBe(DEFAULT_INPUTS.apartment.price)
      for (const row of result.rows) {
        expect(row.apartmentPrice).toBe(DEFAULT_INPUTS.apartment.price)
      }
    }
  })

  // At a gentle 5%: enough for waiting to cost something, not so much that
  // all-cash never catches the price at all.
  it('is what each variant actually paid, so waiting costs more', () => {
    const results = allVariants({
      ...DEFAULT_INPUTS,
      apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.05 },
    })
    const immediate = results.find((result) => result.id === 'halyk-immediate')!
    const allCash = results.find((result) => result.id === 'all-cash')!
    expect(allCash.purchaseMonth).toBeGreaterThan(immediate.purchaseMonth!)
    expect(allCash.purchasePrice).toBeGreaterThan(immediate.purchasePrice!)
  })

  // Savings compound at 18.4%; if the flat outruns that, the pile never catches
  // it and there is no month at which cash-buying is possible.
  it('outruns the savings when it grows faster than they do, so all-cash never buys', () => {
    const result = simulateAllCash({
      ...DEFAULT_INPUTS,
      apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.24 },
    })
    expect(result.purchaseMonth).toBeNull()
    expect(result.purchasePrice).toBeNull()
  })

  it('reports the price of the month the variant bought, not of the last row', () => {
    const result = simulateHalykImmediate(growing)
    expect(result.purchasePrice).toBe(result.rows[result.purchaseMonth!]!.apartmentPrice)
  })
})

describe('the flat being sold', () => {
  const growing: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.12 },
  }

  // The default sale lands on month 3, before the first half-year step, so it has
  // to be pushed out to see the appreciation at all.
  function soldOnMonth(inputs: Inputs, monthOffset: number): Inputs {
    return { ...inputs, sale: { ...inputs.sale, monthOffset } }
  }

  it('hands over its appreciated value, not what it is worth today', () => {
    const savingsAtSale = (inputs: Inputs): number =>
      simulateAllCash(soldOnMonth(inputs, 12)).rows[12]!.savingsBalance
    // A year of 12% on 35M is ~4.2M; the only other thing that differs is one
    // month of indexed rent, worth ~48k.
    expect(savingsAtSale(growing)).toBeGreaterThan(savingsAtSale(DEFAULT_INPUTS) + 3_000_000)
  })

  // Selling swaps a flat for cash of equal value; if net worth jumps on that
  // month, one side of the swap is being priced wrong.
  it.each([
    ['flat market', DEFAULT_INPUTS],
    ['rising market', growing],
  ] as const)('does not make net worth jump on the sale month (%s)', (_label, inputs) => {
    const rows = simulateAllCash(inputs).rows
    const before = rows[inputs.sale.monthOffset - 1]!
    const atSale = rows[inputs.sale.monthOffset]!
    // One month of rent and deposit interest apart, not tens of millions.
    expect(Math.abs(atSale.netWorth - before.netWorth)).toBeLessThan(1_500_000)
  })
})

describe('indexation', () => {
  function growingAt(annualGrowthRate: number): Inputs {
    return { ...DEFAULT_INPUTS, apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate } }
  }

  function indexedAt(annualIndexationRate: number): Inputs {
    return { ...DEFAULT_INPUTS, cashflow: { ...DEFAULT_INPUTS.cashflow, annualIndexationRate } }
  }

  it('leaves rent flat when the apartment price is flat', () => {
    for (const row of simulateAllCash(DEFAULT_INPUTS).rows.filter((row) => row.rentPaid > 0)) {
      expect(row.rentPaid).toBeCloseTo(DEFAULT_INPUTS.cashflow.monthlyRent, 6)
    }
  })

  it('raises rent by the apartment growth rate — same market, same rate', () => {
    const rows = simulateAllCash(growingAt(0.12)).rows
    const first = rows.find((row) => row.rentPaid > 0)!
    const twelveMonthsOn = rows[first.index + 12]!
    expect(twelveMonthsOn.rentPaid).toBeCloseTo(first.rentPaid * 1.12, 2)
  })

  // The point of the whole feature: a frozen rent was quietly subsidizing every
  // variant that waits.
  it('makes waiting worse than it looked when the market runs', () => {
    const growing = growingAt(0.12)
    const withFrozenRent = simulateAllCash({ ...growing, cashflow: { ...growing.cashflow } })
    expect(withFrozenRent.totals.rentPaid).toBeGreaterThan(
      simulateAllCash(DEFAULT_INPUTS).totals.rentPaid,
    )
  })

  it('indexes income on its own rate, not the apartment growth rate', () => {
    const flatIncome = simulateHalykImmediate(growingAt(0.12))
    const risingIncome = simulateHalykImmediate({
      ...growingAt(0.12),
      cashflow: { ...DEFAULT_INPUTS.cashflow, annualIndexationRate: 0.12 },
    })
    // Same price, same rent, more cash to throw at the loan: strictly earlier out
    // of debt.
    expect(risingIncome.debtFreeMonth!).toBeLessThan(flatIncome.debtFreeMonth!)
  })

  it('reports the month income on the row, stepping in June', () => {
    const rows = simulateHalykImmediate(indexedAt(0.1)).rows
    expect(rows[0]!.freeCash).toBe(0)
    expect(rows[1]!.freeCash).toBeCloseTo(500_000, 2)
    expect(rows[10]!.freeCash).toBeCloseTo(500_000, 2)
    expect(rows[11]!.freeCash).toBeCloseTo(550_000, 2)
  })

  it('leaves the run untouched at 0% income indexation', () => {
    expect(simulateHalykImmediate(indexedAt(0)).rows).toEqual(
      simulateHalykImmediate(DEFAULT_INPUTS).rows,
    )
  })
})

describe("month 0 consolidation of today's accounts", () => {
  const total = existingBalance(DEFAULT_INPUTS)

  it.each([
    ['halyk-immediate', simulateHalykImmediate(DEFAULT_INPUTS)],
    ['halyk-delayed', simulateHalykDelayed(DEFAULT_INPUTS, 11)],
    ['all-cash', simulateAllCash(DEFAULT_INPUTS)],
  ] as const)('%s puts the lot in the savings deposit and opens no Otbasy account', (_id, result) => {
    expect(result.rows[0]!.savingsBalance).toBeCloseTo(total, 2)
    for (const row of result.rows) {
      expect(row.otbasyBalance).toBe(0)
      expect(row.govBonus).toBe(0)
    }
  })

  it('the Otbasy variant puts the lot on the Otbasy account instead', () => {
    const first = simulateOtbasy(DEFAULT_INPUTS).rows[0]!
    expect(first.savingsBalance).toBe(0)
    // Not exactly `total`: the Otbasy deposit pays monthly, so month 0's own
    // interest is already credited by the time the row is written.
    expect(first.otbasyBalance).toBeGreaterThanOrEqual(total)
    expect(first.otbasyBalance).toBeLessThan(total * 1.01)
  })

  // The three accounts are itemised for provenance; the model only ever sees the
  // sum, so how it is split across them cannot change a single figure.
  it('depends on the total only, not on how it is split across accounts', () => {
    const merged = simulateHalykImmediate({
      ...DEFAULT_INPUTS,
      deposits: {
        ...DEFAULT_INPUTS.deposits,
        accounts: [{ id: 'all', label: 'Всё вместе', balance: total }],
      },
    })
    expect(merged.rows).toEqual(simulateHalykImmediate(DEFAULT_INPUTS).rows)
  })
})

// Consolidation put every tenge in one deposit, which makes that deposit's payout
// cycle decide everything. These pin the sharp edge it created.
describe('one deposit for everything', () => {
  // 12% indexes rent past the flat 500k income around month 30; from there every
  // month needs a withdrawal.
  const growing: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.12 },
  }

  function payingMonthly(inputs: Inputs): Inputs {
    return {
      ...inputs,
      deposits: { ...inputs.deposits, savingsAnnualRate: 0.141, savingsPayoutPeriodMonths: 1 },
    }
  }

  it('a six-month deposit stops earning once every month needs a withdrawal', () => {
    const rows = simulateAllCash(growing).rows
    // Withdrawing forfeits everything accrued since the last payout, so the cycle
    // restarts every month and never completes.
    for (const row of rows.slice(40)) {
      expect(row.depositInterestEarned).toBe(0)
    }
  })

  it('so the lower monthly-payout rate beats the higher six-month one', () => {
    const sixMonth = simulateAllCash(growing).totals.depositInterestEarned
    const monthly = simulateAllCash(payingMonthly(growing)).totals.depositInterestEarned
    expect(monthly).toBeGreaterThan(sixMonth)
  })

  it('while with no withdrawals at all the higher rate wins, as it should', () => {
    // Flat rent stays under the income, so nothing is ever taken out.
    const sixMonth = simulateAllCash(DEFAULT_INPUTS).totals.depositInterestEarned
    const monthly = simulateAllCash(payingMonthly(DEFAULT_INPUTS)).totals.depositInterestEarned
    expect(sixMonth).toBeGreaterThan(monthly)
  })
})

describe('Otbasy seeding', () => {
  // Without a seed the 50% gate is fed only by today's accounts plus what is left
  // after rent, and the wait swallows years of rent — this is the case that makes
  // seeding mandatory. (Consolidation moved this from ~38 months to 29: the
  // existing 2M opens the contract on day one.)
  it('without a seed the gate takes years and rent piles up', () => {
    const unseeded = simulateOtbasy({
      ...DEFAULT_INPUTS,
      horizonMonths: 120,
      otbasy: { ...DEFAULT_INPUTS.otbasy, seedFromSale: 0 },
    })
    expect(unseeded.purchaseMonth).toBeGreaterThan(24)
    expect(unseeded.totals.rentPaid).toBeGreaterThan(10_000_000)
  })

  it('seeding pulls the purchase years earlier', () => {
    const seeded = simulateOtbasy(DEFAULT_INPUTS)
    const unseeded = simulateOtbasy({
      ...DEFAULT_INPUTS,
      horizonMonths: 120,
      otbasy: { ...DEFAULT_INPUTS.otbasy, seedFromSale: 0 },
    })
    expect(seeded.purchaseMonth).toBeLessThan(unseeded.purchaseMonth!)
  })
})
