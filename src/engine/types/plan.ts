import type { HousingInputs } from './inputs'
import type { YearMonth } from './yearMonth'

// What a single variant produced: the month-by-month story plus its rolled-up
// numbers. `rows` is the audit trail — every figure in `totals` is derivable
// from it.
export interface VariantResult {
  readonly id: VariantId
  // The plan's display name, carried through so the board can label a variant
  // without a lookup table keyed on id — custom plans have no such table.
  readonly name: string
  readonly rows: readonly MonthRow[]
  readonly purchaseMonth: number | null
  readonly debtFreeMonth: number | null
  // What the apartment cost on the month this variant actually bought it. Equal
  // to the list price for everyone at 0% growth; above it, this is the price of
  // waiting, and it is the whole reason growth cannot be ignored.
  readonly purchasePrice: number | null
  readonly totals: VariantTotals
  // apartment.price − this plan's own proceeds — housing is now a plan decision,
  // so the target loan is no longer one number shared by every variant.
  readonly targetLoan: number
}

// Once a user can build their own plans, an id is just its slug — the four
// built-ins keep their historical ids, but the type can no longer be a closed
// union. Kept as a named alias so the intent (this string is a plan id) stays
// legible at the call sites.
export type VariantId = string

// A way of buying the apartment, expressed as four decisions. The four built-in
// variants are just four of these; a user builds their own from the same choices.
// runPlan turns one into a VariantResult.
export interface PurchasePlan {
  readonly id: string
  readonly name: string
  // Which loan, if any. Everything else the variant used to decide for itself —
  // whether to use the Otbasy account, where rent-era surplus goes — follows from
  // this, so it is not asked twice.
  readonly loan: 'halyk' | 'otbasy' | 'none'
  //   asap         — the first month a purchase is allowed
  //   after-months — wait a fixed number of months first
  //   otbasy-gates — wait for the 50%-balance and CC gates
  readonly buyWhen: 'asap' | 'after-months' | 'otbasy-gates'
  // Months to save before buying, for after-months. null chains to the Otbasy
  // variant's purchase month (set by simulateAll), so the two compare on one window.
  readonly saveMonths: number | null
  //   max — borrow the most the contract allows (least down payment)
  //   min — put every tenge down, borrow the remainder
  readonly borrow: 'max' | 'min'
  //   monthly — pour the free cash into the loan every month (early repayment)
  //   lump    — pay only the scheduled amount, save the rest, close in one hit
  readonly repay: 'monthly' | 'lump'
  // Where you live until you buy, and what (if anything) you sell to get there.
  // A plan decision, not a global setting: two plans can differ on whether to
  // sell the old flat, and when.
  readonly housing: HousingInputs
}

// pre-sale: living in the flat you will sell. free-housing: living rent-free
// with no flat to sell. Both precede ownership; renting is the paying-rent case.
export type Phase = 'pre-sale' | 'free-housing' | 'renting' | 'owned-with-loan' | 'owned'

export interface MonthRow {
  readonly index: number
  readonly yearMonth: YearMonth
  readonly phase: Phase
  // The market price that month whether or not this variant owns the flat yet.
  readonly apartmentPrice: number
  // The month's income, after indexation. Same for every variant — it is what
  // each of them had to work with.
  readonly freeCash: number
  readonly rentPaid: number
  readonly loanPayment: number
  readonly loanInterest: number
  readonly loanPrincipal: number
  readonly loanBalance: number
  readonly savingsBalance: number
  readonly otbasyBalance: number
  readonly otbasyCc: number
  // Interest actually credited this month. Zero on a deposit's non-payout
  // months, because interest still pending is forfeitable and not yours yet.
  readonly depositInterestEarned: number
  readonly govBonus: number
  readonly netWorth: number
}

export interface VariantTotals {
  readonly rentPaid: number
  readonly loanInterestPaid: number
  readonly depositInterestEarned: number
  readonly govBonusReceived: number
  // Net worth on the last month of the comparison window, not of the horizon:
  // simulateAll cuts every variant back to the month the slowest one clears its
  // debt, because past that point there is nothing left to compare.
  readonly netWorthAtEnd: number
}
