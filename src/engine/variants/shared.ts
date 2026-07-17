import type { Loan, LoanPayment } from '../loan'
import type { Wallet } from '../wallet'
import { apartmentPriceAt, type Inputs } from '../types/inputs'
import type { MonthRow, Phase } from '../types/plan'
import type { MonthContext } from './months'

export const NO_PAYMENT: LoanPayment = { paid: 0, interest: 0, principal: 0 }

export function purchasePriceAt(inputs: Inputs, purchaseMonth: number | null): number | null {
  return purchaseMonth === null ? null : apartmentPriceAt(inputs, purchaseMonth)
}

// Selling the old flat is what forces the move: from that month on a variant is
// either in its new apartment or paying rent.
export function hasMovedOut(inputs: Inputs, monthIndex: number): boolean {
  return monthIndex >= inputs.sale.monthOffset
}

export function payRent(
  inputs: Inputs,
  wallet: Wallet,
  month: MonthContext,
  budget: number,
): { rentPaid: number; budget: number } {
  const rent = inputs.cashflow.monthlyRent
  if (rent <= 0) return { rentPaid: 0, budget }

  const fromBudget = Math.min(rent, budget)
  // Rent is not optional: a shortfall comes out of savings, not out of the rent.
  const fromSavings = wallet.takeSavings(rent - fromBudget, month.index)
  return { rentPaid: fromBudget + fromSavings, budget: budget - fromBudget }
}

// The bank's scheduled payment comes first and is topped up from savings if the
// month's cash cannot cover it; only what is left over is discretionary.
export function payScheduled(
  loan: Loan,
  wallet: Wallet,
  month: MonthContext,
  budget: number,
): { payment: LoanPayment; budget: number } {
  let available = budget
  if (available < loan.scheduledPayment) {
    available += wallet.takeSavings(loan.scheduledPayment - available, month.index)
  }
  const payment = loan.pay(available)
  return { payment, budget: Math.max(0, budget - payment.paid) }
}

export function phaseOf(inputs: Inputs, month: MonthContext, owned: boolean, loan: Loan | null): Phase {
  if (!owned) return hasMovedOut(inputs, month.index) ? 'renting' : 'pre-sale'
  return loan !== null && loan.balance > 0 ? 'owned-with-loan' : 'owned'
}

export function buildRow(args: {
  inputs: Inputs
  month: MonthContext
  wallet: Wallet
  owned: boolean
  loan: Loan | null
  rentPaid: number
  payment: LoanPayment
}): MonthRow {
  const { inputs, month, wallet, owned, loan, rentPaid, payment } = args
  return {
    index: month.index,
    yearMonth: month.yearMonth,
    phase: phaseOf(inputs, month, owned, loan),
    apartmentPrice: apartmentPriceAt(inputs, month.index),
    rentPaid,
    loanPayment: payment.paid,
    loanInterest: payment.interest,
    loanPrincipal: payment.principal,
    loanBalance: loan?.balance ?? 0,
    savingsBalance: wallet.savingsBalance,
    otbasyBalance: wallet.otbasyBalance,
    otbasyCc: wallet.otbasyCc,
    depositInterestEarned: month.interestEarned,
    govBonus: month.govBonus,
    netWorth: netWorth(inputs, month, wallet, owned, loan),
  }
}

// Continuous across the sale and the purchase: before the sale the old flat is
// carried at what it will fetch, after the purchase the new one at its price.
// Without that, net worth would jump by tens of millions on those two months.
function netWorth(
  inputs: Inputs,
  month: MonthContext,
  wallet: Wallet,
  owned: boolean,
  loan: Loan | null,
): number {
  const oldApartment = hasMovedOut(inputs, month.index) ? 0 : inputs.sale.proceeds
  const newApartment = owned ? apartmentPriceAt(inputs, month.index) : 0
  return (
    oldApartment +
    newApartment +
    wallet.savingsBalance +
    wallet.otbasyBalance -
    (loan?.balance ?? 0)
  )
}
