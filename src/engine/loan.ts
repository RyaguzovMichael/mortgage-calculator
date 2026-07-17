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

export function createLoan(principal: number, annualRate: number, termMonths: number): Loan {
  throw new Error('not implemented')
}

export function isRepaid(loan: Loan): boolean {
  return loan.balance <= 0
}
