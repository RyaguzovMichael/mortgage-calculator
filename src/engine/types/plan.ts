import type { HousingSituation } from './inputs'
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
  // apartment.price − the sale proceeds, which the global existing-apartment start
  // condition supplies and the plan's own situation gates (a 'selling' plan sells,
  // the others do not), so the target loan is not one number shared by every plan.
  readonly targetLoan: number
}

// Once a user can build their own plans, an id is just its slug — the four
// built-ins keep their historical ids, but the type can no longer be a closed
// union. Kept as a named alias so the intent (this string is a plan id) stays
// legible at the call sites.
export type VariantId = string

// A way of buying the apartment, expressed as a handful of decisions: which loan,
// when to buy, how much to borrow, how to repay, where you live meanwhile, and
// which deposit you store money in. The built-in variants are just some of these;
// a user builds their own from the same choices. runPlan turns one into a
// VariantResult.
export interface PurchasePlan {
  readonly id: string
  readonly name: string
  // Which loan, if any — a LoanProduct id, or one of two sentinels: 'otbasy' (the
  // one fixed state programme, not a catalogue entry) or 'none' (cash). Once a
  // user can add their own credits this can no longer be a closed union, the same
  // reasoning VariantId went through above. Everything else the variant used to
  // decide for itself — whether to use the Otbasy account, where rent-era surplus
  // goes — follows from this, so it is not asked twice.
  readonly loan: string
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
  //   never   — pay only the scheduled amount, save the rest, never close early;
  //             the loan runs its full term while the cash keeps compounding.
  //             Best when the loan rate stays below the deposit rate (Otbasy).
  readonly repay: 'monthly' | 'lump' | 'never'
  //   max      — the longest term the contract allows: the lowest monthly payment,
  //              the loan runs its full length.
  //   shortest — the least term whose annuity the borrower can still support (up to
  //              the 50%-of-salary lending ceiling): a higher monthly payment, the
  //              loan finishes soonest. Solved at purchase from the principal and
  //              that month's salary. Ignored for cash ('none') and for Otbasy,
  //              which keeps its own contract term.
  readonly term: 'max' | 'shortest'
  // Where you live until you buy — and, through 'selling', whether this plan
  // requires the existing-apartment start condition. How much the flat fetches is a
  // global start condition (Inputs.existingApartment.price); the situation and the
  // sale month below are the plan's own.
  readonly situation: HousingSituation
  // The month the existing flat sells, for a 'selling' plan — a plan decision, so
  // two plans can sell the same flat at different times. Ignored by free/renting,
  // which have nothing to sell.
  readonly saleMonthOffset: number
  // Which deposit this plan stores money in, by id into Inputs.deposits.products.
  // A plan decision: two plans can compare different deposits. The Otbasy variant
  // routes savings to its own account instead, so this is unused there.
  readonly savingsProductId: string
}

// The categories the "build best plans" generator ranks on. Lives here (not in
// bestPlans.ts) so GeneratedPlan and the persisted Inputs shape can reference it
// without importing the generator, which reaches back across the engine.
export type BestCategoryId =
  | 'earliest-move-in'
  | 'shortest-rent'
  | 'best-assets'
  | 'lowest-price'
  | 'shortest-loan'

// A plan the generator produced, carrying the categories it won so the board can
// group it under them. It is a PurchasePlan in every other respect — the engine
// runs it exactly like a hand-built one. Unlike a custom plan it cannot be edited or
// deleted, only disabled, copied to a custom plan, or replaced by a fresh run.
export interface GeneratedPlan extends PurchasePlan {
  readonly categories: readonly BestCategoryId[]
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
