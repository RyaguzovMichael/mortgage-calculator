import { createLoan, type Loan } from '../loan'
import { createWallet } from '../wallet'
import { summarize } from '../summary'
import { apartmentPriceAt, targetLoan, type Inputs } from '../types/inputs'
import type { MonthRow, VariantResult } from '../types/plan'
import { months } from './months'
import { buildRow, hasMovedOut, NO_PAYMENT, payRent, payScheduled, purchasePriceAt } from './shared'

// Buy as soon as the sale lands; no rent. The whole free cash flow goes into the
// 24% loan every month — at that rate early repayment beats any deposit, so
// nothing is saved on the side.
//
// The down payment has to be real money: if unlocked savings cannot cover the
// contribution yet the purchase waits, and rent runs while it waits, because the
// old flat is already sold.
export function simulateHalykImmediate(inputs: Inputs): VariantResult {
  const wallet = createWallet(inputs, { useOtbasy: false })
  const rows: MonthRow[] = []

  const target = targetLoan(inputs)
  const loanWanted = Math.max(0, target - inputs.halyk.downPaymentFraction * target)

  let loan: Loan | null = null
  let owned = false
  let purchaseMonth: number | null = null
  let debtFreeMonth: number | null = null

  for (const month of months(inputs, wallet)) {
    if (month.saleProceeds > 0) wallet.addSaleProceeds(month.saleProceeds)

    let budget = month.freeCash
    let rentPaid = 0
    let payment = NO_PAYMENT

    if (!owned && hasMovedOut(inputs, month.index)) {
      const contribution = Math.max(0, apartmentPriceAt(inputs, month.index) - loanWanted)
      if (wallet.unlockedSavings(month.index) >= contribution) {
        wallet.takeSavings(contribution, month.index)
        loan = createLoan(loanWanted, inputs.halyk.annualRate, inputs.halyk.maxTermMonths)
        owned = true
        purchaseMonth = month.index
        if (loan.balance === 0) debtFreeMonth = month.index
      }
    }

    if (!owned && hasMovedOut(inputs, month.index)) {
      ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
    }

    if (loan !== null && loan.balance > 0) {
      ;({ payment, budget } = payScheduled(loan, wallet, month, budget))
      const extra = loan.prepay(budget)
      budget -= extra
      payment = { paid: payment.paid + extra, interest: payment.interest, principal: payment.principal + extra }
      if (loan.balance === 0 && debtFreeMonth === null) debtFreeMonth = month.index
    }

    wallet.addSavings(budget)
    rows.push(buildRow({ inputs, month, wallet, owned, loan, rentPaid, payment }))
  }

  return {
    id: 'halyk-immediate',
    rows,
    purchaseMonth,
    debtFreeMonth,
    purchasePrice: purchasePriceAt(inputs, purchaseMonth),
    totals: summarize(rows),
  }
}
