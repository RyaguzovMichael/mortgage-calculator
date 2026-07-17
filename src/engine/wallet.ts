import { createDeposit } from './deposit'
import { createOtbasyAccount, type OtbasyAccount } from './otbasyAccount'
import {
  otbasyAccruedInterest,
  savingsProduct,
  startingMoney,
  targetLoan,
  type Inputs,
} from './types/inputs'
import type { YearMonth } from './types/yearMonth'

// Everything a variant owns in cash, and the month-step bookkeeping all four
// variants share.
//
// There are exactly two places money can be: one savings deposit and, for the
// Otbasy variant, the Otbasy account. Today's accounts are emptied into one of
// them in month 0 and cease to exist; the sale money and every month's savings
// land in the same deposit afterwards. Splitting by where money came from would
// only invent rate differences the bank does not offer.
export interface Wallet {
  readonly savingsBalance: number
  readonly otbasyBalance: number
  readonly otbasyCc: number
  readonly otbasy: OtbasyAccount

  accrue(yearMonth: YearMonth): Accrual
  addSavings(amount: number): void
  addOtbasy(amount: number): void
  takeSavings(amount: number): number
  takeOtbasy(amount: number): number
}

export interface Accrual {
  // Only interest actually credited — a deposit mid-period contributes nothing,
  // because that money is still forfeitable.
  readonly interest: number
  readonly govBonus: number
}

export interface WalletOptions {
  // Where today's accounts get poured in month 0. The Otbasy variant starts its
  // contract balance as high as it can, because that is what opens the 50% gate.
  // Every other variant has no use for an Otbasy account at all: without the loan
  // its 2% is simply the worst rate on offer, and the state bonus does not close
  // a 16-point gap.
  readonly useOtbasy: boolean
}

export function createWallet(inputs: Inputs, options: WalletOptions = { useOtbasy: true }): Wallet {
  const product = savingsProduct(inputs)
  const money = startingMoney(inputs)

  const savings = createDeposit(
    options.useOtbasy ? 0 : money,
    product.annualRate,
    product.payoutPeriodMonths,
  )

  // Only the Otbasy variant inherits the head start on CC: the others close the
  // account in month 0, and a CC on an account holding nothing would be noise.
  const otbasy = createOtbasyAccount(
    options.useOtbasy ? money : 0,
    options.useOtbasy ? otbasyAccruedInterest(inputs) : 0,
    inputs.otbasy,
    targetLoan(inputs),
  )

  return {
    get savingsBalance() {
      return savings.balance
    },
    get otbasyBalance() {
      return otbasy.balance
    },
    get otbasyCc() {
      return otbasy.cc
    },
    get otbasy() {
      return otbasy
    },

    accrue(yearMonth: YearMonth) {
      return {
        interest: savings.accrue() + otbasy.accrue(),
        govBonus: otbasy.applyGovBonus(yearMonth),
      }
    },

    addSavings(amount: number) {
      savings.add(amount)
    },

    addOtbasy(amount: number) {
      otbasy.add(amount)
    },

    takeSavings(amount: number) {
      return savings.take(amount)
    },

    takeOtbasy(amount: number) {
      return otbasy.take(amount)
    },
  }
}
