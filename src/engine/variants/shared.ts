import type { Loan, LoanPayment } from '../loan'
import type { Wallet } from '../wallet'
import {
  apartmentPriceAt,
  purchaseAllowedFrom,
  rentAt,
  rentDueAt,
  saleProceedsAt,
  type HousingInputs,
  type Inputs,
} from '../types/inputs'
import type { MonthRow, Phase } from '../types/plan'
import type { MonthContext } from './months'

export const NO_PAYMENT: LoanPayment = { paid: 0, interest: 0, principal: 0 }

export function purchasePriceAt(inputs: Inputs, purchaseMonth: number | null): number | null {
  return purchaseMonth === null ? null : apartmentPriceAt(inputs, purchaseMonth)
}

// The earliest month this variant may buy. Selling waits for the sale; the others
// can buy from month 0.
export function canBuyAt(housing: HousingInputs, monthIndex: number): boolean {
  return monthIndex >= purchaseAllowedFrom(housing)
}

export function payRent(
  inputs: Inputs,
  wallet: Wallet,
  month: MonthContext,
  budget: number,
): { rentPaid: number; budget: number } {
  const rent = rentAt(inputs, month.index)
  if (rent <= 0) return { rentPaid: 0, budget }

  const fromBudget = Math.min(rent, budget)
  // Rent is not optional: a shortfall comes out of savings, not out of the rent.
  const fromSavings = wallet.takeSavings(rent - fromBudget)
  return { rentPaid: fromBudget + fromSavings, budget: budget - fromBudget }
}

// Pays ONLY the bank's scheduled annuity — topped up from savings if the month's
// cash cannot cover it — and returns whatever budget is left for the plan to
// decide on. A monthly plan then prepays that surplus (same total, so its numbers
// are unchanged); a lump plan saves it at the deposit rate and closes the loan in
// one hit later, which is the arbitrage the Otbasy strategy is built on.
export function payScheduled(
  loan: Loan,
  wallet: Wallet,
  budget: number,
): { payment: LoanPayment; budget: number } {
  const scheduled = loan.scheduledPayment
  const fromSavings = budget < scheduled ? wallet.takeSavings(scheduled - budget) : 0
  const payment = loan.pay(Math.min(budget + fromSavings, scheduled))

  // On the final month the loan closes for less than the scheduled amount; return
  // any savings top-up it did not need, otherwise that money disappears.
  const spentFromBudget = Math.min(payment.paid, budget)
  const spentFromSavings = payment.paid - spentFromBudget
  if (spentFromSavings < fromSavings) wallet.addSavings(fromSavings - spentFromSavings)

  return { payment, budget: budget - spentFromBudget }
}

export function phaseOf(
  housing: HousingInputs,
  month: MonthContext,
  owned: boolean,
  loan: Loan | null,
): Phase {
  if (owned) return loan !== null && loan.balance > 0 ? 'owned-with-loan' : 'owned'
  if (rentDueAt(housing, month.index)) return 'renting'
  // Not renting and not owning: either living in the flat you'll sell (selling,
  // before the sale) or living rent-free (free).
  return housing.situation === 'selling' ? 'pre-sale' : 'free-housing'
}

export function buildRow(args: {
  inputs: Inputs
  housing: HousingInputs
  month: MonthContext
  wallet: Wallet
  owned: boolean
  loan: Loan | null
  rentPaid: number
  payment: LoanPayment
}): MonthRow {
  const { inputs, housing, month, wallet, owned, loan, rentPaid, payment } = args
  return {
    index: month.index,
    yearMonth: month.yearMonth,
    phase: phaseOf(housing, month, owned, loan),
    apartmentPrice: apartmentPriceAt(inputs, month.index),
    freeCash: month.freeCash,
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
    netWorth: netWorth(inputs, housing, month, wallet, owned, loan),
  }
}

// Continuous across the sale and the purchase: before the sale the old flat is
// carried at what it will fetch, after the purchase the new one at its price.
// Without that, net worth would jump by tens of millions on those two months. A
// variant that is not selling has no old flat to carry.
function netWorth(
  inputs: Inputs,
  housing: HousingInputs,
  month: MonthContext,
  wallet: Wallet,
  owned: boolean,
  loan: Loan | null,
): number {
  const beforeSale = housing.situation === 'selling' && !rentDueAt(housing, month.index)
  const oldApartment = beforeSale ? saleProceedsAt(inputs, housing, month.index) : 0
  const newApartment = owned ? apartmentPriceAt(inputs, month.index) : 0
  return (
    oldApartment +
    newApartment +
    wallet.savingsBalance +
    wallet.otbasyBalance -
    (loan?.balance ?? 0)
  )
}
