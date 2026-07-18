import { annualGrowthFactor } from '../money'
import type { PurchasePlan } from './plan'
import type { YearMonth } from './yearMonth'

// Every parameter of the model. See MODEL.md for what each one means and which
// real-world fact it encodes. All rates are nominal annual, applied monthly.
export interface Inputs {
  readonly start: YearMonth
  readonly horizonMonths: number
  readonly apartment: ApartmentInputs
  readonly existingApartment: ExistingApartmentInputs
  readonly cashflow: CashflowInputs
  readonly deposits: DepositInputs
  readonly otbasy: OtbasyInputs
  readonly plans: PlansInputs
  readonly loans: LoanInputs
  // A hand-set override for any plan whose buyWhen is after-months with
  // saveMonths left null — otherwise that combination chains to Otbasy's
  // purchase month, so the two are compared over the same window.
  readonly delayedSavingMonths: number | null
}

// The user's own plans plus which plans go on the board. Built-in plan
// definitions are NOT here — they live in data/plans.yml and are read-only; only
// these two, the user's own creations and their board choices, are persisted.
export interface PlansInputs {
  // Mutable for the same reason the deposit catalogue is: the panel does CRUD on
  // it. The engine only ever reads it.
  custom: PurchasePlan[]
  // Ids of the plans shown on the board, built-in and custom alike. A preference,
  // so it is stored rather than derived — which plans to compare is exactly what
  // the human is choosing. Capped at eight by the UI (one per palette slot).
  shown: string[]
}

export interface ApartmentInputs {
  readonly price: number
  readonly annualGrowthRate: number
}

// The flat you already own and will sell to help fund the purchase — a global
// start condition, not a per-plan setting. Distinct from `apartment`, which is
// the flat you buy. `owned` is the existence toggle: when false, `price` is
// ignored and no plan that requires an existing apartment (a 'selling' plan) can
// run. *When* it sells is a plan decision (PurchasePlan.saleMonthOffset) — the
// existence and today's value are facts about you; the timing is strategy.
export interface ExistingApartmentInputs {
  readonly owned: boolean
  // What the flat is worth *today*. Grows with the target apartment's growth rate
  // up to the month the plan sells it (saleProceedsAt).
  readonly price: number
}

// Where a plan's owner lives until they buy, and whether they pay rent meanwhile.
// A per-plan decision (types/plan.ts, PurchasePlan.situation), and also this
// plan's requirement on the existing-apartment start condition — see
// planNeedsExistingApartment.
//   selling  — sell the flat you own; proceeds land, and you rent from the sale
//              month. Requires the existing-apartment start condition.
//   free     — no flat to sell, but you live somewhere rent-free until you buy
//   renting  — no flat to sell, and you rent from month 0
export type HousingSituation = 'selling' | 'free' | 'renting'

// The effective housing a plan runs against: its situation combined with the
// money the global existing-apartment start condition contributes. Derived, not
// stored — it reconstitutes the shape the engine's month loop and its helpers
// (proceedsToday, saleMonth, rentDueAt, …) have always consumed, so those keep
// their bodies and signatures.
export interface HousingInputs {
  readonly situation: HousingSituation
  readonly saleProceeds: number
  readonly saleMonthOffset: number
}

// proceeds are non-zero only for a 'selling' plan that actually has an owned flat
// to sell. The board disables the incompatible pairing (a 'selling' plan with no
// owned apartment), but gate here too so a stray run cannot invent proceeds from
// a flat that does not exist. saleMonthOffset comes from the plan — only 'selling'
// plans read it downstream.
export function effectiveHousing(
  inputs: Inputs,
  situation: HousingSituation,
  saleMonthOffset: number,
): HousingInputs {
  const sells = situation === 'selling' && inputs.existingApartment.owned
  return {
    situation,
    saleProceeds: sells ? inputs.existingApartment.price : 0,
    saleMonthOffset,
  }
}

// A 'selling' plan needs an existing apartment to sell; 'free'/'renting' assume
// none. This is the plan's requirement on the start condition.
export function planNeedsExistingApartment(plan: { situation: HousingSituation }): boolean {
  return plan.situation === 'selling'
}

// Whether a plan can run against the current start condition: a selling plan
// needs an owned flat, the others need none. The board shows a mismatch disabled
// rather than running it against the wrong world.
export function planMatchesStart(inputs: Inputs, plan: { situation: HousingSituation }): boolean {
  return planNeedsExistingApartment(plan) === inputs.existingApartment.owned
}

export interface CashflowInputs {
  // The money directed at housing each month is not entered directly: the user
  // gives a gross salary and the share of it they are willing to spend, and the
  // free cash is their product (see freeCashAt). Two numbers because that is how
  // the user thinks about it — "I earn X, I can put Y% of it toward the flat".
  readonly monthlySalary: number
  // Fraction 0–1 of the salary that goes to rent/loan/savings.
  readonly mortgageShare: number
  readonly monthlyRent: number
  // Indexation of the income only, applied as one step once a year in raiseMonth.
  // Rent has no rate of its own — it rides the apartment growth rate, because it
  // is a price in the same market. Income is not: it tracks wages, and pinning it
  // to property growth would be an assumption, not a fact.
  readonly annualIndexationRate: number
  // The calendar month (1–12) the yearly raise lands in. A parameter, not a
  // constant, because raise schedules differ from person to person.
  readonly raiseMonth: number
}

// A deposit you can put money into. `payoutPeriodMonths` is the load-bearing
// field, not the rate: interest does not join the balance until it is paid out,
// and any withdrawal burns the whole period accrued so far. So 1 means "withdraw
// whenever, lose nothing" and needs no separate flag.
export interface DepositProduct {
  readonly id: string
  // Just the name — «Kaspi Депозит». The rate is not baked into the string, so
  // the two cannot drift apart. Rendered by describeProduct() in app/format.ts.
  readonly name: string
  readonly annualRate: number
  readonly payoutPeriodMonths: number
}

// Every variant empties the existing accounts into one deposit in month 0, and
// everything afterwards — the sale money, each month's savings — lands in that
// same deposit. So the model needs one product, not one per source of money.
export interface DepositInputs {
  // Everything that is not on the Otbasy account, as one number. Itemising it
  // would be decoration: month 0 pours the lot into a single deposit, so only the
  // total was ever reaching the model.
  readonly savingsBalance: number
  // The one mutable array in Inputs: the panel adds and removes deposits, and CRUD
  // on a `readonly T[]` does not compile. Reaching for Object.assign to get around
  // it would be a hidden cast in the very type that documents the engine's
  // contract. The engine only ever reads this.
  products: DepositProduct[]
  // Which deposit the money goes into is no longer here — it is a per-plan
  // decision (PurchasePlan.savingsProductId), so two plans can compare different
  // deposits. This catalogue is the shared pool they pick from.
}

// A simple annuity mortgage — the same shape Halyk has, minus the state-programme
// machinery Otbasy needs (its own account, CC gates, government bonus). Halyk
// itself is just the built-in entry in this list; a user can add their own.
export interface LoanProduct {
  readonly id: string
  // Just the name — «Halyk». Rendered by loanProductTerms() in app/useFormat.ts,
  // same split as DepositProduct.
  readonly name: string
  readonly annualRate: number
  readonly downPaymentFraction: number
  readonly maxTermMonths: number
}

export interface LoanInputs {
  // Mutable for the same reason the deposit catalogue is: the panel does CRUD on
  // it. The engine only ever reads it.
  products: LoanProduct[]
}

export interface OtbasyInputs {
  // Whether an Otbasy account exists today. When false the three fields below are
  // ignored and the Otbasy variant opens its contract from nothing.
  readonly hasDeposit: boolean
  readonly balance: number
  // Interest the bank has already credited over the account's life. It is what CC
  // is built from, so starting the model at zero pretends years of saving never
  // happened and puts the CC gate further away than it really is.
  //
  // Already part of `balance` — the bank credited it to the account. It feeds the
  // CC numerator only; adding it to the money would count it twice.
  readonly accruedInterest: number
  // How long the account has been running. Recorded for the Otbasy rules we have
  // not modelled yet (the minimum saving term); nothing reads it today, and the
  // panel says so rather than implying it moves a number.
  readonly monthsOpen: number
  readonly loanAnnualRate: number
  // Otbasy's own maximum term. Separate from Halyk's: they are two different
  // contracts that only happen to both be 240 today. Editing Halyk's term must not
  // silently re-term the Otbasy loan.
  readonly maxTermMonths: number
  // The Otbasy deposit's own rate — a property of the state programme, not
  // something you pick, which is why it is a plain field and not a catalogue
  // reference like the savings deposit.
  readonly depositAnnualRate: number
  readonly minBalanceFraction: number
  readonly ccTarget: number
  readonly govBonusRate: number
  readonly govBonusCap: number
  readonly govBonusMonth: number
  readonly seedFromSale: number
}

// Today's value of the flat you will sell — zero unless you are selling.
export function proceedsToday(housing: HousingInputs): number {
  return housing.situation === 'selling' ? housing.saleProceeds : 0
}

// The month the sale lands, or null when there is no sale.
export function saleMonth(housing: HousingInputs): number | null {
  return housing.situation === 'selling' ? housing.saleMonthOffset : null
}

// The earliest month a purchase can happen. Selling waits for the sale — you need
// the proceeds and you have to move — while the others can buy from month 0.
export function purchaseAllowedFrom(housing: HousingInputs): number {
  return housing.situation === 'selling' ? housing.saleMonthOffset : 0
}

// Is rent due this month, before you own? Selling rents from the sale; renting
// rents throughout; free never rents.
export function rentDueAt(housing: HousingInputs, monthIndex: number): boolean {
  switch (housing.situation) {
    case 'selling':
      return monthIndex >= housing.saleMonthOffset
    case 'renting':
      return true
    case 'free':
      return false
  }
}

// The loan size declared when signing the Otbasy contract. Frozen at that
// number: the 50%-balance and CC tests measure against it, not against the
// shrinking live gap between price and savings.
export function targetLoan(inputs: Inputs, housing: HousingInputs): number {
  return Math.max(0, inputs.apartment.price - proceedsToday(housing))
}

// These three are the real-world rates, so they use annualGrowthFactor rather
// than the banks' monthly compounding — see money.ts.
export function apartmentPriceAt(inputs: Inputs, monthIndex: number): number {
  return inputs.apartment.price * annualGrowthFactor(inputs.apartment.annualGrowthRate, monthIndex)
}

// Rent follows the apartment: it is rent *for this kind of flat*, so a market
// where flats gain 24% a year is not one where rent holds at 400k. Tying the two
// together is what stops the saving variants from being flattered by a frozen
// rent while the thing they are saving for runs away.
// The flat being sold is in the same market as the one being bought, so it
// appreciates at the same rate right up to the month it is sold. Zero when there
// is nothing to sell.
export function saleProceedsAt(inputs: Inputs, housing: HousingInputs, monthIndex: number): number {
  return proceedsToday(housing) * annualGrowthFactor(inputs.apartment.annualGrowthRate, monthIndex)
}

export function rentAt(inputs: Inputs, monthIndex: number): number {
  return (
    inputs.cashflow.monthlyRent * annualGrowthFactor(inputs.apartment.annualGrowthRate, monthIndex)
  )
}

// Income steps, it does not drift: the raise lands once a year in raiseMonth. So
// this one is not annualGrowthFactor either — it counts whole raises, and between
// two raises the income is flat. The free cash is salary × share; income flows
// from month 0 (there is no start-offset gate anymore).
export function freeCashAt(inputs: Inputs, monthIndex: number): number {
  return (
    inputs.cashflow.monthlySalary *
    inputs.cashflow.mortgageShare *
    (1 + inputs.cashflow.annualIndexationRate) **
      raisesBy(inputs.start, inputs.cashflow.raiseMonth, monthIndex)
  )
}

// A raiseMonth in the starting month itself is not a raise: today's income
// already reflects it. The first raise is therefore always the *next* raiseMonth.
function raisesBy(start: YearMonth, raiseMonth: number, monthIndex: number): number {
  const monthsToFirstRaise = (raiseMonth - start.month + 12) % 12 || 12
  if (monthIndex < monthsToFirstRaise) return 0
  return Math.floor((monthIndex - monthsToFirstRaise) / 12) + 1
}

// Everything you hold today. Month 0 pours the lot into one deposit — the chosen
// one, or the Otbasy account in the Otbasy variant.
export function startingMoney(inputs: Inputs): number {
  return inputs.deposits.savingsBalance + otbasyBalance(inputs)
}

// The toggle is the only thing that decides whether the Otbasy figures count, so
// nothing downstream has to remember to check it.
export function otbasyBalance(inputs: Inputs): number {
  return inputs.otbasy.hasDeposit ? inputs.otbasy.balance : 0
}

export function otbasyAccruedInterest(inputs: Inputs): number {
  return inputs.otbasy.hasDeposit ? inputs.otbasy.accruedInterest : 0
}

export function findProduct(inputs: Inputs, id: string): DepositProduct | undefined {
  return inputs.deposits.products.find((product) => product.id === id)
}

// Resolves a plan's chosen deposit by id. loadInputs repairs an id that no longer
// resolves and the panel gives no way to unselect one, so this cannot fail on data
// the app produces. It throws rather than substituting a default, because inventing
// a rate in a model whose whole job is comparing rates is worse than stopping.
export function savingsProduct(inputs: Inputs, productId: string): DepositProduct {
  const product = findProduct(inputs, productId)
  if (!product) {
    throw new Error(`Вклад «${productId}» не найден в каталоге`)
  }
  return product
}

export function findLoanProduct(inputs: Inputs, id: string): LoanProduct | undefined {
  return inputs.loans.products.find((product) => product.id === id)
}

// Total over a plan's own loan id: canRemoveLoanProduct refuses to delete a
// credit any plan still references, so this cannot fail on data the app
// produces. Throws rather than substituting a default, same reasoning as
// savingsProduct — inventing a rate here is worse than stopping.
export function loanProduct(inputs: Inputs, id: string): LoanProduct {
  const product = findLoanProduct(inputs, id)
  if (!product) {
    throw new Error(`Кредит «${id}» не найден в каталоге`)
  }
  return product
}
