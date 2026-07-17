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
