import type { YearMonth } from './yearMonth'

// What a single variant produced: the month-by-month story plus its rolled-up
// numbers. `rows` is the audit trail — every figure in `totals` is derivable
// from it.
export interface VariantResult {
  readonly id: VariantId
  readonly rows: readonly MonthRow[]
  readonly purchaseMonth: number | null
  readonly debtFreeMonth: number | null
  readonly totals: VariantTotals
}

export type VariantId = 'halyk-immediate' | 'halyk-delayed' | 'otbasy' | 'all-cash'

export type Phase = 'pre-sale' | 'renting' | 'owned-with-loan' | 'owned'

export interface MonthRow {
  readonly index: number
  readonly yearMonth: YearMonth
  readonly phase: Phase
  readonly rentPaid: number
  readonly loanPayment: number
  readonly loanInterest: number
  readonly loanPrincipal: number
  readonly loanBalance: number
  readonly savingsBalance: number
  readonly otbasyBalance: number
  readonly otbasyCc: number
  readonly depositInterestEarned: number
  readonly netWorth: number
}

export interface VariantTotals {
  readonly rentPaid: number
  readonly loanInterestPaid: number
  readonly depositInterestEarned: number
  // rent + loan interest − deposit income. Comparable across variants because
  // each one ends holding the same apartment with no debt, so the price cancels.
  readonly totalLoss: number
  readonly netWorthAtHorizon: number
}
