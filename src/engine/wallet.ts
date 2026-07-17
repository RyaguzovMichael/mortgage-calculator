import type { Deposit } from './deposit'
import type { OtbasyAccount } from './otbasyAccount'
import type { Inputs } from './types/inputs'
import type { YearMonth } from './types/yearMonth'

// Everything a variant owns in cash, and the month-step bookkeeping all four
// variants share: accrue every account, credit the Otbasy bonus, gate locked
// accounts. Each existing account keeps its own rate for life; new money (sale
// proceeds, monthly contributions) lands in a fresh deposit at
// `newDepositAnnualRate` — the model never silently re-rates an old account.
export interface Wallet {
  readonly savingsBalance: number
  readonly otbasyBalance: number
  readonly otbasyCc: number
  readonly totalInterest: number
  readonly otbasy: OtbasyAccount

  // Interest across every account plus the Otbasy bonus, credited in place.
  accrue(monthIndex: number, yearMonth: YearMonth): number
  addSavings(amount: number): void
  // Only accounts whose unlock month has arrived can be spent.
  unlockedSavings(monthIndex: number): number
  takeSavings(amount: number, monthIndex: number): number
}

export function createWallet(inputs: Inputs): Wallet {
  throw new Error('not implemented')
}
