import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Buy in the sale month with a 20%-of-target-loan down payment; no rent ever.
// The whole free cash flow goes into the 24% loan every month — at that rate
// early repayment beats any deposit, so nothing is saved on the side.
export function simulateHalykImmediate(inputs: Inputs): VariantResult {
  throw new Error('not implemented')
}
