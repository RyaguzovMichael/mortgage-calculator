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
  readonly proceeds: number
  readonly monthOffset: number
  // Kept separate from `newDepositAnnualRate`: banks commonly cap the headline
  // rate above some amount, and this is by far the largest deposit in the model.
  readonly depositAnnualRate: number
  readonly depositPayoutPeriodMonths: number
}

export interface CashflowInputs {
  readonly monthlyFreeCash: number
  readonly monthlyRent: number
  readonly startMonthOffset: number
}

export interface DepositInputs {
  readonly accounts: readonly DepositAccountInputs[]
  readonly newDepositAnnualRate: number
  readonly newDepositPayoutPeriodMonths: number
}

export interface DepositAccountInputs {
  readonly id: string
  readonly label: string
  readonly balance: number
  readonly annualRate: number
  readonly unlockMonthOffset: number
  // Months between interest payouts; 1 is plain monthly capitalization. Kaspi's
  // 18.4% pays every 6 months and forfeits everything accrued since the last
  // payout if you withdraw early, so this drives when it is cheap to buy.
  readonly payoutPeriodMonths: number
  readonly kind: DepositKind
}

export type DepositKind = 'savings' | 'otbasy'

export interface HalykInputs {
  readonly annualRate: number
  readonly downPaymentFraction: number
  readonly maxTermMonths: number
}

// The deposit's own rate is not here: it lives on the `kind: 'otbasy'` account
// in `DepositInputs.accounts`, which is the single source of truth for it.
export interface OtbasyInputs {
  readonly loanAnnualRate: number
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

// The one rate in the model that is NOT a nominal annual rate compounded monthly.
// Banks quote nominal rates and capitalize monthly because that is what the
// contract says; a property-price statistic is already the year-over-year change,
// so it is spread geometrically across the year instead. Treating it like a bank
// rate would turn a quoted 24% into an effective 26.82% and quietly add 16M to
// the 2031 price.
export function apartmentPriceAt(inputs: Inputs, monthIndex: number): number {
  return inputs.apartment.price * (1 + inputs.apartment.annualGrowthRate) ** (monthIndex / 12)
}

export function otbasyAccount(inputs: Inputs): DepositAccountInputs | undefined {
  return inputs.deposits.accounts.find((account) => account.kind === 'otbasy')
}

export function savingsAccounts(inputs: Inputs): readonly DepositAccountInputs[] {
  return inputs.deposits.accounts.filter((account) => account.kind === 'savings')
}
