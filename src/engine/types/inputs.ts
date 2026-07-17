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
  readonly accounts: readonly DepositAccountInputs[]
  readonly savingsAnnualRate: number
  // Months between interest payouts; 1 is plain monthly capitalization. Kaspi's
  // 18.4% pays every 6 months and forfeits everything accrued since the last
  // payout if you withdraw early, so this drives when it is cheap to buy.
  readonly savingsPayoutPeriodMonths: number
}

// Only the balance is modelled. The accounts are itemised to show where today's
// money actually sits, but since they are all closed in month 0 their own rates
// and lock-up dates never get a chance to matter.
export interface DepositAccountInputs {
  readonly id: string
  readonly label: string
  readonly balance: number
}

export interface HalykInputs {
  readonly annualRate: number
  readonly downPaymentFraction: number
  readonly maxTermMonths: number
}

export interface OtbasyInputs {
  readonly loanAnnualRate: number
  // The Otbasy deposit's own rate. It lives here rather than on an account,
  // because the accounts are only balances now — and this rate is a property of
  // the Otbasy product, not of today's cash.
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

// What today's accounts hold between them — the one figure the model takes from
// them, since month 0 pours the lot into a single deposit.
export function existingBalance(inputs: Inputs): number {
  return inputs.deposits.accounts.reduce((sum, account) => sum + account.balance, 0)
}
