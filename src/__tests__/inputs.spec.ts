import { describe, it, expect } from 'vitest'
import {
  apartmentPriceAt,
  freeCashAt,
  rentAt,
  saleProceedsAt,
  type Inputs,
} from '@/engine/types/inputs'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'

// The model starts in July 2026, so the Junes are months 11, 23, 35...
const JULY_START = DEFAULT_INPUTS

function indexed(annualIndexationRate: number): Inputs {
  return { ...JULY_START, cashflow: { ...JULY_START.cashflow, annualIndexationRate } }
}

describe('apartmentPriceAt', () => {
  it('steps every six months instead of drifting every month', () => {
    const inputs = { ...JULY_START, apartment: { ...JULY_START.apartment, annualGrowthRate: 0.12 } }
    const base = inputs.apartment.price
    expect(apartmentPriceAt(inputs, 0)).toBe(base)
    expect(apartmentPriceAt(inputs, 5)).toBe(base)
    expect(apartmentPriceAt(inputs, 6)).toBeCloseTo(base * 1.12 ** 0.5, 2)
    expect(apartmentPriceAt(inputs, 11)).toBeCloseTo(base * 1.12 ** 0.5, 2)
    // Two half-steps must land exactly on the stated annual rate.
    expect(apartmentPriceAt(inputs, 12)).toBeCloseTo(base * 1.12, 2)
  })

  it('is the year-over-year rate, not a monthly-compounded one', () => {
    const grown = apartmentPriceAt(
      { ...JULY_START, apartment: { ...JULY_START.apartment, annualGrowthRate: 0.24 } },
      12,
    )
    expect(grown).toBeCloseTo(JULY_START.apartment.price * 1.24, 2)
    // The bug this replaced: 24/12 compounded monthly is 26.82% a year.
    expect(grown).not.toBeCloseTo(JULY_START.apartment.price * 1.02 ** 12, 2)
  })
})

describe('saleProceedsAt', () => {
  it('appreciates with the market until the sale — same market, same rate', () => {
    const inputs = { ...JULY_START, apartment: { ...JULY_START.apartment, annualGrowthRate: 0.12 } }
    expect(saleProceedsAt(inputs, 12)).toBeCloseTo(inputs.housing.saleProceeds * 1.12, 2)
    expect(saleProceedsAt(inputs, 0)).toBe(inputs.housing.saleProceeds)
  })

  it('is the value today when the market is flat', () => {
    expect(saleProceedsAt(JULY_START, 36)).toBe(JULY_START.housing.saleProceeds)
  })
})

describe('rentAt', () => {
  it('tracks the apartment growth rate', () => {
    const inputs = { ...JULY_START, apartment: { ...JULY_START.apartment, annualGrowthRate: 0.12 } }
    expect(rentAt(inputs, 12)).toBeCloseTo(inputs.cashflow.monthlyRent * 1.12, 2)
  })

  it('has no rate of its own to freeze', () => {
    expect(rentAt(JULY_START, 48)).toBe(JULY_START.cashflow.monthlyRent)
  })
})

describe('freeCashAt', () => {
  it('is zero before the flow starts', () => {
    expect(freeCashAt(JULY_START, JULY_START.cashflow.startMonthOffset - 1)).toBe(0)
  })

  it('steps once in June and holds flat in between', () => {
    const inputs = indexed(0.1)
    const base = inputs.cashflow.monthlyFreeCash
    // Months 1..10 are pre-raise; June 2027 is month 11.
    expect(freeCashAt(inputs, 1)).toBeCloseTo(base, 6)
    expect(freeCashAt(inputs, 10)).toBeCloseTo(base, 6)
    expect(freeCashAt(inputs, 11)).toBeCloseTo(base * 1.1, 6)
    expect(freeCashAt(inputs, 22)).toBeCloseTo(base * 1.1, 6)
    expect(freeCashAt(inputs, 23)).toBeCloseTo(base * 1.1 ** 2, 6)
  })

  it('does not drift between raises the way a price does', () => {
    expect(freeCashAt(indexed(0.1), 6)).toBe(freeCashAt(indexed(0.1), 1))
  })

  // Otherwise a June start would hand out a raise in month 0 for a year that was
  // never worked.
  it('does not count the starting month itself as a raise', () => {
    const juneStart: Inputs = {
      ...indexed(0.1),
      start: { year: 2026, month: 6 },
      cashflow: { ...indexed(0.1).cashflow, startMonthOffset: 0 },
    }
    const base = juneStart.cashflow.monthlyFreeCash
    expect(freeCashAt(juneStart, 0)).toBeCloseTo(base, 6)
    expect(freeCashAt(juneStart, 11)).toBeCloseTo(base, 6)
    expect(freeCashAt(juneStart, 12)).toBeCloseTo(base * 1.1, 6)
  })

  it('holds flat at 0%', () => {
    expect(freeCashAt(indexed(0), 59)).toBe(JULY_START.cashflow.monthlyFreeCash)
  })
})
