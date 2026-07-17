import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Rent and pile everything into savings until it covers the full price, then
// buy outright. No bank, no interest paid — rent is the entire cost.
export function simulateAllCash(inputs: Inputs): VariantResult {
  throw new Error('not implemented')
}
