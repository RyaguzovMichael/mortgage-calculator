import type { Inputs } from '@/engine/types/inputs'
import { BUILT_IN_PRODUCTS, isBuiltInProduct } from './depositCatalogue'

// Bump when the Inputs shape changes — a stored blob from an older shape would
// otherwise deserialize into a half-populated object and silently skew results.
//
// Exported so the specs cannot drift from it: they used to hard-code the key as a
// string, and two of them went on passing for the wrong reason after a bump.
export const STORAGE_KEY = 'mortgage:inputs:v4'

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
    // Itemised for provenance only — month 0 pours all three into one deposit,
    // so only the total reaches the model.
    accounts: [
      { id: 'kaspi-locked', label: 'Kaspi (был до 24.07)', balance: 1_021_923.88 },
      { id: 'kaspi-liquid', label: 'Kaspi (свободный)', balance: 356_599 },
      { id: 'otbasy', label: 'Отбасы', balance: 648_509.26 },
    ],
    // Built-ins only; the user's own deposits are added on top at load time.
    products: [...BUILT_IN_PRODUCTS],
    savingsProductId: 'kaspi-deposit',
  },
  halyk: {
    annualRate: 0.24,
    downPaymentFraction: 0.2,
    maxTermMonths: 240,
  },
  otbasy: {
    loanAnnualRate: 0.085,
    depositAnnualRate: 0.02,
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
    return structurallyValid(parsed) ? withCatalogue(parsed as Inputs) : null
  } catch {
    return null
  }
}

export function saveInputs(inputs: Inputs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutBuiltIns(inputs)))
}

// The built-ins belong to data/deposits.yml, not to the user's saved blob. Keeping
// a copy would mean edits to the file never reached anyone who had already used
// the app, and a deposit deleted from the file would live on in localStorage —
// silently reclassified as one of the user's own, because "built-in" is decided by
// membership in the file.
function withoutBuiltIns(inputs: Inputs): Inputs {
  return {
    ...inputs,
    deposits: {
      ...inputs.deposits,
      products: inputs.deposits.products.filter((product) => !isBuiltInProduct(product.id)),
    },
  }
}

function withCatalogue(inputs: Inputs): Inputs {
  const own = inputs.deposits.products.filter((product) => !isBuiltInProduct(product.id))
  const products = [...BUILT_IN_PRODUCTS, ...own]
  return {
    ...inputs,
    deposits: {
      ...inputs.deposits,
      products,
      // Repair rather than reject: a deposit the user deleted, or one dropped from
      // the YAML, must not cost them their price, sale, cashflow and loan terms.
      savingsProductId: products.some((product) => product.id === inputs.deposits.savingsProductId)
        ? inputs.deposits.savingsProductId
        : DEFAULT_INPUTS.deposits.savingsProductId,
    },
  }
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
    Array.isArray(candidate.deposits?.accounts) &&
    Array.isArray(candidate.deposits?.products)
  )
}
