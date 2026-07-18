import { describe, it, expect } from 'vitest'
import { createLoan } from '@/engine/loan'
import { createWallet } from '@/engine/wallet'
import { payScheduled } from '@/engine/variants/shared'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { HousingInputs, Inputs } from '@/engine/types/inputs'

const HOUSING: HousingInputs = {
  situation: 'selling',
  saleProceeds: 35_000_000,
  saleMonthOffset: 3,
}

// An empty wallet we can seed to a known balance, so the sums are exact.
function emptyWallet() {
  const inputs: Inputs = {
    ...DEFAULT_INPUTS,
    deposits: { ...DEFAULT_INPUTS.deposits, savingsBalance: 0 },
    otbasy: { ...DEFAULT_INPUTS.otbasy, hasDeposit: false },
  }
  return createWallet(inputs, HOUSING, 'kaspi-deposit', { useOtbasy: false })
}

describe('payScheduled', () => {
  // The bug: when the loan is nearly closed, the scheduled payment is larger than
  // the stub of balance left. payScheduled topped savings up to the full scheduled
  // amount, the loan took only what closed it, and the surplus pulled from savings
  // was never returned — money vanished.
  it('returns to savings any top-up the loan did not need', () => {
    const wallet = emptyWallet()
    wallet.addSavings(100_000)

    const loan = createLoan(50_000, 0.24, 240)
    loan.prepay(49_800) // balance = 200, far below the ~260 scheduled payment

    const before = wallet.savingsBalance
    const { payment } = payScheduled(loan, wallet, 0) // no free cash this month
    const takenFromSavings = before - wallet.savingsBalance

    expect(loan.balance).toBe(0)
    expect(takenFromSavings).toBeCloseTo(payment.paid, 6)
  })

  it('spends free cash before touching savings', () => {
    const wallet = emptyWallet()
    wallet.addSavings(100_000)
    const loan = createLoan(12_000_000, 0.24, 240)

    const before = wallet.savingsBalance
    const { payment } = payScheduled(loan, wallet, loan.scheduledPayment)

    expect(before - wallet.savingsBalance).toBe(0) // budget covered it
    expect(payment.paid).toBeCloseTo(loan.scheduledPayment, 6)
  })
})
