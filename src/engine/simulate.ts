import { summarize } from './summary'
import { targetLoan, type Inputs } from './types/inputs'
import type { VariantId, VariantResult } from './types/plan'
import { simulateHalykImmediate } from './variants/halykImmediate'
import { simulateHalykDelayed } from './variants/halykDelayed'
import { simulateOtbasy } from './variants/otbasy'
import { simulateAllCash } from './variants/allCash'

// The Vue layer's only entry point into the engine.
export interface SimulationReport {
  readonly variants: readonly VariantResult[]
  readonly targetLoan: number
  readonly bestVariant: VariantId
  // Where the comparison actually ends, which is rarely `inputs.horizonMonths` —
  // see `comparisonWindow`.
  readonly comparisonMonths: number
}

export function simulateAll(inputs: Inputs): SimulationReport {
  // Otbasy runs first so the delayed-Halyk savings window can chain to its
  // purchase month, which is what makes the two comparable on one window.
  const otbasy = simulateOtbasy(inputs)
  const savingMonths = inputs.halykDelayedSavingMonths ?? otbasy.purchaseMonth

  // No Otbasy purchase means no window to chain to, and delayed Halyk is defined
  // as "wait exactly as long as Otbasy waits". So it is dropped rather than run
  // against some invented window: falling back to the horizon would silently
  // turn it into "rent forever, never buy" and rank that as a real option.
  const simulated = [
    simulateHalykImmediate(inputs),
    ...(savingMonths === null ? [] : [simulateHalykDelayed(inputs, savingMonths)]),
    otbasy,
    simulateAllCash(inputs),
  ]

  const comparisonMonths = comparisonWindow(simulated, inputs.horizonMonths)
  const variants = simulated.map((variant) => endAt(variant, comparisonMonths))

  return {
    variants,
    targetLoan: targetLoan(inputs),
    bestVariant: bestOf(variants),
    comparisonMonths,
  }
}

// The question is "which way of buying this apartment leaves me better off", and
// it is answered the moment the last variant owns the flat outright. Past that
// every variant does the same thing — pour the same free cash into deposits — so
// the tail is four near-parallel lines drifting up, and the horizon alone decides
// how much of that drift is added to each. Cutting it keeps the horizon from
// inflating the gaps.
//
// "Near-parallel" and not "identical": the variants arrive at this point holding
// different mixes of pockets, so they compound at slightly different blended
// rates and a long enough tail can still re-order the middle of the field. That
// is a real effect, but it is a statement about deposit mix, not about how to buy
// an apartment, and it is not what this comparison is for.
//
// The window stays common to all four rather than ending each variant at its own
// debt-free month: net worth measured on different dates is not a comparison, it
// just rewards whoever was measured last.
function comparisonWindow(variants: readonly VariantResult[], horizonMonths: number): number {
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
// moment prices grow and the variants buy in different months at different
// prices. Net worth stays honest either way.
function bestOf(variants: readonly VariantResult[]): VariantId {
  return variants.reduce((best, variant) =>
    variant.totals.netWorthAtEnd > best.totals.netWorthAtEnd ? variant : best,
  ).id
}
