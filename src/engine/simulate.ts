import { runPlan } from './runPlan'
import { summarize } from './summary'
import type { Inputs } from './types/inputs'
import type { PurchasePlan, VariantId, VariantResult } from './types/plan'

// The Vue layer's only entry point into the engine.
export interface SimulationReport {
  // Only the plans the user put on the board — every plan is computed, but the
  // report carries the shown ones, cut to the common comparison window.
  readonly variants: readonly VariantResult[]
  // Housing is now a plan decision, so there is no one target loan for the whole
  // report — this is the best shown plan's own figure (or the first shown plan's,
  // when there is no best), for the one place the UI still shows a single number.
  readonly targetLoan: number
  // null when the board is empty (every plan hidden): there is no best of nothing.
  readonly bestVariant: VariantId | null
  // Where the comparison actually ends, which is rarely `inputs.horizonMonths` —
  // see `comparisonWindow`.
  readonly comparisonMonths: number
  // Names of shown plans that could not run: a delayed plan whose window chains to
  // an Otbasy purchase that never happens. Surfaced so the board can say why a plan
  // the user asked to see is missing, rather than letting it vanish silently.
  readonly droppedShown: readonly string[]
}

// A plan whose savings window chains to an Otbasy purchase that never happens is
// dropped rather than run against an invented window — falling back to the horizon
// would silently turn "wait as long as Otbasy" into "rent forever, never buy" and
// rank that as a real option.
const DROP = Symbol('drop')

// The built-in plans come from data/plans.yml (parsed in infrastructure); the
// engine cannot import that file without reaching across its own boundary, so they
// are handed in. The user's own plans it reads straight off inputs.
export function simulateAll(
  inputs: Inputs,
  builtInPlans: readonly PurchasePlan[],
): SimulationReport {
  const catalogue = [...builtInPlans, ...inputs.plans.custom]

  // Delayed plans wait exactly as long as the Otbasy plan does, so its purchase
  // month has to be known before they can run. Computed once and reused, and from
  // the Otbasy plan itself so the chain still works when Otbasy is hidden.
  const otbasyPlan = catalogue.find((plan) => plan.buyWhen === 'otbasy-gates')
  const otbasyResult = otbasyPlan ? runPlan(inputs, otbasyPlan) : null

  const runnable: VariantResult[] = []
  const droppedShown: string[] = []
  for (const plan of catalogue) {
    const saveMonths = resolveSaveMonths(inputs, plan, otbasyResult?.purchaseMonth ?? null)
    if (saveMonths === DROP) {
      if (inputs.plans.shown.includes(plan.id)) droppedShown.push(plan.name)
      continue
    }
    // Reuse the Otbasy run rather than repeat it; everything else runs fresh.
    const result =
      plan === otbasyPlan && otbasyResult
        ? otbasyResult
        : runPlan(inputs, saveMonths === plan.saveMonths ? plan : { ...plan, saveMonths })
    runnable.push(result)
  }

  const shown = runnable.filter((variant) => inputs.plans.shown.includes(variant.id))
  const comparisonMonths = comparisonWindow(shown, inputs.horizonMonths)
  const variants = shown.map((variant) => endAt(variant, comparisonMonths))
  const bestVariant = variants.length > 0 ? bestOf(variants) : null

  return {
    variants,
    targetLoan: reportTargetLoan(variants, bestVariant),
    bestVariant,
    comparisonMonths,
    droppedShown,
  }
}

function reportTargetLoan(
  variants: readonly VariantResult[],
  bestVariant: VariantId | null,
): number {
  const first = variants[0]
  if (!first) return 0
  return (variants.find((variant) => variant.id === bestVariant) ?? first).targetLoan
}

// A number resolves the window; null leaves runPlan's own default (irrelevant to
// every buyWhen but after-months); DROP means "no window to chain to".
function resolveSaveMonths(
  inputs: Inputs,
  plan: PurchasePlan,
  otbasyPurchase: number | null,
): number | null | typeof DROP {
  if (plan.buyWhen !== 'after-months' || plan.saveMonths !== null) return plan.saveMonths
  // An explicit hand-set window wins over the chain; otherwise chase Otbasy.
  const chained = inputs.delayedSavingMonths ?? otbasyPurchase
  return chained === null ? DROP : chained
}

// The question is "which way of buying this apartment leaves me better off", and
// it is answered the moment the last variant owns the flat outright. Past that
// every variant does the same thing — pour the same free cash into deposits — so
// the tail is a set of near-parallel lines drifting up, and the horizon alone
// decides how much of that drift is added to each. Cutting it keeps the horizon
// from inflating the gaps.
//
// "Near-parallel" and not "identical": the variants arrive at this point holding
// different mixes of pockets, so they compound at slightly different blended rates
// and a long enough tail can still re-order the middle of the field. That is a
// real effect, but it is a statement about deposit mix, not about how to buy an
// apartment, and it is not what this comparison is for.
//
// The window is common to all shown variants rather than ending each at its own
// debt-free month: net worth measured on different dates is not a comparison, it
// just rewards whoever was measured last.
function comparisonWindow(variants: readonly VariantResult[], horizonMonths: number): number {
  // An empty board has no window to compute; fall back to the horizon.
  if (variants.length === 0) return horizonMonths
  // A variant that never gets out of debt has nothing to cut, so it pins the
  // window to the horizon.
  const ends = variants.map((variant) => variant.debtFreeMonth ?? horizonMonths - 1)
  return Math.min(horizonMonths, Math.max(...ends) + 1)
}

function endAt(variant: VariantResult, months: number): VariantResult {
  if (variant.rows.length <= months) return variant
  const rows = variant.rows.slice(0, months)
  return { ...variant, rows, totals: summarize(rows) }
}

// Ranked by net worth, not by totalLoss: totalLoss assumes every variant ends up
// with the same apartment so its price cancels out, which stops being true the
// moment prices grow and the variants buy in different months at different prices.
// Net worth stays honest either way.
function bestOf(variants: readonly VariantResult[]): VariantId {
  return variants.reduce((best, variant) =>
    variant.totals.netWorthAtEnd > best.totals.netWorthAtEnd ? variant : best,
  ).id
}
