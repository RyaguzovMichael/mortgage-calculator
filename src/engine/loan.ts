import { annuityPayment, monthlyRate } from './money'

export interface Loan {
  readonly balance: number
  readonly totalInterest: number
  readonly scheduledPayment: number
  // One month: accrues interest, then applies `amount`. Anything above the
  // accrued interest goes to principal, so paying more than `scheduledPayment`
  // is an early repayment. Never takes more than what closes the loan.
  pay(amount: number): LoanPayment
  // Straight at the principal, accruing nothing — for a lump-sum payoff later in
  // a month whose interest `pay` has already charged. Calling `pay` twice in one
  // month would double-charge interest instead.
  prepay(amount: number): number
}

export interface LoanPayment {
  readonly paid: number
  readonly interest: number
  readonly principal: number
}

const NOTHING: LoanPayment = { paid: 0, interest: 0, principal: 0 }

export function createLoan(principal: number, annualRate: number, termMonths: number): Loan {
  let balance = principal
  let totalInterest = 0
  const scheduledPayment = annuityPayment(principal, annualRate, termMonths)

  return {
    get balance() {
      return balance
    },
    get totalInterest() {
      return totalInterest
    },
    get scheduledPayment() {
      return scheduledPayment
    },

    pay(amount: number) {
      if (balance <= 0) return NOTHING
      const interest = balance * monthlyRate(annualRate)
      const paid = Math.min(amount, balance + interest)
      const principalPaid = paid - interest
      balance = settle(balance - principalPaid)
      // Only interest the payment actually covered. A payment below the accrued
      // interest pays down no principal and capitalizes the shortfall into the
      // balance; counting that shortfall here as interest paid would double-count
      // it when the enlarged balance is later paid off.
      totalInterest += Math.min(interest, paid)
      return { paid, interest, principal: principalPaid }
    },

    prepay(amount: number) {
      const repaid = Math.min(amount, balance)
      balance = settle(balance - repaid)
      return repaid
    },
  }
}

// Floating-point residue would otherwise keep a loan alive for another month.
function settle(balance: number): number {
  return balance < 0.01 ? 0 : balance
}
