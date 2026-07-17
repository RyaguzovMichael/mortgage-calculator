import { describe, it, expect } from 'vitest'
import { createLoan } from '@/engine/loan'
import { createDeposit } from '@/engine/deposit'
import { createOtbasyAccount } from '@/engine/otbasyAccount'
import type { OtbasyInputs } from '@/engine/types/inputs'
import { addMonths } from '@/engine/types/yearMonth'

// Pins the ported arithmetic against the Python prototype's last run
// (35,000,000 of sale proceeds → a 10,000,000 target loan).
//
// These are component-level, not whole-variant: the variant results deliberately
// do NOT reproduce the prototype, because the prototype was structurally wrong
// in two ways this model fixes — it never accrued interest on the money waiting
// to become a down payment, and it never checked the down payment was
// affordable. What is reproduced here is the maths that carried over verbatim.

const OTBASY: OtbasyInputs = {
  loanAnnualRate: 0.085,
  depositAnnualRate: 0.02,
  minBalanceFraction: 0.5,
  ccTarget: 5,
  govBonusRate: 0.2,
  govBonusCap: 865_000,
  govBonusMonth: 2,
  seedFromSale: 0,
}

describe('Halyk amortization (prototype: 20 months, 1,738,894.27 interest)', () => {
  it('clears an 8M loan at 24% on 500k/month', () => {
    const loan = createLoan(8_000_000, 0.24, 240)
    let months = 0
    while (loan.balance > 0 && months < 480) {
      loan.pay(500_000)
      months++
    }
    expect(months).toBe(20)
    expect(loan.totalInterest).toBeCloseTo(1_738_894.27, 2)
  })
})

describe('Otbasy accumulation (prototype: 11 months, balance 6,380,717.66, CC 5.92)', () => {
  it('reaches both gates from 648,509.26 on 500k/month', () => {
    const account = createOtbasyAccount(648_509.26, 0.02, OTBASY, 10_000_000)
    const start = { year: 2026, month: 8 }
    let months = 0
    while (months < 600) {
      const yearMonth = addMonths(start, months)
      months++
      account.accrue()
      account.add(500_000)
      account.applyGovBonus(yearMonth)
      if (account.balance >= 5_000_000 && account.cc >= 5) break
    }
    expect(months).toBe(11)
    expect(account.balance).toBeCloseTo(6_380_717.66, 2)
    expect(account.totalInterest).toBeCloseTo(59_208.4, 2)
    expect(account.cc).toBeCloseTo(5.92, 2)
  })
})

describe('Kaspi accumulation (prototype: 11 months → 7,571,376.39)', () => {
  it('grows 1,378,522.88 at 18.4% on 500k/month', () => {
    const deposit = createDeposit(1_378_522.88, 0.184)
    for (let month = 0; month < 11; month++) {
      deposit.accrue()
      deposit.add(500_000)
    }
    expect(deposit.balance).toBeCloseTo(7_571_376.39, 2)
    expect(deposit.totalInterest).toBeCloseTo(692_853.51, 2)
  })
})

describe('Halyk delayed loan (prototype: 6 months, 152,340.55 interest)', () => {
  it('clears 2,428,623.61 at 24% on 500k/month', () => {
    const loan = createLoan(2_428_623.61, 0.24, 240)
    let months = 0
    while (loan.balance > 0 && months < 480) {
      loan.pay(500_000)
      months++
    }
    expect(months).toBe(6)
    expect(loan.totalInterest).toBeCloseTo(152_340.55, 2)
  })
})

describe('Otbasy loan + lump-sum payoff (prototype: 8 months, 203,931.45 interest)', () => {
  it('pays the annuity only and closes from savings at 18.4%', () => {
    const loan = createLoan(3_619_282.34, 0.085, 240)
    const savings = createDeposit(0, 0.184)
    let months = 0
    while (loan.balance > 0 && months < 480) {
      months++
      loan.pay(loan.scheduledPayment)
      savings.accrue()
      savings.add(500_000 - loan.scheduledPayment)
      if (savings.balance >= loan.balance) {
        // prepay, not pay: this month's interest was already charged above.
        savings.take(loan.balance)
        loan.prepay(loan.balance)
        break
      }
    }
    expect(months).toBe(8)
    expect(loan.totalInterest).toBeCloseTo(203_931.45, 2)
    expect(savings.totalInterest).toBeCloseTo(207_471.03, 2)
  })
})
