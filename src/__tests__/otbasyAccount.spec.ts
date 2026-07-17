import { describe, it, expect } from 'vitest'
import { calculateCc, createOtbasyAccount } from '@/engine/otbasyAccount'
import type { OtbasyInputs } from '@/engine/types/inputs'

const OTBASY: OtbasyInputs = {
  loanAnnualRate: 0.085,
  depositAnnualRate: 0.02,
  minBalanceFraction: 0.5,
  ccTarget: 5,
  govBonusRate: 0.2,
  govBonusCap: 865_000,
  govBonusMonth: 2,
  seedFromSale: 5_000_000,
}

describe('calculateCc', () => {
  it('is accumulated interest over the target loan, times 1000', () => {
    expect(calculateCc(50_000, 10_000_000)).toBeCloseTo(5, 10)
  })

  it('is zero before any interest accrues', () => {
    expect(calculateCc(0, 10_000_000)).toBe(0)
  })
})

describe('createOtbasyAccount', () => {
  it('reports CC from the bank interest it has accrued', () => {
    const account = createOtbasyAccount(5_000_000, 0.02, OTBASY, 10_000_000)
    const interest = account.accrue()
    expect(account.cc).toBeCloseTo(calculateCc(interest, 10_000_000), 10)
  })

  it('credits the government bonus only in the bonus month', () => {
    const account = createOtbasyAccount(0, 0.02, OTBASY, 10_000_000)
    account.add(500_000)
    expect(account.applyGovBonus({ year: 2027, month: 1 })).toBe(0)
    expect(account.applyGovBonus({ year: 2027, month: 2 })).toBeCloseTo(100_000, 6)
    expect(account.balance).toBeCloseTo(600_000, 6)
  })

  it('caps the bonus base at the yearly cap', () => {
    const account = createOtbasyAccount(0, 0.02, OTBASY, 10_000_000)
    account.add(2_000_000) // well over the 865,000 cap
    const bonus = account.applyGovBonus({ year: 2027, month: 2 })
    expect(bonus).toBeCloseTo(865_000 * 0.2, 6)
  })

  it('resets the yearly contribution base after paying the bonus', () => {
    const account = createOtbasyAccount(0, 0.02, OTBASY, 10_000_000)
    account.add(500_000)
    account.applyGovBonus({ year: 2027, month: 2 })
    expect(account.contributionsThisYear).toBe(0)
    expect(account.applyGovBonus({ year: 2028, month: 2 })).toBe(0)
  })

  // This is what makes the Otbasy gate slow: the bonus inflates the balance but
  // never CC, so the 50% and CC tests move at very different speeds.
  it('excludes the government bonus from CC', () => {
    const account = createOtbasyAccount(0, 0.02, OTBASY, 10_000_000)
    account.add(500_000)
    account.applyGovBonus({ year: 2027, month: 2 })
    expect(account.cc).toBe(0)
  })
})
