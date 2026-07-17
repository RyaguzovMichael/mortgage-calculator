import { createLoan, type Loan } from '../loan'
import { createWallet } from '../wallet'
import { summarize } from '../summary'
import { apartmentPriceAt, type Inputs } from '../types/inputs'
import type { MonthRow, VariantResult } from '../types/plan'
import { months } from './months'
import { buildRow, hasMovedOut, NO_PAYMENT, payRent, payScheduled, purchasePriceAt } from './shared'

// Rent and save at the Kaspi rate for `savingMonths`, then buy with the whole
// pile as the down payment and clear the smaller 24% loan with the full cash
// flow. `savingMonths` is chained to Otbasy's purchase month by simulateAll.
//
// Unlike Halyk-immediate this contributes everything it has rather than the
// bank's 20% minimum: at 24% every tenge left on deposit costs more in loan
// interest than it can earn.
export function simulateHalykDelayed(inputs: Inputs, savingMonths: number): VariantResult {
  const wallet = createWallet(inputs, { useOtbasy: false })
  const rows: MonthRow[] = []

  let loan: Loan | null = null
  let owned = false
  let purchaseMonth: number | null = null
  let debtFreeMonth: number | null = null

  for (const month of months(inputs, wallet)) {
    if (month.saleProceeds > 0) wallet.addSaleProceeds(month.saleProceeds)

    let budget = month.freeCash
    let rentPaid = 0
    let payment = NO_PAYMENT

    if (!owned && month.index >= savingMonths && hasMovedOut(inputs, month.index)) {
      const price = apartmentPriceAt(inputs, month.index)
      const contribution = wallet.takeSavings(price, month.index)
      loan = createLoan(
        Math.max(0, price - contribution),
        inputs.halyk.annualRate,
        inputs.halyk.maxTermMonths,
      )
      owned = true
      purchaseMonth = month.index
      if (loan.balance === 0) debtFreeMonth = month.index
    }

    if (!owned && hasMovedOut(inputs, month.index)) {
      ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
    }

    if (loan !== null && loan.balance > 0) {
      ;({ payment, budget } = payScheduled(loan, wallet, month, budget))
      const extra = loan.prepay(budget)
      budget -= extra
      payment = {
        paid: payment.paid + extra,
        interest: payment.interest,
        principal: payment.principal + extra,
      }
      if (loan.balance === 0 && debtFreeMonth === null) debtFreeMonth = month.index
    }

    wallet.addSavings(budget)
    rows.push(buildRow({ inputs, month, wallet, owned, loan, rentPaid, payment }))
  }

  return {
    id: 'halyk-delayed',
    rows,
    purchaseMonth,
    debtFreeMonth,
    purchasePrice: purchasePriceAt(inputs, purchaseMonth),
    totals: summarize(rows),
  }
}
