import { describe, it, expect } from 'vitest'
import { annuityPayment, monthlyRate } from '@/engine/money'

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

  it('matches the reference schedule for an 8% loan', () => {
    expect(annuityPayment(8_000_000, 0.24, 240)).toBeCloseTo(161_392.65, 2)
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
