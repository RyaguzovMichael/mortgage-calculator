import { describe, it, expect } from 'vitest'
import { calculateCc, createOtbasyAccount } from '@/engine/otbasyAccount'
import type { OtbasyInputs } from '@/engine/types/inputs'

const OTBASY: OtbasyInputs = {
  hasDeposit: true,
  balance: 0,
  accruedInterest: 0,
  monthsOpen: 0,
  loanAnnualRate: 0.085,
  maxTermMonths: 240,
  depositAnnualRate: 0.02,
  minBalanceFraction: 0.5,
  ccTarget: 5,
  govBonusRate: 0.2,
  govBonusCap: 865_000,
  govBonusMonth: 2,
  seedFromSale: 5_000_000,
}

// The account did not start life when the model did: the bank has been paying
// interest on it for months, and CC is built from exactly that. Starting at zero
// pretends the saving never happened and puts the gate further away than it is.
describe('interest earned before month 0', () => {
  it('counts toward CC from the very first month', () => {
    const account = createOtbasyAccount({ balance: 648_509.26, accruedInterest: 40_000 }, OTBASY, 10_000_000)
    expect(account.cc).toBeCloseTo(4, 6)
  })

  it('is already inside the balance, so it is not handed out twice', () => {
    const account = createOtbasyAccount({ balance: 648_509.26, accruedInterest: 40_000 }, OTBASY, 10_000_000)
    expect(account.balance).toBe(648_509.26)
  })

  it('adds to what the model accrues rather than being replaced by it', () => {
    const account = createOtbasyAccount({ balance: 600_000, accruedInterest: 40_000 }, OTBASY, 10_000_000)
    account.accrue()
    // 600 000 at 2%/12 = 1000 a month, on top of the 40 000 already there.
    expect(account.totalInterest).toBeCloseTo(41_000, 6)
    expect(account.cc).toBeCloseTo(4.1, 6)
  })

  it('leaves CC at zero for an account with no history', () => {
    expect(createOtbasyAccount({ balance: 648_509.26, accruedInterest: 0 }, OTBASY, 10_000_000).cc).toBe(0)
  })
})

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
    const account = createOtbasyAccount({ balance: 5_000_000, accruedInterest: 0 }, OTBASY, 10_000_000)
    account.accrue()
    // 5,000,000 at 2%/12 = 8,333.33 interest → CC = 8333.33 / 10,000,000 × 1000.
    // The reference is computed by hand, not by re-running the code under test.
    expect(account.cc).toBeCloseTo(0.833333, 6)
  })

  // Guards the shape from being confused again: a caller who swaps balance and
  // accruedInterest would get a wildly wrong CC, so this pins the mapping.
  it('takes balance and accruedInterest from their named fields, not by order', () => {
    const account = createOtbasyAccount(
      { balance: 1_000_000, accruedInterest: 50_000 },
      OTBASY,
      10_000_000,
    )
    expect(account.balance).toBe(1_000_000)
    expect(account.cc).toBeCloseTo(5, 6) // 50_000 / 10_000_000 × 1000
  })

  it('credits the government bonus only in the bonus month', () => {
    const account = createOtbasyAccount({ balance: 0, accruedInterest: 0 }, OTBASY, 10_000_000)
    account.add(500_000)
    expect(account.applyGovBonus({ year: 2027, month: 1 })).toBe(0)
    expect(account.applyGovBonus({ year: 2027, month: 2 })).toBeCloseTo(100_000, 6)
    expect(account.balance).toBeCloseTo(600_000, 6)
  })

  it('caps the bonus base at the yearly cap', () => {
    const account = createOtbasyAccount({ balance: 0, accruedInterest: 0 }, OTBASY, 10_000_000)
    account.add(2_000_000) // well over the 865,000 cap
    const bonus = account.applyGovBonus({ year: 2027, month: 2 })
    expect(bonus).toBeCloseTo(865_000 * 0.2, 6)
  })

  it('resets the yearly contribution base after paying the bonus', () => {
    const account = createOtbasyAccount({ balance: 0, accruedInterest: 0 }, OTBASY, 10_000_000)
    account.add(500_000)
    account.applyGovBonus({ year: 2027, month: 2 })
    expect(account.contributionsThisYear).toBe(0)
    expect(account.applyGovBonus({ year: 2028, month: 2 })).toBe(0)
  })

  // This is what makes the Otbasy gate slow: the bonus inflates the balance but
  // never CC, so the 50% and CC tests move at very different speeds.
  it('excludes the government bonus from CC', () => {
    const account = createOtbasyAccount({ balance: 0, accruedInterest: 0 }, OTBASY, 10_000_000)
    account.add(500_000)
    account.applyGovBonus({ year: 2027, month: 2 })
    expect(account.cc).toBe(0)
  })
})
