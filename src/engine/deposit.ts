import { monthlyRate } from './money'

// A term deposit that compounds monthly — the bank quotes 18.4% with monthly
// capitalization, and that is real: `balance` grows every month, not in steps
// every payout. But the money is locked for a `payoutPeriodMonths` term: what
// you can actually get out before the term ends is only `vested` (the amount as
// of the last payout), and touching it at all forfeits every tenge of interest
// accrued this term, not just what the withdrawal covers. Kaspi's 18.4% works
// this way — the number on the statement moves monthly, but early closure still
// costs you the whole term.
//
// `payoutPeriodMonths: 1` degenerates to plain monthly capitalization with
// nothing ever locked or at risk, which is what the rest of the model assumed
// before this product detail was known.
export interface Deposit {
  // True current value: vested principal plus this term's compounding interest
  // so far. This is what net worth and the graph should show — it is real money
  // in the sense that it is what the term is worth today, just not all of it
  // withdrawable yet.
  readonly balance: number
  // What `take` can actually hand back right now, before any of it is asked
  // for. Always ≤ `balance`; the gap is `pendingInterest`. Any code deciding
  // whether there is enough cash on hand for something — a down payment, a
  // loan payoff — must check this, not `balance`: `balance` counts money that
  // is only real if you are willing to forfeit it to get at it.
  readonly withdrawable: number
  // Interest compounded this term but not yet paid out — already included in
  // `balance`; a withdrawal before the payout month forfeits exactly this.
  readonly pendingInterest: number
  readonly totalInterest: number
  readonly monthsUntilPayout: number
  // Returns interest actually paid out this month — zero except on a payout month.
  accrue(): number
  add(amount: number): void
  // Withdrawal never reaches into `pendingInterest`: at most `vested` comes out,
  // and taking anything at all before the payout month burns the rest of it.
  take(amount: number): number
}

export function createDeposit(
  balance: number,
  annualRate: number,
  payoutPeriodMonths = 1,
): Deposit {
  const period = Math.max(1, payoutPeriodMonths)
  let vested = balance
  let pendingInterest = 0
  let totalInterest = 0
  let monthsSincePayout = 0

  return {
    get balance() {
      return vested + pendingInterest
    },
    get withdrawable() {
      return vested
    },
    get pendingInterest() {
      return pendingInterest
    },
    get totalInterest() {
      return totalInterest
    },
    get monthsUntilPayout() {
      return period - monthsSincePayout
    },

    accrue() {
      // Compounds every month — last month's pending interest earns interest
      // too — but `vested` (what a withdrawal can reach) does not move until the
      // term pays out.
      pendingInterest += (vested + pendingInterest) * monthlyRate(annualRate)
      monthsSincePayout++
      if (monthsSincePayout < period) return 0

      const credited = pendingInterest
      vested += credited
      totalInterest += credited
      pendingInterest = 0
      monthsSincePayout = 0
      return credited
    },

    add(amount: number) {
      vested += amount
    },

    take(amount: number) {
      const taken = Math.min(amount, vested)
      vested -= taken
      if (taken > 0) {
        // Withdrawing early burns the whole accrued period and restarts it.
        pendingInterest = 0
        monthsSincePayout = 0
      }
      return taken
    },
  }
}
