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
      expect(result.rows.at(-1)?.loanBalance).toBe(0)
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
      expect(result.totals.rentPaid).toBeCloseTo(rentPaid, 4)
      expect(result.totals.loanInterestPaid).toBeCloseTo(interestPaid, 4)
      expect(result.totals.depositInterestEarned).toBeCloseTo(earned, 4)
      expect(result.totals.totalLoss).toBeCloseTo(rentPaid + interestPaid - earned, 4)
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
      deposits: {
        newDepositAnnualRate: 0,
        accounts: DEFAULT_INPUTS.deposits.accounts.map((account) => ({ ...account, annualRate: 0 })),
      },
    }
    const immediate = simulateHalykImmediate(inputs).totals.totalLoss
    expect(immediate).toBeLessThan(simulateAllCash(inputs).totals.totalLoss)
    expect(immediate).toBeLessThan(simulateOtbasy(inputs).totals.totalLoss)
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
