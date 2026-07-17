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
  it('holds interest pending and credits nothing until the payout month', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    for (let month = 0; month < 5; month++) {
      expect(deposit.accrue()).toBe(0)
    }
    expect(deposit.balance).toBe(1_000_000)
    expect(deposit.pendingInterest).toBeCloseTo(5 * 1_000_000 * (0.184 / 12), 6)
  })

  it('credits the whole period at the payout month', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    let credited = 0
    for (let month = 0; month < 6; month++) {
      credited = deposit.accrue()
    }
    expect(credited).toBeCloseTo(6 * 1_000_000 * (0.184 / 12), 6)
    expect(deposit.balance).toBeCloseTo(1_000_000 + credited, 6)
    expect(deposit.pendingInterest).toBe(0)
  })

  it('does not compound within a period, but does across periods', () => {
    const deposit = createDeposit(1_000_000, 0.12, 6)
    for (let month = 0; month < 12; month++) deposit.accrue()
    // Two periods of simple 6% on the balance at the start of each period.
    expect(deposit.balance).toBeCloseTo(1_000_000 * 1.06 * 1.06, 4)
  })

  it('burns the pending interest when touched early', () => {
    const deposit = createDeposit(1_000_000, 0.184, 6)
    for (let month = 0; month < 5; month++) deposit.accrue()
    expect(deposit.pendingInterest).toBeGreaterThan(0)

    deposit.take(1)
    expect(deposit.pendingInterest).toBe(0)
    expect(deposit.totalInterest).toBe(0)
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
