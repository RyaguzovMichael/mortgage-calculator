import { createDeposit, type Deposit } from './deposit'
import { createOtbasyAccount, type OtbasyAccount } from './otbasyAccount'
import {
  otbasyAccount as otbasyAccountInput,
  savingsAccounts,
  targetLoan,
  type Inputs,
} from './types/inputs'
import type { YearMonth } from './types/yearMonth'

// Everything a variant owns in cash, and the month-step bookkeeping all four
// variants share: accrue every account, credit the Otbasy bonus, gate locked
// accounts. Each existing account keeps its own rate for life; new money lands
// in fresh deposits — the model never silently re-rates an old account.
export interface Wallet {
  readonly savingsBalance: number
  readonly saleProceedsBalance: number
  readonly otbasyBalance: number
  readonly otbasyCc: number
  readonly otbasy: OtbasyAccount

  accrue(yearMonth: YearMonth): Accrual
  addSavings(amount: number): void
  addSaleProceeds(amount: number): void
  addOtbasy(amount: number): void
  unlockedSavings(monthIndex: number): number
  takeSavings(amount: number, monthIndex: number): number
  takeOtbasy(amount: number): number
}

export interface Accrual {
  // Only interest actually credited — a deposit mid-period contributes nothing,
  // because that money is still forfeitable.
  readonly interest: number
  readonly govBonus: number
}

interface Pocket {
  readonly deposit: Deposit
  readonly unlockMonthOffset: number
}

export function createWallet(inputs: Inputs): Wallet {
  const saleProceeds = createDeposit(
    0,
    inputs.sale.depositAnnualRate,
    inputs.sale.depositPayoutPeriodMonths,
  )
  const contributions = createDeposit(
    0,
    inputs.deposits.newDepositAnnualRate,
    inputs.deposits.newDepositPayoutPeriodMonths,
  )

  const pockets: Pocket[] = [
    ...savingsAccounts(inputs).map((account) => ({
      deposit: createDeposit(account.balance, account.annualRate, account.payoutPeriodMonths),
      unlockMonthOffset: account.unlockMonthOffset,
    })),
    { deposit: contributions, unlockMonthOffset: 0 },
    { deposit: saleProceeds, unlockMonthOffset: 0 },
  ]

  const existingOtbasy = otbasyAccountInput(inputs)
  const otbasy = createOtbasyAccount(
    existingOtbasy?.balance ?? 0,
    existingOtbasy?.annualRate ?? 0,
    inputs.otbasy,
    targetLoan(inputs),
    existingOtbasy?.payoutPeriodMonths ?? 1,
  )

  function unlocked(monthIndex: number): Pocket[] {
    return pockets.filter((pocket) => monthIndex >= pocket.unlockMonthOffset)
  }

  return {
    get savingsBalance() {
      return pockets.reduce((sum, pocket) => sum + pocket.deposit.balance, 0)
    },
    get saleProceedsBalance() {
      return saleProceeds.balance
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
      const interest = pockets.reduce((sum, pocket) => sum + pocket.deposit.accrue(), 0)
      return {
        interest: interest + otbasy.accrue(),
        govBonus: otbasy.applyGovBonus(yearMonth),
      }
    },

    addSavings(amount: number) {
      contributions.add(amount)
    },

    addSaleProceeds(amount: number) {
      saleProceeds.add(amount)
    },

    addOtbasy(amount: number) {
      otbasy.add(amount)
    },

    unlockedSavings(monthIndex: number) {
      return unlocked(monthIndex).reduce((sum, pocket) => sum + pocket.deposit.balance, 0)
    },

    takeSavings(amount: number, monthIndex: number) {
      // Drain the worst-earning money first so the best-paying deposit keeps
      // working. Note this ignores forfeitable pending interest: optimizing the
      // withdrawal against the payout cycle is a decision for the variant, which
      // controls *when* it buys, not for the wallet.
      const available = unlocked(monthIndex).sort(
        (left, right) => left.deposit.annualRate - right.deposit.annualRate,
      )
      let remaining = amount
      for (const pocket of available) {
        if (remaining <= 0) break
        remaining -= pocket.deposit.take(remaining)
      }
      return amount - remaining
    },

    takeOtbasy(amount: number) {
      return otbasy.take(amount)
    },
  }
}
