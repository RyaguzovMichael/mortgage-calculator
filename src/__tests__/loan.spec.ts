import { describe, it, expect } from 'vitest'
import { createLoan } from '@/engine/loan'

describe('createLoan', () => {
  it('exposes the annuity payment for its term', () => {
    const loan = createLoan(12_000_000, 0.24, 240)
    expect(loan.scheduledPayment).toBeCloseTo(242_088.98, 2)
  })

  it('splits a payment into interest and principal', () => {
    const loan = createLoan(1_200_000, 0.12, 12)
    const payment = loan.pay(loan.scheduledPayment)
    expect(payment.interest).toBeCloseTo(12_000, 6) // 1,200,000 × 1%
    expect(payment.principal).toBeCloseTo(payment.paid - payment.interest, 6)
    expect(loan.balance).toBeCloseTo(1_200_000 - payment.principal, 6)
  })

  it('keeps interest + principal === paid on every step', () => {
    const loan = createLoan(3_000_000, 0.185, 60)
    for (let month = 0; month < 24; month++) {
      const payment = loan.pay(loan.scheduledPayment + 10_000)
      expect(payment.interest + payment.principal).toBeCloseTo(payment.paid, 6)
    }
  })

  it('sends everything above the accrued interest to principal', () => {
    const loan = createLoan(1_000_000, 0.12, 60)
    const extra = 100_000
    const payment = loan.pay(loan.scheduledPayment + extra)
    expect(payment.principal).toBeCloseTo(payment.paid - 10_000, 6)
  })

  it('accumulates the interest it charged', () => {
    const loan = createLoan(1_000_000, 0.12, 60)
    loan.pay(loan.scheduledPayment)
    loan.pay(loan.scheduledPayment)
    expect(loan.totalInterest).toBeGreaterThan(0)
    expect(loan.totalInterest).toBeLessThan(2 * 10_000)
  })

  it('never overshoots into a negative balance', () => {
    const loan = createLoan(1_000_000, 0.12, 60)
    const payment = loan.pay(10_000_000)
    expect(loan.balance).toBe(0)
    expect(payment.paid).toBeCloseTo(1_000_000 + 10_000, 6)
  })

  it('prepay goes straight at principal without charging interest', () => {
    const loan = createLoan(1_000_000, 0.12, 60)
    const repaid = loan.prepay(200_000)
    expect(repaid).toBe(200_000)
    expect(loan.balance).toBeCloseTo(800_000, 6)
    expect(loan.totalInterest).toBe(0)
  })

  it('prepay caps at the outstanding balance', () => {
    const loan = createLoan(1_000_000, 0.12, 60)
    expect(loan.prepay(5_000_000)).toBeCloseTo(1_000_000, 6)
    expect(loan.balance).toBe(0)
    expect(loan.totalInterest).toBe(0)
  })

  it('is inert once repaid', () => {
    const loan = createLoan(1_000_000, 0.12, 60)
    loan.pay(10_000_000)
    const payment = loan.pay(50_000)
    expect(payment.paid).toBe(0)
    expect(payment.interest).toBe(0)
    expect(loan.balance).toBe(0)
  })
})
