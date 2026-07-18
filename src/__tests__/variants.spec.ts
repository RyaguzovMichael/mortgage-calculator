import { describe, it, expect } from 'vitest'
import { runPlan } from '@/engine/runPlan'
import { BUILT_IN_PLANS } from '@/infrastructure/planCatalogue'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import { startingMoney, type HousingInputs, type Inputs } from '@/engine/types/inputs'
import type { PurchasePlan, VariantResult } from '@/engine/types/plan'

// The three built-ins now live in data/plans.yml and run through the shared
// driver. These shims keep the per-variant behaviour tests reading the same as
// before. Housing lives on the plan now, so a shim that needs to vary it takes
// an override.
const builtIn = (id: string): PurchasePlan => BUILT_IN_PLANS.find((plan) => plan.id === id)!
const withHousing = (plan: PurchasePlan, housing: Partial<HousingInputs>): PurchasePlan => ({
  ...plan,
  housing: { ...plan.housing, ...housing },
})
const simulateHalyk = (inputs: Inputs, housing?: Partial<HousingInputs>): VariantResult =>
  runPlan(inputs, housing ? withHousing(builtIn('halyk'), housing) : builtIn('halyk'))
const simulateOtbasy = (inputs: Inputs): VariantResult => runPlan(inputs, builtIn('otbasy'))
const simulateAllCash = (inputs: Inputs, housing?: Partial<HousingInputs>): VariantResult =>
  runPlan(inputs, housing ? withHousing(builtIn('all-cash'), housing) : builtIn('all-cash'))
// "Halyk отложенно" is no longer a built-in — the after-months/min-down/chained
// shape it used to demonstrate is still a legitimate custom plan, so this shim
// builds one by hand, on the same housing as the Halyk built-in.
const simulateHalykDelayed = (inputs: Inputs, savingMonths: number): VariantResult =>
  runPlan(inputs, {
    id: 'halyk-delayed-test',
    name: 'Halyk отложенно (test)',
    loan: 'halyk',
    buyWhen: 'after-months',
    saveMonths: savingMonths,
    borrow: 'min',
    repay: 'monthly',
    housing: builtIn('halyk').housing,
  })

function withRent(monthlyRent: number): Inputs {
  return { ...DEFAULT_INPUTS, cashflow: { ...DEFAULT_INPUTS.cashflow, monthlyRent } }
}

function allVariants(inputs: Inputs): VariantResult[] {
  return [
    simulateHalyk(inputs),
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
    },
  )
})

describe('Halyk', () => {
  it('pays no rent — it buys the month the sale lands', () => {
    const result = simulateHalyk(DEFAULT_INPUTS)
    expect(result.totals.rentPaid).toBe(0)
    expect(result.purchaseMonth).toBe(builtIn('halyk').housing.saleMonthOffset)
  })

  // The prototype never checked this: the down payment has to be real money, and
  // a small sale leaves the contribution out of reach for a while. The loan itself
  // still has to stay small enough for the bank to service — see below.
  it('waits for the down payment to become affordable, renting meanwhile', () => {
    const result = simulateHalyk(DEFAULT_INPUTS, {
      saleProceeds: 28_000_000,
      saleMonthOffset: 0,
    })
    expect(result.purchaseMonth).toBeGreaterThan(0)
    expect(result.totals.rentPaid).toBeGreaterThan(0)
  })

  // A bank checks the annuity against income, not just the down payment: a small
  // sale shrinks the down payment AND grows the loan, and a loan big enough can
  // never be serviced on this income — the plan simply never buys.
  it('never buys when the resulting loan is too big to service on this income', () => {
    const result = simulateHalyk(DEFAULT_INPUTS, {
      saleProceeds: 5_000_000,
      saleMonthOffset: 0,
    })
    expect(result.purchaseMonth).toBeNull()
  })
})

describe('solvency', () => {
  // Same loan that variants.spec's "never buys" case cannot service on a flat
  // 500k/month — but here income is indexed, so a later June raise closes the
  // gap and the bank issues the loan once it does.
  it('buys once an indexed raise makes the annuity affordable', () => {
    const result = simulateHalyk(
      { ...DEFAULT_INPUTS, cashflow: { ...DEFAULT_INPUTS.cashflow, annualIndexationRate: 0.5 } },
      { saleProceeds: 5_000_000, saleMonthOffset: 0 },
    )
    expect(result.purchaseMonth).not.toBeNull()
    expect(result.purchaseMonth).toBeGreaterThan(0)
  })
})

describe('rent', () => {
  it('is what makes saving expensive — at zero rent the savers win', () => {
    const free = withRent(0)
    const immediate = simulateHalyk(free)
    expect(simulateAllCash(free).totals.netWorthAtEnd).toBeGreaterThan(
      immediate.totals.netWorthAtEnd,
    )
    expect(simulateHalykDelayed(free, 11).totals.netWorthAtEnd).toBeGreaterThan(
      immediate.totals.netWorthAtEnd,
    )
  })
})

describe('housing situation', () => {
  function situated(situation: 'selling' | 'free' | 'renting'): Partial<HousingInputs> {
    return { situation }
  }

  it('living rent-free pays no rent at all', () => {
    const result = simulateAllCash(DEFAULT_INPUTS, situated('free'))
    expect(result.totals.rentPaid).toBe(0)
    for (const row of result.rows) expect(row.phase).not.toBe('renting')
  })

  it('renting pays rent from month 0, before any sale month would land', () => {
    const rows = simulateAllCash(DEFAULT_INPUTS, situated('renting')).rows
    // Rent for this kind of flat is 400k; month 0 is well before the default
    // sale month of 3, so a sale-gated model would show zero here.
    expect(rows[0]!.rentPaid).toBeCloseTo(DEFAULT_INPUTS.cashflow.monthlyRent, 2)
    expect(rows[0]!.phase).toBe('renting')
  })

  it('with no sale there are no proceeds, so the loan is too big to ever qualify for', () => {
    const selling = simulateHalyk(DEFAULT_INPUTS, situated('selling'))
    const free = simulateHalyk(DEFAULT_INPUTS, situated('free'))
    // Selling hands over 35M at month 3, shrinking the loan to something this
    // income can service. Without it the target loan is the full 45M apartment —
    // a bank would never issue that against 500k/month, so the plan never buys.
    expect(selling.purchaseMonth).not.toBeNull()
    expect(free.purchaseMonth).toBeNull()
  })

  it('rent-free vs renting differ only by the rent, not the purchase timing', () => {
    // Neither has proceeds, so both save the same way; only the rent burden differs.
    const free = simulateHalyk(DEFAULT_INPUTS, situated('free'))
    const renting = simulateHalyk(DEFAULT_INPUTS, situated('renting'))
    expect(free.totals.rentPaid).toBe(0)
    expect(renting.totals.rentPaid).toBeGreaterThan(0)
  })
})

describe('deposit rate', () => {
  it('with nothing to earn, buying immediately wins', () => {
    // One deposit means one rate to switch off — there is nowhere else for money
    // to be earning.
    const inputs: Inputs = {
      ...DEFAULT_INPUTS,
      deposits: {
        ...DEFAULT_INPUTS.deposits,
        products: [{ id: 'zero', name: 'Под матрасом', annualRate: 0, payoutPeriodMonths: 1 }],
        savingsProductId: 'zero',
      },
      otbasy: { ...DEFAULT_INPUTS.otbasy, depositAnnualRate: 0 },
    }
    const immediate = simulateHalyk(inputs).totals.netWorthAtEnd
    expect(immediate).toBeGreaterThan(simulateAllCash(inputs).totals.netWorthAtEnd)
    expect(immediate).toBeGreaterThan(simulateOtbasy(inputs).totals.netWorthAtEnd)
  })
})

describe('apartment price', () => {
  const flat: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0 },
  }
  const growing: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.12 },
  }

  // The stated rate is the year-over-year change, not a nominal rate to be
  // compounded monthly: 12% must mean 12% after a year, not 12.68%.
  it('grows by exactly the stated rate over twelve months', () => {
    const rows = simulateHalyk(growing).rows
    expect(rows[12]!.apartmentPrice).toBeCloseTo(DEFAULT_INPUTS.apartment.price * 1.12, 2)
    expect(rows[24]!.apartmentPrice).toBeCloseTo(DEFAULT_INPUTS.apartment.price * 1.12 ** 2, 2)
  })

  it('holds at the list price when growth is off', () => {
    for (const result of allVariants(flat)) {
      expect(result.purchasePrice).toBe(flat.apartment.price)
      for (const row of result.rows) {
        expect(row.apartmentPrice).toBe(flat.apartment.price)
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
    const immediate = results.find((result) => result.id === 'halyk')!
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
    const result = simulateHalyk(growing)
    expect(result.purchasePrice).toBe(result.rows[result.purchaseMonth!]!.apartmentPrice)
  })
})

describe('the flat being sold', () => {
  const flat: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0 },
  }
  const growing: Inputs = {
    ...DEFAULT_INPUTS,
    apartment: { ...DEFAULT_INPUTS.apartment, annualGrowthRate: 0.12 },
  }

  // The default sale lands on month 3, before the first half-year step, so it has
  // to be pushed out to see the appreciation at all.
  function soldOnMonth(saleMonthOffset: number): Partial<HousingInputs> {
    return { saleMonthOffset }
  }

  it('hands over its appreciated value, not what it is worth today', () => {
    const savingsAtSale = (inputs: Inputs): number =>
      simulateAllCash(inputs, soldOnMonth(12)).rows[12]!.savingsBalance
    // A year of 12% on 35M is ~4.2M; the only other thing that differs is one
    // month of indexed rent, worth ~48k.
    expect(savingsAtSale(growing)).toBeGreaterThan(savingsAtSale(flat) + 3_000_000)
  })

  // Selling swaps a flat for cash of equal value; if net worth jumps on that
  // month, one side of the swap is being priced wrong.
  const saleMonth = builtIn('all-cash').housing.saleMonthOffset
  it.each([
    ['flat market', flat],
    ['rising market', growing],
  ] as const)('does not make net worth jump on the sale month (%s)', (_label, inputs) => {
    const rows = simulateAllCash(inputs).rows
    const before = rows[saleMonth - 1]!
    const atSale = rows[saleMonth]!
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
    for (const row of simulateAllCash(growingAt(0)).rows.filter((row) => row.rentPaid > 0)) {
      expect(row.rentPaid).toBeCloseTo(DEFAULT_INPUTS.cashflow.monthlyRent, 6)
    }
  })

  it('raises rent by the apartment growth rate — same market, same rate', () => {
    const rows = simulateAllCash(growingAt(0.12)).rows
    const first = rows.find((row) => row.rentPaid > 0)!
    const twelveMonthsOn = rows[first.index + 12]!
    expect(twelveMonthsOn.rentPaid).toBeCloseTo(first.rentPaid * 1.12, 2)
  })

  // The point of the whole feature: indexed rent makes the total exceed
  // months × base, so a variant that waits pays more than a flat-rent estimate.
  // (The old version spread growing.cashflow into itself — nothing was frozen, and
  // it merely restated rentAt.)
  it('makes total rent exceed months × base rate once the market runs', () => {
    const base = DEFAULT_INPUTS.cashflow.monthlyRent

    const growing = simulateAllCash(growingAt(0.12))
    const growingMonths = growing.rows.filter((row) => row.rentPaid > 0).length
    expect(growing.totals.rentPaid).toBeGreaterThan(growingMonths * base)

    const flat = simulateAllCash(growingAt(0))
    const flatMonths = flat.rows.filter((row) => row.rentPaid > 0).length
    expect(flat.totals.rentPaid).toBeCloseTo(flatMonths * base, 2)
  })

  it('indexes income on its own rate, not the apartment growth rate', () => {
    const flatIncome = simulateHalyk(growingAt(0.12))
    const risingIncome = simulateHalyk({
      ...growingAt(0.12),
      cashflow: { ...DEFAULT_INPUTS.cashflow, annualIndexationRate: 0.12 },
    })
    // Same price, same rent, more cash to throw at the loan: strictly earlier out
    // of debt.
    expect(risingIncome.debtFreeMonth!).toBeLessThan(flatIncome.debtFreeMonth!)
  })

  it('reports the month income on the row, stepping in June', () => {
    const rows = simulateHalyk(indexedAt(0.1)).rows
    expect(rows[0]!.freeCash).toBe(0)
    expect(rows[1]!.freeCash).toBeCloseTo(500_000, 2)
    expect(rows[10]!.freeCash).toBeCloseTo(500_000, 2)
    expect(rows[11]!.freeCash).toBeCloseTo(550_000, 2)
  })

  it('leaves the run untouched at 0% income indexation', () => {
    expect(simulateHalyk(indexedAt(0)).rows).toEqual(simulateHalyk(DEFAULT_INPUTS).rows)
  })
})

describe("month 0 consolidation of today's accounts", () => {
  const total = startingMoney(DEFAULT_INPUTS)

  it.each([
    ['halyk', simulateHalyk(DEFAULT_INPUTS)],
    ['halyk-delayed', simulateHalykDelayed(DEFAULT_INPUTS, 11)],
    ['all-cash', simulateAllCash(DEFAULT_INPUTS)],
  ] as const)(
    '%s puts the lot in the savings deposit and opens no Otbasy account',
    (_id, result) => {
      // Not exactly `total`: the savings deposit compounds monthly (18.4%) even
      // though it only pays out every 6 months, so month 0's own interest
      // already shows in the balance by the time the row is written.
      expect(result.rows[0]!.savingsBalance).toBeCloseTo(total * (1 + 0.184 / 12), 2)
      for (const row of result.rows) {
        expect(row.otbasyBalance).toBe(0)
        expect(row.govBonus).toBe(0)
      }
    },
  )

  it('the Otbasy variant puts the lot on the Otbasy account instead', () => {
    const first = simulateOtbasy(DEFAULT_INPUTS).rows[0]!
    expect(first.savingsBalance).toBe(0)
    // Not exactly `total`: the Otbasy deposit pays monthly, so month 0's own
    // interest is already credited by the time the row is written.
    expect(first.otbasyBalance).toBeGreaterThanOrEqual(total)
    expect(first.otbasyBalance).toBeLessThan(total * 1.01)
  })

  // Month 0 merges the two anyway, so where the money sits today cannot change a
  // single row of a variant that does not use Otbasy.
  it('depends on the total only, not on the split between savings and Otbasy', () => {
    const allInSavings = simulateHalyk({
      ...DEFAULT_INPUTS,
      deposits: { ...DEFAULT_INPUTS.deposits, savingsBalance: total },
      otbasy: { ...DEFAULT_INPUTS.otbasy, balance: 0 },
    })
    expect(allInSavings.rows).toEqual(simulateHalyk(DEFAULT_INPUTS).rows)
  })

  it('drops the Otbasy money when the toggle says there is no such account', () => {
    const without = simulateHalyk({
      ...DEFAULT_INPUTS,
      otbasy: { ...DEFAULT_INPUTS.otbasy, hasDeposit: false },
    })
    const base = DEFAULT_INPUTS.deposits.savingsBalance
    expect(without.rows[0]!.savingsBalance).toBeCloseTo(base * (1 + 0.184 / 12), 2)
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

  // Selects the catalogue's monthly-payout deposit by id, rather than restating
  // its numbers here where they could drift from data/deposits.yml.
  function payingMonthly(inputs: Inputs): Inputs {
    return { ...inputs, deposits: { ...inputs.deposits, savingsProductId: 'kaspi-savings' } }
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
