import { annualGrowthFactor } from '../money'
import type { YearMonth } from './yearMonth'

// Every parameter of the model. See MODEL.md for what each one means and which
// real-world fact it encodes. All rates are nominal annual, applied monthly.
export interface Inputs {
  readonly start: YearMonth
  readonly horizonMonths: number
  readonly apartment: ApartmentInputs
  readonly sale: SaleInputs
  readonly cashflow: CashflowInputs
  readonly deposits: DepositInputs
  readonly halyk: HalykInputs
  readonly otbasy: OtbasyInputs
  // null chains the delayed-Halyk savings window to Otbasy's purchase month, so
  // the two variants are compared over the same window.
  readonly halykDelayedSavingMonths: number | null
}

export interface ApartmentInputs {
  readonly price: number
  readonly annualGrowthRate: number
}

export interface SaleInputs {
  // What the current flat is worth *today*. It grows with the market until the
  // sale month — see saleProceedsAt.
  readonly proceeds: number
  readonly monthOffset: number
}

export interface CashflowInputs {
  readonly monthlyFreeCash: number
  readonly monthlyRent: number
  readonly startMonthOffset: number
  // Indexation of the income only, applied as one step every June. Rent has no
  // rate of its own — it rides the apartment growth rate, because it is a price
  // in the same market. Income is not: it tracks wages, and pinning it to
  // property growth would be an assumption, not a fact.
  readonly annualIndexationRate: number
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
  // Which deposit the money goes into, by id. Used to be a loose (rate, payout)
  // pair, which meant two deposits with the same numbers were the same deposit.
  readonly savingsProductId: string
}

export interface HalykInputs {
  readonly annualRate: number
  readonly downPaymentFraction: number
  readonly maxTermMonths: number
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

// The loan size declared when signing the Otbasy contract. Frozen at that
// number: the 50%-balance and CC tests measure against it, not against the
// shrinking live gap between price and savings.
export function targetLoan(inputs: Inputs): number {
  return Math.max(0, inputs.apartment.price - inputs.sale.proceeds)
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
// appreciates at the same rate right up to the month it is sold. `proceeds` is
// what it is worth today, not what it will fetch on the sale month.
export function saleProceedsAt(inputs: Inputs, monthIndex: number): number {
  return inputs.sale.proceeds * annualGrowthFactor(inputs.apartment.annualGrowthRate, monthIndex)
}

export function rentAt(inputs: Inputs, monthIndex: number): number {
  return (
    inputs.cashflow.monthlyRent * annualGrowthFactor(inputs.apartment.annualGrowthRate, monthIndex)
  )
}

// Income steps, it does not drift: the raise lands once a year in June. So this
// one is not annualGrowthFactor either — it counts whole raises, and between two
// Junes the income is flat.
export function freeCashAt(inputs: Inputs, monthIndex: number): number {
  if (monthIndex < inputs.cashflow.startMonthOffset) return 0
  return (
    inputs.cashflow.monthlyFreeCash *
    (1 + inputs.cashflow.annualIndexationRate) ** raisesBy(inputs.start, monthIndex)
  )
}

const RAISE_MONTH = 6

// A June in the starting month itself is not a raise: today's income already
// reflects it. The first raise is therefore always the *next* June.
function raisesBy(start: YearMonth, monthIndex: number): number {
  const monthsToFirstRaise = ((RAISE_MONTH - start.month + 12) % 12) || 12
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

// Total: loadInputs repairs an id that no longer resolves and the panel gives no
// way to unselect one, so this cannot fail on data the app produces. It throws
// rather than substituting a default, because inventing a rate in a model whose
// whole job is comparing rates is worse than stopping.
export function savingsProduct(inputs: Inputs): DepositProduct {
  const product = findProduct(inputs, inputs.deposits.savingsProductId)
  if (!product) {
    throw new Error(`Вклад «${inputs.deposits.savingsProductId}» не найден в каталоге`)
  }
  return product
}
