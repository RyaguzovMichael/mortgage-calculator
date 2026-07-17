import type { Wallet } from '../wallet'
import { freeCashAt, saleProceedsAt, type Inputs } from '../types/inputs'
import { addMonths, type YearMonth } from '../types/yearMonth'

// One month, already accrued, handed to a variant to act on. The generator owns
// the mechanics every variant shares; the variant owns the decisions.
export interface MonthContext {
  readonly index: number
  readonly yearMonth: YearMonth
  readonly interestEarned: number
  readonly govBonus: number
  // 0 until the cash flow starts, indexed after that.
  readonly freeCash: number
  // Non-zero only in the sale month. Deliberately not deposited for you —
  // buying immediately and parking it are both valid, so the variant decides.
  readonly saleProceeds: number
}

export function* months(inputs: Inputs, wallet: Wallet): Generator<MonthContext> {
  for (let index = 0; index < inputs.horizonMonths; index++) {
    const yearMonth = addMonths(inputs.start, index)
    const accrual = wallet.accrue(yearMonth)
    yield {
      index,
      yearMonth,
      interestEarned: accrual.interest,
      govBonus: accrual.govBonus,
      freeCash: freeCashAt(inputs, index),
      saleProceeds: index === inputs.sale.monthOffset ? saleProceedsAt(inputs, index) : 0,
    }
  }
}
