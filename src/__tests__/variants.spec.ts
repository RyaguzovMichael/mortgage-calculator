import { describe, it, expect } from 'vitest'
import { simulateHalykImmediate } from '@/engine/variants/halykImmediate'
import { simulateHalykDelayed } from '@/engine/variants/halykDelayed'
import { simulateOtbasy } from '@/engine/variants/otbasy'
import { simulateAllCash } from '@/engine/variants/allCash'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { Inputs } from '@/engine/types/inputs'
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

  // The prototype never checked this; the down payment has to come from
  // somewhere, and at month 0 only the unlocked account is spendable.
  it('waits for the down payment to become affordable', () => {
    const result = simulateHalykImmediate({
      ...DEFAULT_INPUTS,
      sale: { ...DEFAULT_INPUTS.sale, monthOffset: 0 },
    })
    expect(result.purchaseMonth).toBeGreaterThan(0)
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
    const inputs: Inputs = {
      ...DEFAULT_INPUTS,
      // The sale proceeds are the biggest earner by far — zeroing only the
      // account rates would leave 35M still compounding at 18.4%.
      sale: { ...DEFAULT_INPUTS.sale, depositAnnualRate: 0 },
      deposits: {
        newDepositAnnualRate: 0,
        newDepositPayoutPeriodMonths: 1,
        accounts: DEFAULT_INPUTS.deposits.accounts.map((account) => ({ ...account, annualRate: 0 })),
      },
    }
    const immediate = simulateHalykImmediate(inputs).totals.totalLoss
    expect(immediate).toBeLessThan(simulateAllCash(inputs).totals.totalLoss)
    expect(immediate).toBeLessThan(simulateOtbasy(inputs).totals.totalLoss)
  })
})

describe('the Otbasy account in variants that never borrow from Otbasy', () => {
  const otbasySavings = DEFAULT_INPUTS.deposits.accounts.find(
    (account) => account.kind === 'otbasy',
  )!.balance

  it.each([
    ['halyk-immediate', simulateHalykImmediate(DEFAULT_INPUTS)],
    ['halyk-delayed', simulateHalykDelayed(DEFAULT_INPUTS, 11)],
    ['all-cash', simulateAllCash(DEFAULT_INPUTS)],
  ] as const)('%s closes it — 2%% is dead money without the loan', (_id, result) => {
    for (const row of result.rows) {
      expect(row.otbasyBalance).toBe(0)
      expect(row.govBonus).toBe(0)
    }
  })

  it('moves the balance to savings rather than losing it', () => {
    const result = simulateHalykImmediate(DEFAULT_INPUTS)
    const withoutOtbasyAccount = simulateHalykImmediate({
      ...DEFAULT_INPUTS,
      deposits: {
        ...DEFAULT_INPUTS.deposits,
        accounts: DEFAULT_INPUTS.deposits.accounts.filter((account) => account.kind !== 'otbasy'),
      },
    })
    expect(result.rows[0]!.savingsBalance).toBeCloseTo(
      withoutOtbasyAccount.rows[0]!.savingsBalance + otbasySavings,
      2,
    )
  })

  it('leaves the Otbasy variant itself untouched', () => {
    expect(simulateOtbasy(DEFAULT_INPUTS).rows[0]!.otbasyBalance).toBeGreaterThan(0)
  })
})

describe('Otbasy seeding', () => {
  // Without a seed the 50% gate is fed only by what's left after rent, and the
  // wait swallows years of rent — this is the case that makes seeding mandatory.
  it('without a seed the gate takes years and rent piles up', () => {
    const unseeded = simulateOtbasy({
      ...DEFAULT_INPUTS,
      horizonMonths: 120,
      otbasy: { ...DEFAULT_INPUTS.otbasy, seedFromSale: 0 },
    })
    expect(unseeded.purchaseMonth).toBeGreaterThan(30)
    expect(unseeded.totals.rentPaid).toBeGreaterThan(12_000_000)
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
