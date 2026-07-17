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
}

export function simulateAll(inputs: Inputs): SimulationReport {
  // Otbasy runs first so the delayed-Halyk savings window can chain to its
  // purchase month, which is what makes the two comparable on one window.
  const otbasy = simulateOtbasy(inputs)
  const savingMonths =
    inputs.halykDelayedSavingMonths ?? otbasy.purchaseMonth ?? inputs.horizonMonths

  const variants = [
    simulateHalykImmediate(inputs),
    simulateHalykDelayed(inputs, savingMonths),
    otbasy,
    simulateAllCash(inputs),
  ]

  return {
    variants,
    targetLoan: targetLoan(inputs),
    bestVariant: bestOf(variants),
  }
}

// Ranked by net worth, not by totalLoss: totalLoss assumes every variant ends up
// with the same apartment so its price cancels out, which stops being true the
// moment prices grow and the variants buy in different months at different
// prices. Net worth stays honest either way.
function bestOf(variants: readonly VariantResult[]): VariantId {
  return variants.reduce((best, variant) =>
    variant.totals.netWorthAtHorizon > best.totals.netWorthAtHorizon ? variant : best,
  ).id
}
