import { createLoan, type Loan } from './loan'
import { createWallet, type Wallet } from './wallet'
import { summarize } from './summary'
import { apartmentPriceAt, rentDueAt, targetLoan, type Inputs } from './types/inputs'
import type { MonthRow, PurchasePlan, VariantResult } from './types/plan'
import { months } from './variants/months'
import { buildRow, canBuyAt, NO_PAYMENT, payRent, payScheduled, purchasePriceAt } from './variants/shared'

// One driver for every plan. What used to be four ~70-line files that differed by
// a dozen lines is now those differences read off the plan: when to buy, how much
// to borrow, how to repay. The month loop, the rent, the loan servicing — all of
// it identical across plans — lives here once.
export function runPlan(inputs: Inputs, plan: PurchasePlan): VariantResult {
  const useOtbasy = plan.loan === 'otbasy'
  const wallet = createWallet(inputs, { useOtbasy })
  const rows: MonthRow[] = []

  const target = targetLoan(inputs)
  const rate = useOtbasy ? inputs.otbasy.loanAnnualRate : inputs.halyk.annualRate
  const term = useOtbasy ? inputs.otbasy.maxTermMonths : inputs.halyk.maxTermMonths

  let loan: Loan | null = null
  let owned = false
  let seeded = false
  let purchaseMonth: number | null = null
  let debtFreeMonth: number | null = null

  for (const month of months(inputs, wallet)) {
    if (month.saleProceeds > 0) wallet.addSavings(month.saleProceeds)

    let budget = month.freeCash
    let rentPaid = 0
    let payment = NO_PAYMENT

    // Otbasy needs the account seeded from the sale before its gates can open.
    if (useOtbasy && !seeded && canBuyAt(inputs, month.index)) {
      wallet.addOtbasy(wallet.takeSavings(inputs.otbasy.seedFromSale))
      seeded = true
    }

    if (!owned && buyNow(inputs, plan, month.index, wallet, target)) {
      const price = apartmentPriceAt(inputs, month.index)
      // Timing is not enough — the down payment has to be real money. borrow-min
      // always affords it (it puts down whatever there is); the others wait.
      if (affordsPurchase(inputs, plan, wallet, price)) {
        loan = buy(inputs, plan, wallet, price, rate, term)
        owned = true
        purchaseMonth = month.index
        if (loan === null || loan.balance === 0) debtFreeMonth = month.index
      }
    }

    if (!owned) {
      // The Otbasy plan pours rent-era surplus into the Otbasy account to build its
      // gates, and only from the month a purchase is allowed; the others keep it in
      // savings, and rent whenever rent is due.
      if (useOtbasy) {
        if (canBuyAt(inputs, month.index)) {
          if (rentDueAt(inputs, month.index)) {
            ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
          }
          wallet.addOtbasy(budget)
          budget = 0
        }
      } else if (rentDueAt(inputs, month.index)) {
        ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
      }
    }

    if (loan !== null && loan.balance > 0) {
      ;({ payment, budget } = payScheduled(loan, wallet, budget))
      if (plan.repay === 'monthly') {
        // Everything left hits the principal this month — at these rates early
        // repayment beats any deposit.
        const extra = loan.prepay(budget)
        budget -= extra
        payment = { paid: payment.paid + extra, interest: payment.interest, principal: payment.principal + extra }
        if (loan.balance === 0 && debtFreeMonth === null) debtFreeMonth = month.index
      } else {
        // Save the surplus instead, and close the loan in one hit once it covers
        // the balance — worth it only while the loan rate is below the deposit rate.
        wallet.addSavings(budget)
        budget = 0
        if (wallet.savingsBalance >= loan.balance) {
          const settled = loan.prepay(wallet.takeSavings(loan.balance))
          payment = { paid: payment.paid + settled, interest: payment.interest, principal: payment.principal + settled }
          debtFreeMonth = month.index
        }
      }
    }

    wallet.addSavings(budget)
    rows.push(buildRow({ inputs, month, wallet, owned, loan, rentPaid, payment }))
  }

  return {
    id: plan.id,
    name: plan.name,
    rows,
    purchaseMonth,
    debtFreeMonth,
    purchasePrice: purchasePriceAt(inputs, purchaseMonth),
    totals: summarize(rows),
  }
}

// The month a purchase may happen, per the plan's trigger.
function buyNow(
  inputs: Inputs,
  plan: PurchasePlan,
  monthIndex: number,
  wallet: Wallet,
  target: number,
): boolean {
  switch (plan.buyWhen) {
    case 'asap':
      return canBuyAt(inputs, monthIndex)
    case 'after-months':
      return monthIndex >= (plan.saveMonths ?? 0) && canBuyAt(inputs, monthIndex)
    case 'otbasy-gates':
      return (
        wallet.otbasyBalance >= inputs.otbasy.minBalanceFraction * target &&
        wallet.otbasyCc >= inputs.otbasy.ccTarget
      )
  }
}

// Does the purchase, returns the loan opened (or null). Two shapes: borrow the
// minimum by putting everything down, or borrow a fixed maximum and put only the
// remainder down — the latter gated on that remainder being affordable.
function buy(
  inputs: Inputs,
  plan: PurchasePlan,
  wallet: Wallet,
  price: number,
  rate: number,
  term: number,
): Loan | null {
  if (plan.loan === 'none') {
    // Only reached once savings cover the whole price (buyNow lets it through, and
    // the affordability check below holds it back until then).
    wallet.takeSavings(price)
    return null
  }

  if (plan.borrow === 'min') {
    const paid = wallet.takeSavings(price)
    return createLoan(Math.max(0, price - paid), rate, term)
  }

  // borrow max: a fixed principal, contribute the rest.
  const contribution = Math.max(0, price - maxLoan(inputs, plan))
  const fromOtbasy = plan.loan === 'otbasy' ? wallet.takeOtbasy(Math.min(contribution, wallet.otbasyBalance)) : 0
  const fromSavings = wallet.takeSavings(contribution - fromOtbasy)
  return createLoan(Math.max(0, price - fromOtbasy - fromSavings), rate, term)
}

// The most the contract allows to be borrowed: Halyk requires a minimum down
// payment, Otbasy lets you borrow the whole declared target.
function maxLoan(inputs: Inputs, plan: PurchasePlan): number {
  const target = targetLoan(inputs)
  if (plan.loan === 'otbasy') return target
  return target - inputs.halyk.downPaymentFraction * target
}

// Whether a borrow-max / all-cash plan can afford its down payment yet. borrow-min
// is always affordable (it takes whatever is there), so it is not gated here.
function affordsPurchase(inputs: Inputs, plan: PurchasePlan, wallet: Wallet, price: number): boolean {
  if (plan.borrow === 'min' && plan.loan !== 'none') return true
  const principal = plan.loan === 'none' ? 0 : maxLoan(inputs, plan)
  const contribution = Math.max(0, price - principal)
  return wallet.otbasyBalance + wallet.savingsBalance >= contribution
}
