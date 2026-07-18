import { createLoan, type Loan } from './loan'
import { annuityPayment } from './money'
import { createWallet, type Wallet } from './wallet'
import { summarize } from './summary'
import {
  apartmentPriceAt,
  effectiveHousing,
  loanProduct,
  rentDueAt,
  targetLoan,
  type HousingInputs,
  type Inputs,
} from './types/inputs'
import type { MonthRow, PurchasePlan, VariantResult } from './types/plan'
import { months } from './variants/months'
import {
  buildRow,
  canBuyAt,
  NO_PAYMENT,
  payRent,
  payScheduled,
  purchasePriceAt,
} from './variants/shared'

// One driver for every plan. What used to be four ~70-line files that differed by
// a dozen lines is now those differences read off the plan: when to buy, how much
// to borrow, how to repay. The month loop, the rent, the loan servicing — all of
// it identical across plans — lives here once.
export function runPlan(inputs: Inputs, plan: PurchasePlan): VariantResult {
  const useOtbasy = plan.loan === 'otbasy'
  const housing = effectiveHousing(inputs, plan.situation, plan.saleMonthOffset)
  const wallet = createWallet(inputs, housing, plan.savingsProductId, { useOtbasy })
  const rows: MonthRow[] = []

  const target = targetLoan(inputs, housing)
  // Otbasy is the one fixed programme; anything else is a LoanProduct id (built-in
  // Halyk or a user's own credit) — 'none' never reaches this branch's fields.
  const product = !useOtbasy && plan.loan !== 'none' ? loanProduct(inputs, plan.loan) : null
  const rate = useOtbasy ? inputs.otbasy.loanAnnualRate : (product?.annualRate ?? 0)
  const term = useOtbasy ? inputs.otbasy.maxTermMonths : (product?.maxTermMonths ?? 0)

  let loan: Loan | null = null
  let owned = false
  let seeded = false
  let purchaseMonth: number | null = null
  let debtFreeMonth: number | null = null

  for (const month of months(inputs, housing, wallet)) {
    if (month.saleProceeds > 0) wallet.addSavings(month.saleProceeds)

    let budget = month.freeCash
    let rentPaid = 0
    let payment = NO_PAYMENT

    // Otbasy needs the account seeded from the sale before its gates can open.
    if (useOtbasy && !seeded && canBuyAt(housing, month.index)) {
      wallet.addOtbasy(wallet.takeSavings(inputs.otbasy.seedFromSale))
      seeded = true
    }

    if (!owned && buyNow(inputs, housing, plan, month.index, wallet, target)) {
      const price = apartmentPriceAt(inputs, month.index)
      // Timing is not enough — the down payment has to be real money. borrow-min
      // always affords it (it puts down whatever there is); the others wait. A bank
      // also would not issue a loan whose annuity the borrower cannot service —
      // canAffordPayment defers the purchase until an indexed raise closes the gap,
      // same as affordsPurchase does for the down payment.
      if (
        affordsPurchase(inputs, plan, wallet, price) &&
        canAffordPayment(inputs, plan, wallet, price, rate, term, month.freeCash)
      ) {
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
        if (canBuyAt(housing, month.index)) {
          if (rentDueAt(housing, month.index)) {
            ;({ rentPaid, budget } = payRent(inputs, wallet, month, budget))
          }
          wallet.addOtbasy(budget)
          budget = 0
        }
      } else if (rentDueAt(housing, month.index)) {
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
        payment = {
          paid: payment.paid + extra,
          interest: payment.interest,
          principal: payment.principal + extra,
        }
        if (loan.balance === 0 && debtFreeMonth === null) debtFreeMonth = month.index
      } else {
        // lump and never both bank the surplus at the deposit rate instead of
        // prepaying — worth it only while the loan rate is below the deposit
        // rate, which is the arbitrage the Otbasy strategy is built on.
        wallet.addSavings(budget)
        budget = 0
        // lump then closes the loan in one hit once withdrawable savings cover
        // the balance; never leaves it to amortize over its full term, keeping
        // the cash working in the deposit the whole way. Gated on what is
        // actually withdrawable, not the deposit's true value: closing with
        // money still mid-term would forfeit this term's interest and come up
        // short of the loan balance.
        if (plan.repay === 'lump' && wallet.savingsWithdrawable >= loan.balance) {
          const settled = loan.prepay(wallet.takeSavings(loan.balance))
          payment = {
            paid: payment.paid + settled,
            interest: payment.interest,
            principal: payment.principal + settled,
          }
          debtFreeMonth = month.index
        } else if (loan.balance === 0 && debtFreeMonth === null) {
          // never: the scheduled annuity paid the loan off on its final term
          // month — no lump payoff, but it is debt-free from here.
          debtFreeMonth = month.index
        }
      }
    }

    wallet.addSavings(budget)
    rows.push(buildRow({ inputs, housing, month, wallet, owned, loan, rentPaid, payment }))
  }

  return {
    id: plan.id,
    name: plan.name,
    rows,
    purchaseMonth,
    debtFreeMonth,
    purchasePrice: purchasePriceAt(inputs, purchaseMonth),
    totals: summarize(rows),
    targetLoan: target,
  }
}

// The month a purchase may happen, per the plan's trigger.
function buyNow(
  inputs: Inputs,
  housing: HousingInputs,
  plan: PurchasePlan,
  monthIndex: number,
  wallet: Wallet,
  target: number,
): boolean {
  switch (plan.buyWhen) {
    case 'asap':
      return canBuyAt(housing, monthIndex)
    case 'after-months':
      return monthIndex >= (plan.saveMonths ?? 0) && canBuyAt(housing, monthIndex)
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
    const principal = plannedPrincipal(inputs, plan, wallet, price)
    wallet.takeSavings(price - principal)
    return createLoan(principal, rate, term)
  }

  // borrow max: a fixed principal, contribute the rest. The loan absorbs
  // whatever the deposits actually hand back — not what affordsPurchase assumed
  // — so a shortfall here (there should not be one, now that affordsPurchase
  // checks withdrawable money) becomes a bigger loan instead of vanishing.
  const contribution = Math.max(0, price - plannedPrincipal(inputs, plan, wallet, price))
  const fromOtbasy =
    plan.loan === 'otbasy'
      ? wallet.takeOtbasy(Math.min(contribution, wallet.otbasyWithdrawable))
      : 0
  const fromSavings = wallet.takeSavings(contribution - fromOtbasy)
  return createLoan(Math.max(0, price - fromOtbasy - fromSavings), rate, term)
}

// The most the contract allows to be borrowed: a simple mortgage requires its own
// minimum down payment, Otbasy lets you borrow the whole declared target. Only
// called when plan.loan !== 'none', so the lookup never sees the cash sentinel.
function maxLoan(inputs: Inputs, plan: PurchasePlan): number {
  const target = targetLoan(inputs, effectiveHousing(inputs, plan.situation, plan.saleMonthOffset))
  if (plan.loan === 'otbasy') return target
  return target - loanProduct(inputs, plan.loan).downPaymentFraction * target
}

// The principal this purchase would open, without touching the wallet — shared by
// the solvency check (which must know the payment before committing to the loan)
// and buy() (which then actually moves the money). borrow-min puts down whatever
// savings can cover — withdrawable savings: money still mid-term is not there to
// put down without forfeiting it, and buy() never re-checks what it actually got,
// so counting it here would silently underfund the purchase. borrow-max is the
// fixed maxLoan regardless of what is on hand (affordsPurchase already gated the
// down payment).
function plannedPrincipal(
  inputs: Inputs,
  plan: PurchasePlan,
  wallet: Wallet,
  price: number,
): number {
  if (plan.borrow === 'min') {
    return Math.max(0, price - Math.min(wallet.savingsWithdrawable, price))
  }
  return maxLoan(inputs, plan)
}

// A bank checks the annuity against the borrower's income before it checks
// anything else about the down payment. Cash purchases have no annuity and are
// gated by affordsPurchase alone.
function canAffordPayment(
  inputs: Inputs,
  plan: PurchasePlan,
  wallet: Wallet,
  price: number,
  rate: number,
  term: number,
  freeCash: number,
): boolean {
  if (plan.loan === 'none') return true
  const principal = plannedPrincipal(inputs, plan, wallet, price)
  return principal <= 0 || annuityPayment(principal, rate, term) <= freeCash
}

// Whether a borrow-max / all-cash plan can afford its down payment yet. borrow-min
// is always affordable (it takes whatever is there), so it is not gated here.
// Checked against what is actually withdrawable, not the deposit's true value:
// money still mid-term is only real if you are willing to forfeit it, and this
// gate exists precisely to decide that the purchase is funded, not almost funded.
function affordsPurchase(
  inputs: Inputs,
  plan: PurchasePlan,
  wallet: Wallet,
  price: number,
): boolean {
  if (plan.borrow === 'min' && plan.loan !== 'none') return true
  const principal = plan.loan === 'none' ? 0 : maxLoan(inputs, plan)
  const contribution = Math.max(0, price - principal)
  return wallet.otbasyWithdrawable + wallet.savingsWithdrawable >= contribution
}
