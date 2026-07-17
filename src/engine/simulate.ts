import type { Inputs } from './types/inputs'
import type { VariantId, VariantResult } from './types/plan'

// The Vue layer's only entry point into the engine.
export interface SimulationReport {
  readonly variants: readonly VariantResult[]
  readonly targetLoan: number
  readonly bestVariant: VariantId
}

// Runs Otbasy first so the delayed-Halyk savings window can chain to its
// purchase month (unless `inputs.halykDelayedSavingMonths` overrides it), which
// is what makes the two comparable on the same window.
export function simulateAll(inputs: Inputs): SimulationReport {
  throw new Error('not implemented')
}
