import type { Inputs } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'

// The four plans that used to ship in data/plans.yml. They are gone as built-ins,
// but they are still perfectly good plans — the engine tests that pinned per-variant
// behaviour against them keep using them as fixtures, now supplied here instead of
// read from the removed catalogue. Every one carries the new `term: 'max'`.
export const TEST_PLANS: readonly PurchasePlan[] = [
  {
    id: 'halyk',
    name: 'Halyk',
    loan: 'halyk',
    buyWhen: 'asap',
    saveMonths: null,
    borrow: 'max',
    repay: 'monthly',
    term: 'max',
    situation: 'selling',
    saleMonthOffset: 3,
    savingsProductId: 'kaspi-deposit',
  },
  {
    id: 'otbasy',
    name: 'Otbasy',
    loan: 'otbasy',
    buyWhen: 'otbasy-gates',
    saveMonths: null,
    borrow: 'max',
    repay: 'lump',
    term: 'max',
    situation: 'selling',
    saleMonthOffset: 3,
    savingsProductId: 'kaspi-deposit',
  },
  {
    id: 'otbasy-hold',
    name: 'Otbasy (не гасить)',
    loan: 'otbasy',
    buyWhen: 'otbasy-gates',
    saveMonths: null,
    borrow: 'max',
    repay: 'never',
    term: 'max',
    situation: 'selling',
    saleMonthOffset: 3,
    savingsProductId: 'kaspi-deposit',
  },
  {
    id: 'all-cash',
    name: 'Без ипотеки',
    loan: 'none',
    buyWhen: 'asap',
    saveMonths: null,
    borrow: 'max',
    repay: 'monthly',
    term: 'max',
    situation: 'selling',
    saleMonthOffset: 3,
    savingsProductId: 'kaspi-deposit',
  },
]

export function testPlan(id: string): PurchasePlan {
  const found = TEST_PLANS.find((plan) => plan.id === id)
  if (!found) throw new Error(`Unknown test plan: ${id}`)
  return found
}

// Put plans on the board — into custom + shown, the shape simulateAll now reads
// (there is no built-in catalogue handed in any more).
export function withBoard(
  inputs: Inputs,
  custom: readonly PurchasePlan[],
  shown: readonly string[] = custom.map((plan) => plan.id),
): Inputs {
  return {
    ...inputs,
    plans: { custom: [...custom], generated: [], shown: [...shown] },
  }
}
