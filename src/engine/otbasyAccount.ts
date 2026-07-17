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

// The Otbasy deposit pays out monthly, so there is no period to forfeit and no
// reason to make it a parameter.
const PAYOUT_PERIOD_MONTHS = 1

// `balance` and `accruedInterest` are the starting state and stay parameters,
// because each variant opens this account differently — Otbasy pours every tenge
// in, the others never open one at all. The rate is not a parameter: it comes off
// `inputs`, which used to carry it too, so the caller could pass one rate while
// the account read another.
export function createOtbasyAccount(
  balance: number,
  accruedInterest: number,
  inputs: OtbasyInputs,
  targetLoan: number,
): OtbasyAccount {
  const deposit = createDeposit(balance, inputs.depositAnnualRate, PAYOUT_PERIOD_MONTHS)
  let contributionsThisYear = 0

  return {
    get balance() {
      return deposit.balance
    },
    get pendingInterest() {
      return deposit.pendingInterest
    },
    // Includes what the bank credited before month 0: the account did not start
    // life when the model did.
    get totalInterest() {
      return accruedInterest + deposit.totalInterest
    },
    get annualRate() {
      return deposit.annualRate
    },
    get monthsUntilPayout() {
      return deposit.monthsUntilPayout
    },
    get cc() {
      return calculateCc(accruedInterest + deposit.totalInterest, targetLoan)
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
