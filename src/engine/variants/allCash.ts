import { ALL_CASH } from '../plans'
import { runPlan } from '../runPlan'
import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Rent and pile everything into savings until it covers the full price, then buy
// outright — no bank, no interest.
export function simulateAllCash(inputs: Inputs): VariantResult {
  return runPlan(inputs, ALL_CASH)
}
