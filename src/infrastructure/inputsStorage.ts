import type { Inputs } from '@/engine/types/inputs'

// Bump when the Inputs shape changes — a stored blob from an older shape would
// otherwise deserialize into a half-populated object and silently skew results.
const STORAGE_KEY = 'mortgage:inputs:v2'

// Real starting position as of 2026-07. See MODEL.md for provenance of every number.
export const DEFAULT_INPUTS: Inputs = {
  start: { year: 2026, month: 7 },
  horizonMonths: 60,
  apartment: {
    price: 45_000_000,
    annualGrowthRate: 0,
  },
  sale: {
    proceeds: 35_000_000,
    monthOffset: 3,
    depositAnnualRate: 0.184,
    depositPayoutPeriodMonths: 6,
  },
  cashflow: {
    monthlyFreeCash: 500_000,
    monthlyRent: 400_000,
    startMonthOffset: 1,
    // 0 by default: an unindexed income is the pessimistic, known case. Anything
    // else would be me guessing your raise schedule.
    annualIndexationRate: 0,
  },
  deposits: {
    accounts: [
      {
        id: 'kaspi-locked',
        label: 'Kaspi (до 24.07)',
        balance: 1_021_923.88,
        annualRate: 0.184,
        unlockMonthOffset: 1,
        payoutPeriodMonths: 6,
        kind: 'savings',
      },
      {
        id: 'kaspi-liquid',
        label: 'Kaspi (свободный)',
        balance: 356_599,
        annualRate: 0.14,
        unlockMonthOffset: 0,
        payoutPeriodMonths: 1,
        kind: 'savings',
      },
      {
        id: 'otbasy',
        label: 'Отбасы',
        balance: 648_509.26,
        annualRate: 0.02,
        unlockMonthOffset: 0,
        payoutPeriodMonths: 1,
        kind: 'otbasy',
      },
    ],
    newDepositAnnualRate: 0.184,
    newDepositPayoutPeriodMonths: 6,
  },
  halyk: {
    annualRate: 0.24,
    downPaymentFraction: 0.2,
    maxTermMonths: 240,
  },
  otbasy: {
    loanAnnualRate: 0.085,
    minBalanceFraction: 0.5,
    ccTarget: 5,
    govBonusRate: 0.2,
    govBonusCap: 200 * 4325,
    govBonusMonth: 2,
    seedFromSale: 5_000_000,
  },
  halykDelayedSavingMonths: null,
}

export function loadInputs(): Inputs | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return structurallyValid(parsed) ? (parsed as Inputs) : null
  } catch {
    return null
  }
}

export function saveInputs(inputs: Inputs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
}

// A marker check, not full schema validation — enough to reject a blob from a
// different shape. STORAGE_KEY is versioned for the real breaking changes.
function structurallyValid(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Inputs>
  return (
    typeof candidate.horizonMonths === 'number' &&
    typeof candidate.apartment?.price === 'number' &&
    typeof candidate.sale?.proceeds === 'number' &&
    Array.isArray(candidate.deposits?.accounts)
  )
}
