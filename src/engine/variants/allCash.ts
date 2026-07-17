import { createWallet } from '../wallet'
import { summarize } from '../summary'
import { apartmentPriceAt, type Inputs } from '../types/inputs'
import type { MonthRow, VariantResult } from '../types/plan'
import { months } from './months'
import { buildRow, hasMovedOut, NO_PAYMENT, payRent, purchasePriceAt } from './shared'

// Rent and pile everything into savings until it covers the full price, then buy
// outright. No bank, no interest paid — rent is the entire cost, set against
// whatever the pile earns while it grows.
export function simulateAllCash(inputs: Inputs): VariantResult {
  const wallet = createWallet(inputs, { useOtbasy: false })
  const rows: MonthRow[] = []

  let owned = false
  let purchaseMonth: number | null = null

  for (const month of months(inputs, wallet)) {
    if (month.saleProceeds > 0) wallet.addSavings(month.saleProceeds)

    let budget = month.freeCash
    let rentPaid = 0

    if (!owned && hasMovedOut(inputs, month.index)) {
      const price = apartmentPriceAt(inputs, month.index)
      if (wallet.savingsBalance >= price) {
        wallet.takeSavings(price)
        owned = true
        purchaseMonth = month.index
      }
    }

    if (!owned && hasMovedOut(inputs, month.index)) {
      ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
    }

    wallet.addSavings(budget)
    rows.push(buildRow({ inputs, month, wallet, owned, loan: null, rentPaid, payment: NO_PAYMENT }))
  }

  return {
    id: 'all-cash',
    rows,
    purchaseMonth,
    // Never borrows, so it is debt-free from the moment it owns the flat.
    debtFreeMonth: purchaseMonth,
    purchasePrice: purchasePriceAt(inputs, purchaseMonth),
    totals: summarize(rows),
  }
}
