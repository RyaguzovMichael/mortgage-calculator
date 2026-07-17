import { HALYK_DELAYED } from '../plans'
import { runPlan } from '../runPlan'
import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Rent and save for `savingMonths`, then buy with the whole pile down and clear
// the smaller loan. `savingMonths` is chained to Otbasy's purchase month by
// simulateAll, so it becomes the plan's saveMonths here.
export function simulateHalykDelayed(inputs: Inputs, savingMonths: number): VariantResult {
  return runPlan(inputs, { ...HALYK_DELAYED, saveMonths: savingMonths })
}
