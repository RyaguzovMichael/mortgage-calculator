import { describe, it, expect } from 'vitest'
import { annuityPayment, monthlyRate, shortestTerm } from '@/engine/money'

describe('monthlyRate', () => {
  it('divides the nominal annual rate by 12', () => {
    expect(monthlyRate(0.24)).toBeCloseTo(0.02, 10)
  })
})

describe('annuityPayment', () => {
  // Cross-checked against the Python prototype: 12,000,000 @ 24% over 240
  // months produced 242,088.98.
  it('matches the reference schedule for a 24% loan', () => {
    expect(annuityPayment(12_000_000, 0.24, 240)).toBeCloseTo(242_088.98, 2)
  })

  // The Otbasy arm's rate. Value cross-checked by amortizing 8,000,000 at 8.5%
  // over 240 months to a zero residual — not by re-running annuityPayment itself.
  it('matches the reference schedule for an 8.5% loan', () => {
    expect(annuityPayment(8_000_000, 0.085, 240)).toBeCloseTo(69_425.86, 2)
  })

  it('splits principal evenly when the rate is zero', () => {
    expect(annuityPayment(1_200_000, 0, 12)).toBeCloseTo(100_000, 6)
  })

  it('repays the whole principal over the term', () => {
    const principal = 5_000_000
    const payment = annuityPayment(principal, 0.085, 240)
    let balance = principal
    for (let month = 0; month < 240; month++) {
      balance = balance * (1 + 0.085 / 12) - payment
    }
    expect(balance).toBeCloseTo(0, 4)
  })
})

describe('shortestTerm', () => {
  // The smallest term whose annuity fits under the cap. A generous cap → a short
  // term; the returned term's payment is <= the cap, and one month shorter is not.
  it('returns the least term whose payment fits under the cap', () => {
    const principal = 12_000_000
    const cap = 500_000
    const term = shortestTerm(principal, 0.24, cap, 240)
    expect(annuityPayment(principal, 0.24, term)).toBeLessThanOrEqual(cap)
    expect(annuityPayment(principal, 0.24, term - 1)).toBeGreaterThan(cap)
  })

  // A cap that only the very longest schedule can meet lands exactly on maxTerm.
  it('lands on the max term when only it fits', () => {
    const principal = 12_000_000
    const cap = annuityPayment(principal, 0.24, 240) + 1
    expect(shortestTerm(principal, 0.24, cap, 240)).toBe(240)
  })

  // Below the interest-only payment nothing amortizes; it caps out at maxTerm and
  // lets the affordability gate reject the purchase.
  it('returns the max term when even the longest schedule cannot fit', () => {
    const principal = 12_000_000
    const interestOnly = (principal * 0.24) / 12
    expect(shortestTerm(principal, 0.24, interestOnly * 0.5, 240)).toBe(240)
  })

  it('handles a zero rate', () => {
    // Straight-line: 1,200,000 over a cap of 100,000/month needs 12 months.
    expect(shortestTerm(1_200_000, 0, 100_000, 240)).toBe(12)
  })

  it('returns 1 for a non-positive principal', () => {
    expect(shortestTerm(0, 0.24, 100_000, 240)).toBe(1)
  })
})
