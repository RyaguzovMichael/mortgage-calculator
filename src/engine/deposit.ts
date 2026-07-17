import { monthlyRate } from './money'

// A term deposit that pays interest every `payoutPeriodMonths` and forfeits
// everything accrued since the last payout if you withdraw early — Kaspi's 18.4%
// works this way. `pendingInterest` is therefore money you do not have yet: it is
// excluded from `balance`, and any `take` burns it.
//
// `payoutPeriodMonths: 1` degenerates to plain monthly capitalization, which is
// what the rest of the model assumed before this product detail was known.
export interface Deposit {
  readonly balance: number
  readonly pendingInterest: number
  readonly totalInterest: number
  readonly annualRate: number
  readonly monthsUntilPayout: number
  // Returns interest actually credited this month — zero except on a payout month.
  accrue(): number
  add(amount: number): void
  take(amount: number): number
}

export function createDeposit(
  balance: number,
  annualRate: number,
  payoutPeriodMonths = 1,
): Deposit {
  const period = Math.max(1, payoutPeriodMonths)
  let currentBalance = balance
  let pendingInterest = 0
  let totalInterest = 0
  let monthsSincePayout = 0

  return {
    get balance() {
      return currentBalance
    },
    get pendingInterest() {
      return pendingInterest
    },
    get totalInterest() {
      return totalInterest
    },
    get annualRate() {
      return annualRate
    },
    get monthsUntilPayout() {
      return period - monthsSincePayout
    },

    accrue() {
      // Interest within a period is simple, not compounding: the bank only adds
      // it to the principal when it pays out.
      pendingInterest += currentBalance * monthlyRate(annualRate)
      monthsSincePayout++
      if (monthsSincePayout < period) return 0

      const credited = pendingInterest
      currentBalance += credited
      totalInterest += credited
      pendingInterest = 0
      monthsSincePayout = 0
      return credited
    },

    add(amount: number) {
      currentBalance += amount
    },

    take(amount: number) {
      const taken = Math.min(amount, currentBalance)
      currentBalance -= taken
      if (taken > 0) {
        // Withdrawing early burns the whole accrued period and restarts it.
        pendingInterest = 0
        monthsSincePayout = 0
      }
      return taken
    },
  }
}
