import { describe, it, expect } from 'vitest'
import {
  effectiveHousing,
  planMatchesStart,
  planNeedsExistingApartment,
  savingsProduct,
  type HousingSituation,
  type Inputs,
} from '@/engine/types/inputs'
import { simulateAll } from '@/engine/simulate'
import { TEST_PLANS, testPlan, withBoard } from './plans.fixtures'
import { DEFAULT_INPUTS } from '@/infrastructure/inputsStorage'
import type { PurchasePlan } from '@/engine/types/plan'

// Move 1 & 2: the existing apartment is a global start condition, and a plan's
// situation is both where it lives and its requirement on that start condition.

const owning = (owned: boolean): Inputs => ({
  ...DEFAULT_INPUTS,
  existingApartment: { ...DEFAULT_INPUTS.existingApartment, owned, price: 35_000_000 },
})

const withSituation = (id: string, situation: HousingSituation): PurchasePlan => ({
  ...testPlan(id),
  situation,
})

describe('effectiveHousing', () => {
  it('draws the sale proceeds from the start condition and the month from the plan', () => {
    const housing = effectiveHousing(owning(true), 'selling', 5)
    expect(housing.saleProceeds).toBe(35_000_000)
    expect(housing.saleMonthOffset).toBe(5)
  })

  // The board disables the pairing, but the derivation must not invent proceeds
  // from a flat that does not exist even if a stray run reaches it.
  it('yields zero proceeds for a selling plan when no apartment is owned', () => {
    expect(effectiveHousing(owning(false), 'selling', 3).saleProceeds).toBe(0)
  })

  it('yields zero proceeds for free/renting plans regardless of ownership', () => {
    expect(effectiveHousing(owning(true), 'free', 3).saleProceeds).toBe(0)
    expect(effectiveHousing(owning(true), 'renting', 3).saleProceeds).toBe(0)
  })
})

describe('planMatchesStart', () => {
  it('only a selling plan needs an existing apartment', () => {
    expect(planNeedsExistingApartment({ situation: 'selling' })).toBe(true)
    expect(planNeedsExistingApartment({ situation: 'free' })).toBe(false)
    expect(planNeedsExistingApartment({ situation: 'renting' })).toBe(false)
  })

  it.each([
    ['selling', true, true],
    ['selling', false, false],
    ['free', true, false],
    ['free', false, true],
    ['renting', true, false],
    ['renting', false, true],
  ] as const)('%s plan with owned=%s matches=%s', (situation, owned, matches) => {
    expect(planMatchesStart(owning(owned), { situation })).toBe(matches)
  })
})

describe('savingsProduct resolves a plan’s own deposit', () => {
  it('returns the catalogue entry named by id', () => {
    expect(savingsProduct(DEFAULT_INPUTS, 'kaspi-deposit').payoutPeriodMonths).toBe(1)
    expect(savingsProduct(DEFAULT_INPUTS, 'kaspi-savings').payoutPeriodMonths).toBe(3)
  })

  it('throws on an id that is not in the catalogue', () => {
    expect(() => savingsProduct(DEFAULT_INPUTS, 'nope')).toThrow(/nope/)
  })
})

describe('simulateAll filters incompatible plans off the comparison', () => {
  // Every fixture plan is a selling plan, so turning ownership off leaves nothing to
  // compare — even though the board still lists them as shown.
  it('drops selling plans when no apartment is owned', () => {
    const report = simulateAll(withBoard(owning(false), TEST_PLANS))
    expect(report.variants).toEqual([])
    expect(report.bestVariant).toBeNull()
  })

  it('runs a renting plan only when no apartment is owned', () => {
    const renter = { ...withSituation('all-cash', 'renting'), id: 'renter' }
    const inputs = (owned: boolean): Inputs => withBoard(owning(owned), [renter])
    expect(simulateAll(inputs(false)).variants.map((v) => v.id)).toEqual(['renter'])
    expect(simulateAll(inputs(true)).variants).toEqual([])
  })
})
