import { describe, it, expect } from 'vitest'
import { createDeposit } from '@/engine/deposit'

describe('createDeposit', () => {
  it('accrues one month of interest at the nominal annual rate / 12', () => {
    const deposit = createDeposit(1_000_000, 0.184)
    const interest = deposit.accrue()
    expect(interest).toBeCloseTo(1_000_000 * (0.184 / 12), 6)
    expect(deposit.balance).toBeCloseTo(1_000_000 + interest, 6)
  })

  it('compounds monthly', () => {
    const deposit = createDeposit(1_000_000, 0.12)
    deposit.accrue()
    deposit.accrue()
    expect(deposit.balance).toBeCloseTo(1_000_000 * 1.01 ** 2, 6)
  })

  it('tracks total interest across accruals', () => {
    const deposit = createDeposit(1_000_000, 0.12)
    const first = deposit.accrue()
    const second = deposit.accrue()
    expect(deposit.totalInterest).toBeCloseTo(first + second, 6)
  })

  it('adds contributions without accruing them the same call', () => {
    const deposit = createDeposit(100_000, 0.12)
    deposit.add(50_000)
    expect(deposit.balance).toBe(150_000)
    expect(deposit.totalInterest).toBe(0)
  })

  it('takes at most the balance', () => {
    const deposit = createDeposit(100_000, 0.12)
    expect(deposit.take(30_000)).toBe(30_000)
    expect(deposit.balance).toBe(70_000)
    expect(deposit.take(999_999)).toBe(70_000)
    expect(deposit.balance).toBe(0)
  })
})

// Kaspi's 18.4% pays every 6 months and burns everything accrued since the last
// payout if you touch it early. This is what makes the purchase month expensive
// or cheap depending on where it lands in the cycle.
describe('createDeposit with a 6-month payout period', () => {
  it('grows the balance every month even though nothing pays out yet', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    for (let month = 0; month < 5; month++) {
      // accrue()'s return value is what got PAID OUT this month — zero until the
      // term ends — not what the balance is worth.
      expect(deposit.accrue()).toBe(0)
    }
    // But the statement value moves every month: monthly capitalization applies
    // to the principal plus interest pending so far, not to the original
    // 1,000,000 five times over.
    const monthly = 0.184 / 12
    const expectedPending = 1_000_000 * ((1 + monthly) ** 5 - 1)
    expect(deposit.pendingInterest).toBeCloseTo(expectedPending, 6)
    expect(deposit.balance).toBeCloseTo(1_000_000 + expectedPending, 6)
  })

  it('credits the whole period at the payout month', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    let credited = 0
    for (let month = 0; month < 6; month++) {
      credited = deposit.accrue()
    }
    const monthly = 0.184 / 12
    expect(credited).toBeCloseTo(1_000_000 * ((1 + monthly) ** 6 - 1), 6)
    expect(deposit.balance).toBeCloseTo(1_000_000 + credited, 6)
    expect(deposit.pendingInterest).toBe(0)
  })

  it('compounds every month within a period, and again across periods', () => {
    const deposit = createDeposit(1_000_000, 0.12, 6)
    for (let month = 0; month < 12; month++) deposit.accrue()
    // The bank quotes 12% nominal, monthly capitalization (1% a month), for
    // twelve months straight — the 6-month payout only decides when it becomes
    // withdrawable, not how it compounds.
    expect(deposit.balance).toBeCloseTo(1_000_000 * 1.01 ** 12, 4)
  })

  it('burns the pending interest when touched early', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    for (let month = 0; month < 5; month++) deposit.accrue()
    expect(deposit.pendingInterest).toBeGreaterThan(0)

    deposit.take(1)
    expect(deposit.pendingInterest).toBe(0)
    expect(deposit.totalInterest).toBe(0)
    // What the balance had grown to (the visible, monthly-compounding value) is
    // exactly what a withdrawal before the term ends forfeits — the balance
    // drops straight back to the vested principal, not to some smooth partial.
    expect(deposit.balance).toBe(1_000_000 - 1)
  })

  it('cannot withdraw more than the vested principal, even though the balance shows more', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    for (let month = 0; month < 5; month++) deposit.accrue()
    expect(deposit.balance).toBeGreaterThan(1_000_000)

    // Asking for the whole displayed balance still only returns the vested part
    // — the accrued-but-unpaid interest is not there to give.
    expect(deposit.take(deposit.balance)).toBeCloseTo(1_000_000, 6)
    expect(deposit.balance).toBe(0)
  })

  it('keeps interest already paid out — only the current period is at risk', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    for (let month = 0; month < 6; month++) deposit.accrue()
    const paidOut = deposit.totalInterest
    deposit.accrue()
    deposit.take(1)
    expect(deposit.totalInterest).toBe(paidOut)
  })

  it('reports the months left until the next payout', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    expect(deposit.monthsUntilPayout).toBe(6)
    deposit.accrue()
    expect(deposit.monthsUntilPayout).toBe(5)
  })
})
