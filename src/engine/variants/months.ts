import type { Wallet } from '../wallet'
import type { Inputs } from '../types/inputs'
import type { YearMonth } from '../types/yearMonth'

// One month, already accrued, handed to a variant to act on. The generator owns
// the mechanics every variant shares; the variant owns the decisions.
export interface MonthContext {
  readonly index: number
  readonly yearMonth: YearMonth
  readonly interestEarned: number
  // 0 until the cash flow starts.
  readonly freeCash: number
  // Non-zero only in the sale month. Deliberately not deposited for you —
  // buying immediately and parking it are both valid, so the variant decides.
  readonly saleProceeds: number
}

export function* months(inputs: Inputs, wallet: Wallet): Generator<MonthContext> {
  throw new Error('not implemented')
}
