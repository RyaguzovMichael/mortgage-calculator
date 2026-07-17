import { createDeposit, type Deposit } from './deposit'
import type { OtbasyInputs } from './types/inputs'
import type { YearMonth } from './types/yearMonth'

export interface OtbasyAccount extends Deposit {
  // Grows only from the bank's own interest — the government bonus is excluded
  // by MODEL.md, which is what makes CC lag far behind the balance.
  readonly cc: number
  readonly contributionsThisYear: number
  // No-op outside the bonus month; returns the bonus credited.
  applyGovBonus(yearMonth: YearMonth): number
}

export function createOtbasyAccount(
  balance: number,
  annualRate: number,
  inputs: OtbasyInputs,
  targetLoan: number,
  payoutPeriodMonths = 1,
): OtbasyAccount {
  const deposit = createDeposit(balance, annualRate, payoutPeriodMonths)
  let contributionsThisYear = 0

  return {
    get balance() {
      return deposit.balance
    },
    get pendingInterest() {
      return deposit.pendingInterest
    },
    get totalInterest() {
      return deposit.totalInterest
    },
    get annualRate() {
      return deposit.annualRate
    },
    get monthsUntilPayout() {
      return deposit.monthsUntilPayout
    },
    get cc() {
      return calculateCc(deposit.totalInterest, targetLoan)
    },
    get contributionsThisYear() {
      return contributionsThisYear
    },

    accrue() {
      return deposit.accrue()
    },

    add(amount: number) {
      deposit.add(amount)
      contributionsThisYear += amount
    },

    take(amount: number) {
      return deposit.take(amount)
    },

    applyGovBonus(yearMonth: YearMonth) {
      if (yearMonth.month !== inputs.govBonusMonth) return 0
      const bonus = Math.min(contributionsThisYear, inputs.govBonusCap) * inputs.govBonusRate
      // Straight onto the deposit, not through `add`: the bonus is not a
      // contribution, so it must not earn itself another bonus next year.
      deposit.add(bonus)
      contributionsThisYear = 0
      return bonus
    },
  }
}

export function calculateCc(accumulatedInterest: number, targetLoan: number): number {
  if (targetLoan <= 0) return 0
  return (accumulatedInterest / targetLoan) * 1000
}
