import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Rent and save at the Kaspi rate for `savingMonths`, then buy with the whole
// pile as the down payment and clear the smaller 24% loan with the full cash
// flow. `savingMonths` is chained to Otbasy's purchase month by simulateAll.
export function simulateHalykDelayed(inputs: Inputs, savingMonths: number): VariantResult {
  throw new Error('not implemented')
}
