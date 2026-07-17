import { createLoan, type Loan } from '../loan'
import { createWallet, type Wallet } from '../wallet'
import { summarize } from '../summary'
import { apartmentPriceAt, targetLoan, type Inputs } from '../types/inputs'
import type { MonthRow, VariantResult } from '../types/plan'
import { months } from './months'
import { buildRow, hasMovedOut, NO_PAYMENT, payRent, payScheduled } from './shared'

// Rent, seed the Otbasy deposit from the sale proceeds and contribute monthly
// until both the 50% balance and CC >= 5 gates open, then take the 8.5% loan.
//
// The whole variant leans on one fact: 8.5% is far below the deposit rate. So it
// borrows the maximum the contract allows rather than the minimum it needs, and
// it never prepays — leftover cash compounds in savings until it can close the
// loan in one hit. Both choices are the same arbitrage.
export function simulateOtbasy(inputs: Inputs): VariantResult {
  const wallet = createWallet(inputs)
  const rows: MonthRow[] = []

  const target = targetLoan(inputs)
  const requiredBalance = inputs.otbasy.minBalanceFraction * target

  let loan: Loan | null = null
  let owned = false
  let seeded = false
  let purchaseMonth: number | null = null
  let debtFreeMonth: number | null = null

  for (const month of months(inputs, wallet)) {
    if (month.saleProceeds > 0) wallet.addSaleProceeds(month.saleProceeds)

    let budget = month.freeCash
    let rentPaid = 0
    let payment = NO_PAYMENT

    // The seed is what makes the 50% gate reachable at all — contributions alone
    // take years once rent has eaten most of the cash flow.
    if (!seeded && hasMovedOut(inputs, month.index)) {
      wallet.addOtbasy(wallet.takeSavings(inputs.otbasy.seedFromSale, month.index))
      seeded = true
    }

    if (!owned && gatesOpen(wallet, requiredBalance, inputs.otbasy.ccTarget)) {
      const price = apartmentPriceAt(inputs, month.index)
      // Borrow the most the contract allows; contribute only the remainder.
      const contribution = Math.max(0, price - target)
      if (available(wallet, month.index) >= contribution) {
        const fromOtbasy = wallet.takeOtbasy(Math.min(contribution, wallet.otbasyBalance))
        const paid = fromOtbasy + wallet.takeSavings(contribution - fromOtbasy, month.index)
        loan = createLoan(
          Math.max(0, price - paid),
          inputs.otbasy.loanAnnualRate,
          inputs.halyk.maxTermMonths,
        )
        owned = true
        purchaseMonth = month.index
        if (loan.balance === 0) debtFreeMonth = month.index
      }
    }

    if (!owned && hasMovedOut(inputs, month.index)) {
      ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
      // Everything left feeds the Otbasy gates, not general savings.
      wallet.addOtbasy(budget)
      budget = 0
    }

    if (loan !== null && loan.balance > 0) {
      ;({ payment, budget } = payScheduled(loan, wallet, month, budget))
      wallet.addSavings(budget)
      budget = 0

      // Close it the moment savings can cover it — prepay, not pay: this
      // month's interest was already charged above.
      if (wallet.unlockedSavings(month.index) >= loan.balance) {
        const settled = loan.prepay(wallet.takeSavings(loan.balance, month.index))
        payment = {
          paid: payment.paid + settled,
          interest: payment.interest,
          principal: payment.principal + settled,
        }
        debtFreeMonth = month.index
      }
    }

    wallet.addSavings(budget)
    rows.push(buildRow({ inputs, month, wallet, owned, loan, rentPaid, payment }))
  }

  return { id: 'otbasy', rows, purchaseMonth, debtFreeMonth, totals: summarize(rows) }
}

function gatesOpen(wallet: Wallet, requiredBalance: number, ccTarget: number): boolean {
  return wallet.otbasyBalance >= requiredBalance && wallet.otbasyCc >= ccTarget
}

function available(wallet: Wallet, monthIndex: number): number {
  return wallet.otbasyBalance + wallet.unlockedSavings(monthIndex)
}
