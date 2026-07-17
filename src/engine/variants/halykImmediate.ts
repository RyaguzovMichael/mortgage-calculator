import { HALYK_IMMEDIATE } from '../plans'
import { runPlan } from '../runPlan'
import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Buy the month the sale lands; borrow the most Halyk allows and pour the free
// cash into the 24% loan every month. Now just the built-in plan run through the
// shared driver.
export function simulateHalykImmediate(inputs: Inputs): VariantResult {
  return runPlan(inputs, HALYK_IMMEDIATE)
}
