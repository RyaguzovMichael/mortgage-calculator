import { OTBASY_PLAN } from '../plans'
import { runPlan } from '../runPlan'
import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Seed the Otbasy deposit, wait for the 50% and CC gates, borrow the whole target
// at 8.5%, and close it in one hit once savings cover the balance.
export function simulateOtbasy(inputs: Inputs): VariantResult {
  return runPlan(inputs, OTBASY_PLAN)
}
