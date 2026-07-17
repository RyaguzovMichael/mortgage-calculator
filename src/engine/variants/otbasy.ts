import type { Inputs } from '../types/inputs'
import type { VariantResult } from '../types/plan'

// Rent, seed the Otbasy deposit from the sale proceeds and contribute monthly
// until both the 50% balance and CC >= 5 gates open, then take the 8.5% loan.
// After that the loan is NOT prepaid: 8.5% is cheaper than the 18.4% deposit,
// so leftover cash compounds in savings until it can close the loan in one hit.
export function simulateOtbasy(inputs: Inputs): VariantResult {
  throw new Error('not implemented')
}
