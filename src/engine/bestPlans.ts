import { runPlan } from './runPlan'
import { type HousingSituation, type Inputs } from './types/inputs'
import type { BestCategoryId, PurchasePlan, VariantResult } from './types/plan'

export type { BestCategoryId } from './types/plan'

// "Build best plans for me": instead of curating plans by hand, enumerate every
// sensible plan the user's start conditions allow, simulate them all, and keep the
// winner of each category. Pure engine — no Vue, no persistence; the UI drives it
// and paints the progress.

// When a 'selling' plan sells its flat — its own search dimension, since selling
// earlier brings the proceeds (and the move to rent) forward. Ignored by
// free/renting plans, which have nothing to sell, so those use a single value.
const SALE_MONTH_OFFSETS = [0, 3, 6, 12] as const
const DEFAULT_SALE_MONTH = 3

function saleMonthsFor(situation: HousingSituation): readonly number[] {
  return situation === 'selling' ? SALE_MONTH_OFFSETS : [DEFAULT_SALE_MONTH]
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

// Every plan the search will try, given these conditions. The situation is pinned
// to the start condition (a 'selling' plan needs an owned flat; 'free'/'renting'
// need none), and each loan kind drops the dimensions that do not apply to it.
export function enumeratePlans(inputs: Inputs): PurchasePlan[] {
  const situations: HousingSituation[] = inputs.existingApartment.owned
    ? ['selling']
    : ['free', 'renting']
  const deposits = inputs.deposits.products.map((product) => product.id)
  if (deposits.length === 0) return []
  // Where the deposit choice does not move the needle (repay: monthly prepays the
  // loan, so little ever sits in a deposit; Otbasy saves to its own account), fix it
  // to one product rather than multiply the search by the whole catalogue.
  const defaultDeposit = deposits[0]!
  const loanIds = inputs.loans.products.map((product) => product.id)

  const plans: PurchasePlan[] = []
  const add = (fields: Omit<PurchasePlan, 'id' | 'name'>): void => {
    const id = `gen-${plans.length}`
    plans.push({ id, name: id, ...fields })
  }

  for (const situation of situations) {
    for (const saleMonthOffset of saleMonthsFor(situation)) {
      const base = { situation, saleMonthOffset } as const

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
  // Whether this is a mortgage that opened and cleared within the horizon (the
  // eligibility for the shortest-loan category, which ranks on debtFreeMonth).
  readonly hasLoan: boolean
}

function metricsOf(result: VariantResult, plan: PurchasePlan): PlanMetrics {
  const last = result.rows[result.rows.length - 1]
  const monthsRenting = result.rows.reduce((n, row) => (row.rentPaid > 0 ? n + 1 : n), 0)
  const bought = result.purchaseMonth !== null
  // A mortgage that actually opened and cleared within the horizon. Cash and a loan
  // that never clears are not "with a mortgage that ends".
  const hasLoan = plan.loan !== 'none' && bought && result.debtFreeMonth !== null
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

interface Category {
  readonly id: BestCategoryId
  // Whether a candidate can win this category at all.
  eligible(metrics: PlanMetrics): boolean
  // Whether `a` beats the current best `b`. Ties keep the incumbent (first found).
  better(a: PlanMetrics, b: PlanMetrics): boolean
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
    better: (a, b) => a.purchaseMonth! < b.purchaseMonth!,
  },
  {
    id: 'shortest-rent',
    eligible: (m) => m.bought,
    better: (a, b) => a.monthsRenting < b.monthsRenting,
  },
  {
    id: 'best-assets',
    eligible: (m) => m.bought,
    better: (a, b) => a.netWorthAtHorizon > b.netWorthAtHorizon,
  },
  {
    id: 'lowest-price',
    eligible: (m) => m.bought,
    better: (a, b) => a.purchasePrice! < b.purchasePrice!,
  },
  {
    id: 'shortest-loan',
    eligible: (m) => m.hasLoan,
    better: (a, b) => a.debtFreeMonth! < b.debtFreeMonth!,
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

function consider(best: Map<BestCategoryId, Candidate>, candidate: Candidate): void {
  for (const category of CATEGORIES) {
    if (!category.eligible(candidate.metrics)) continue
    const current = best.get(category.id)
    if (!current || category.better(candidate.metrics, current.metrics)) {
      best.set(category.id, candidate)
    }
  }
}

// Runs every enumerated plan through the engine in batches, yielding to the event
// loop between them so the caller's progress bar can paint, and returns the winner
// of each category. onProgress is called after each batch (and once at the start)
// with the running count.
export async function buildBestPlans(
  inputs: Inputs,
  onProgress?: (done: number, total: number) => void,
  batchSize = 200,
): Promise<BestPlansResult> {
  const plans = enumeratePlans(inputs)
  const total = plans.length
  const best = new Map<BestCategoryId, Candidate>()

  onProgress?.(0, total)
  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total)
    for (let i = start; i < end; i += 1) {
      const plan = plans[i]!
      consider(best, { plan, metrics: metricsOf(runPlan(inputs, plan), plan) })
    }
    onProgress?.(end, total)
    if (end < total) await yieldToEventLoop()
  }

  const winners = CATEGORIES.flatMap((category) => {
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
