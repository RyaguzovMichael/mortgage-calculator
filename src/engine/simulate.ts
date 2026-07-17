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

function bestOf(variants: readonly VariantResult[]): VariantId {
  return variants.reduce((best, variant) =>
    variant.totals.totalLoss < best.totals.totalLoss ? variant : best,
  ).id
}
