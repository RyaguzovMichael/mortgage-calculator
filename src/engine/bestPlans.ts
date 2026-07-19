import { runPlan } from './runPlan'
import { type HousingSituation, type Inputs } from './types/inputs'
import type { BestCategoryId, PurchasePlan, VariantResult } from './types/plan'

export type { BestCategoryId } from './types/plan'

// "Build best plans for me": instead of curating plans by hand, enumerate every
// sensible plan the user's start conditions allow, simulate them all, and keep the
// winner of each category. Pure engine — no Vue, no persistence; the UI drives it
// and paints the progress.

// A 'selling' plan can sell earlier or later, which brings the proceeds (and the
// move to rent) forward or back — its own search dimension. The user gives the
// earliest month they can sell; the sweep starts there and steps every
// SALE_MONTH_STEP months for a few points — a coarse sweep is enough to surface
// "sell as soon as I can" vs "hold a little longer" without exploding the search.
// Ignored by free/renting plans, which have nothing to sell, so those use one value.
const SALE_MONTH_STEP = 2
const SALE_MONTH_SWEEP_COUNT = 4
const DEFAULT_SALE_MONTH = 3

function saleMonthSweep(earliestSaleMonth: number): number[] {
  const start = Math.max(0, Math.trunc(earliestSaleMonth))
  return Array.from({ length: SALE_MONTH_SWEEP_COUNT }, (_, i) => start + i * SALE_MONTH_STEP)
}

// The facts the generator can't guess and asks the user for before a run (the
// GeneratorDialog fills these in). Unlike the old auto-derivation from ownership,
// the situation is a single explicit choice — a run targets one world — so an owner
// who won't sell picks free/renting here. earliestSaleMonth seeds the sale sweep for
// a selling run; maxMonths is the deadline a plan must finish within (see fitsWithin).
export interface GeneratorOptions {
  readonly situation: HousingSituation
  readonly earliestSaleMonth: number
  readonly maxMonths: number
}

// The "also try waiting" set: as well as buying as soon as affordable, try saving
// this many extra months first. Kept small — a coarse sweep is enough to surface a
// save-first strategy without exploding the search.
const TIMING_DELAYS = [6, 12, 24] as const

const BORROWS = ['max', 'min'] as const
const REPAYS = ['monthly', 'lump', 'never'] as const
const TERMS = ['max', 'shortest'] as const

interface Timing {
  readonly buyWhen: PurchasePlan['buyWhen']
  readonly saveMonths: number | null
}

// asap plus a few "wait N months" delays. Otbasy is not timed this way — it buys
// when its own gates open — so it is handled separately in enumeratePlans.
const NON_OTBASY_TIMINGS: readonly Timing[] = [
  { buyWhen: 'asap', saveMonths: null },
  ...TIMING_DELAYS.map((saveMonths) => ({ buyWhen: 'after-months' as const, saveMonths })),
]

// Every plan the search will try, given these conditions. The situation is the
// user's single choice from the dialog (no longer derived from ownership), and each
// loan kind drops the dimensions that do not apply to it.
export function enumeratePlans(inputs: Inputs, options: GeneratorOptions): PurchasePlan[] {
  const deposits = inputs.deposits.products.map((product) => product.id)
  if (deposits.length === 0) return []
  // Where the deposit choice does not move the needle (repay: monthly prepays the
  // loan, so little ever sits in a deposit; Otbasy saves to its own account), fix it
  // to one product rather than multiply the search by the whole catalogue.
  const defaultDeposit = deposits[0]!
  const loanIds = inputs.loans.products.map((product) => product.id)

  // Only a selling run sweeps the sale month; free/renting have nothing to sell, so
  // one fixed (ignored) value keeps the loop below uniform.
  const saleMonths =
    options.situation === 'selling'
      ? saleMonthSweep(options.earliestSaleMonth)
      : [DEFAULT_SALE_MONTH]

  const plans: PurchasePlan[] = []
  const add = (fields: Omit<PurchasePlan, 'id' | 'name'>): void => {
    const id = `gen-${plans.length}`
    plans.push({ id, name: id, ...fields })
  }

  for (const saleMonthOffset of saleMonths) {
    const base = { situation: options.situation, saleMonthOffset } as const

    // Cash: no loan to size, repay, or term — but the deposit it saves into
    // matters, since that is where the whole price accrues before the purchase.
    for (const timing of NON_OTBASY_TIMINGS) {
      for (const deposit of deposits) {
        add({
          ...base,
          loan: 'none',
          buyWhen: timing.buyWhen,
          saveMonths: timing.saveMonths,
          borrow: 'max',
          repay: 'monthly',
          term: 'max',
          savingsProductId: deposit,
        })
      }
    }

    // Otbasy: its trigger is its own gates, its term is its own contract, and it
    // saves to its own account — only borrow and repay vary.
    for (const borrow of BORROWS) {
      for (const repay of REPAYS) {
        add({
          ...base,
          loan: 'otbasy',
          buyWhen: 'otbasy-gates',
          saveMonths: null,
          borrow,
          repay,
          term: 'max',
          savingsProductId: defaultDeposit,
        })
      }
    }

    // Every ordinary credit, across timing × borrow × repay × term, and — only
    // where it matters — every deposit.
    for (const loan of loanIds) {
      for (const timing of NON_OTBASY_TIMINGS) {
        for (const borrow of BORROWS) {
          for (const repay of REPAYS) {
            for (const term of TERMS) {
              const depositsToTry = repay === 'monthly' ? [defaultDeposit] : deposits
              for (const deposit of depositsToTry) {
                add({
                  ...base,
                  loan,
                  buyWhen: timing.buyWhen,
                  saveMonths: timing.saveMonths,
                  borrow,
                  repay,
                  term,
                  savingsProductId: deposit,
                })
              }
            }
          }
        }
      }
    }
  }
  return plans
}

// What a single candidate produced, reduced to the few numbers the categories rank
// on. The full month-by-month result is discarded once these are read, so a search
// over thousands of candidates does not hold thousands of row arrays in memory.
export interface PlanMetrics {
  readonly bought: boolean
  readonly purchaseMonth: number | null
  readonly purchasePrice: number | null
  readonly debtFreeMonth: number | null
  readonly monthsRenting: number
  // Net worth on the last horizon month — the same month for every candidate, so
  // ranking on it is a fair "who ends up richest".
  readonly netWorthAtHorizon: number
  // Whether this is a mortgage that opened, actually carried debt for a while, and
  // cleared within the horizon (the eligibility for the shortest-loan category,
  // which ranks on debtFreeMonth).
  readonly hasLoan: boolean
}

function metricsOf(result: VariantResult, plan: PurchasePlan): PlanMetrics {
  const last = result.rows[result.rows.length - 1]
  const monthsRenting = result.rows.reduce((n, row) => (row.rentPaid > 0 ? n + 1 : n), 0)
  const bought = result.purchaseMonth !== null
  // A mortgage that actually opened and cleared within the horizon, and outlived
  // its own purchase month. A 'lump' repay can borrow and pay the whole thing off
  // the same month it buys — that clears debtFreeMonth but never really carried a
  // loan, so it should not be able to win "shortest loan" purely by having paid
  // interest for zero months while some other candidate's deposit choice happened
  // to earn more.
  const hasLoan =
    plan.loan !== 'none' &&
    bought &&
    result.debtFreeMonth !== null &&
    result.debtFreeMonth > result.purchaseMonth!
  return {
    bought,
    purchaseMonth: result.purchaseMonth,
    purchasePrice: result.purchasePrice,
    debtFreeMonth: result.debtFreeMonth,
    monthsRenting,
    netWorthAtHorizon: last ? last.netWorth : 0,
    hasLoan,
  }
}

// Convenience for callers outside the search (the board's generated-plan rows) that
// have a plan and want its headline numbers under the current conditions.
export function evaluatePlan(inputs: Inputs, plan: PurchasePlan): PlanMetrics {
  return metricsOf(runPlan(inputs, plan), plan)
}

// Whether a plan finishes inside the user's deadline: it must own the flat with no
// debt left by maxMonths. debtFreeMonth is that fully-settled month — the purchase
// month for cash, the pay-off month for a mortgage — and is null when the plan never
// gets there (it never buys, or takes a loan it never clears within the horizon), so
// such a plan never fits. This is why a whole run can come back with no winners, and
// the UI then tells the user to raise the limit.
function fitsWithin(metrics: PlanMetrics, maxMonths: number): boolean {
  return metrics.debtFreeMonth !== null && metrics.debtFreeMonth <= maxMonths
}

// A 'lump' repay can borrow and pay the whole loan off the same month it buys —
// debtFreeMonth === purchaseMonth. That plan paid interest for a loan it never
// actually carried, so it is not a real mortgage strategy worth surfacing under
// any category (not just "shortest loan") — set it aside entirely, the same as a
// plan that misses the deadline. Cash plans have no loan to be degenerate about.
function hasDegenerateLoan(plan: PurchasePlan, metrics: PlanMetrics): boolean {
  return (
    plan.loan !== 'none' &&
    metrics.purchaseMonth !== null &&
    metrics.debtFreeMonth !== null &&
    metrics.debtFreeMonth <= metrics.purchaseMonth
  )
}

interface Category {
  readonly id: BestCategoryId
  // Whether a candidate can win this category at all.
  eligible(metrics: PlanMetrics): boolean
  // Whether `a` beats the current best `b`. Ties keep the incumbent (first found).
  better(a: PlanMetrics, b: PlanMetrics): boolean
}

// A plan's timing (buyWhen/borrow/repay/term/...) is swept independently of its
// deposit product, so several candidates can tie exactly on purchaseMonth or
// monthsRenting while differing only in which deposit the free cash sits in. Without
// this, the tie is broken by enumeration order — an arbitrary deposit — which can
// diverge from what 'best-assets' picks for the very same timing, so the board ends
// up showing two near-identical cards for one strategy (see planFingerprint in
// useInputs.ts, which would otherwise have collapsed them). Preferring the higher net
// worth on a tie makes the timing categories agree with 'best-assets' whenever the
// timing is the same, so they collapse into one card instead.
function betterOnTie(a: PlanMetrics, b: PlanMetrics): boolean {
  return a.netWorthAtHorizon > b.netWorthAtHorizon
}

// The categories the user asked for, as data so a sixth is a one-liner. Every one
// requires that the plan actually buys the apartment — a plan that never buys is
// not a way of buying it. "shortest-loan" is deliberately mortgage-only: it ranks on
// the debt-free month — the shortest time from the start of the calculation to the
// moment the loan is gone — over plans that took (and cleared) a mortgage, so cash
// and a loan that never clears do not compete.
const CATEGORIES: readonly Category[] = [
  {
    id: 'earliest-move-in',
    eligible: (m) => m.bought,
    better: (a, b) =>
      a.purchaseMonth! < b.purchaseMonth! ||
      (a.purchaseMonth === b.purchaseMonth && betterOnTie(a, b)),
  },
  {
    id: 'shortest-rent',
    eligible: (m) => m.bought,
    better: (a, b) =>
      a.monthsRenting < b.monthsRenting ||
      (a.monthsRenting === b.monthsRenting && betterOnTie(a, b)),
  },
  {
    id: 'best-assets',
    eligible: (m) => m.bought,
    better: (a, b) => a.netWorthAtHorizon > b.netWorthAtHorizon,
  },
  {
    id: 'shortest-loan',
    eligible: (m) => m.hasLoan,
    better: (a, b) =>
      a.debtFreeMonth! < b.debtFreeMonth! ||
      (a.debtFreeMonth === b.debtFreeMonth && betterOnTie(a, b)),
  },
]

export interface CategoryWinner {
  readonly category: BestCategoryId
  // The winning plan, carrying its synthetic gen-id; the caller renames it and gives
  // it a stable board id.
  readonly plan: PurchasePlan
  readonly metrics: PlanMetrics
}

export interface BestPlansResult {
  readonly winners: readonly CategoryWinner[]
  // How many candidates were evaluated — the denominator the progress bar counted to.
  readonly total: number
}

interface Candidate {
  readonly plan: PurchasePlan
  readonly metrics: PlanMetrics
}

function consider(
  categories: readonly Category[],
  best: Map<BestCategoryId, Candidate>,
  candidate: Candidate,
): void {
  for (const category of categories) {
    if (!category.eligible(candidate.metrics)) continue
    const current = best.get(category.id)
    if (!current || category.better(candidate.metrics, current.metrics)) {
      best.set(category.id, candidate)
    }
  }
}

// 'shortest-rent' is meaningless for a 'free' run: nobody in the search ever pays
// rent (planMatchesStart/rentDueAt never charge it for 'free'), so every candidate
// would tie at zero months and the "winner" would just be whichever was enumerated
// first. Drop it from the sweep rather than crown an arbitrary tie.
function activeCategories(options: GeneratorOptions): readonly Category[] {
  return options.situation === 'free'
    ? CATEGORIES.filter((category) => category.id !== 'shortest-rent')
    : CATEGORIES
}

// Runs every enumerated plan through the engine in batches, yielding to the event
// loop between them so the caller's progress bar can paint, and returns the winner
// of each category. onProgress is called after each batch (and once at the start)
// with the running count.
export async function buildBestPlans(
  inputs: Inputs,
  options: GeneratorOptions,
  onProgress?: (done: number, total: number) => void,
  batchSize = 200,
): Promise<BestPlansResult> {
  const plans = enumeratePlans(inputs, options)
  const total = plans.length
  const categories = activeCategories(options)
  const best = new Map<BestCategoryId, Candidate>()

  onProgress?.(0, total)
  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total)
    for (let i = start; i < end; i += 1) {
      const plan = plans[i]!
      const metrics = metricsOf(runPlan(inputs, plan), plan)
      // The deadline is a hard filter: a plan that isn't fully settled by maxMonths is
      // not a candidate for any category. A degenerate same-month loan is filtered the
      // same way — not a real strategy, so it cannot win anything either. Every plan is
      // still run (so progress counts the whole search), only these are set aside.
      if (fitsWithin(metrics, options.maxMonths) && !hasDegenerateLoan(plan, metrics)) {
        consider(categories, best, { plan, metrics })
      }
    }
    onProgress?.(end, total)
    if (end < total) await yieldToEventLoop()
  }

  // A mortgage beating cash on speed-to-debt-free is not interesting if cash still
  // wins on net worth — the richest outcome does not carry a loan at all, so ranking
  // mortgages against each other has nothing to add. Drop the category rather than
  // crown a "fastest loan" nobody should prefer to paying cash.
  const bestAssets = best.get('best-assets')
  if (bestAssets && bestAssets.plan.loan === 'none') best.delete('shortest-loan')

  const winners = categories.flatMap((category) => {
    const candidate = best.get(category.id)
    return candidate
      ? [{ category: category.id, plan: candidate.plan, metrics: candidate.metrics }]
      : []
  })
  return { winners, total }
}

// A macrotask, not a microtask: only a macrotask lets the browser paint between
// batches, which is the whole point of yielding here.
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
