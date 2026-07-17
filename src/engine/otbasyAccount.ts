import type { Deposit } from './deposit'
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
): OtbasyAccount {
  throw new Error('not implemented')
}

export function calculateCc(accumulatedInterest: number, targetLoan: number): number {
  throw new Error('not implemented')
}
