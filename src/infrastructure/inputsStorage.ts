import type { Inputs } from '@/engine/types/inputs'
import { BUILT_IN_PRODUCTS, isBuiltInProduct } from './depositCatalogue'

// Bump when the Inputs shape changes — a stored blob from an older shape would
// otherwise deserialize into a half-populated object and silently skew results.
//
// Exported so the specs cannot drift from it: they used to hard-code the key as a
// string, and two of them went on passing for the wrong reason after a bump.
export const STORAGE_KEY = 'mortgage:inputs:v6'

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
    // The two Kaspi accounts, 1 021 923,88 + 356 599. They used to be itemised,
    // which only ever showed where the money sits: month 0 merges everything.
    savingsBalance: 1_378_522.88,
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
    hasDeposit: true,
    balance: 648_509.26,
    // Both left at zero because I do not know the real figures, and a plausible
    // guess here would move the CC gate without anyone noticing. Fill them in from
    // the Otbasy statement: accrued interest is what CC is actually built from.
    accruedInterest: 0,
    monthsOpen: 0,
    loanAnnualRate: 0.085,
    maxTermMonths: 240,
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
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  // Only a plain object can be repaired; an array or a primitive is not this shape
  // at all and there is nothing to salvage.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  return withCatalogue(repair(DEFAULT_INPUTS, parsed) as Inputs)
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

// Rebuild the stored blob against the defaults as a schema: take each field from
// storage when it is present and the right kind, fall back to the default when it
// is missing or wrong. A single unparseable field (a cleared input leaves "")
// then costs only that field, not the whole saved state — the failure this whole
// function exists to prevent.
//
// Arrays (the deposit catalogue) are taken wholesale; withCatalogue then reconciles
// the built-ins. STORAGE_KEY is still bumped for real shape changes.
function repair(defaults: unknown, stored: unknown): unknown {
  if (typeof defaults === 'number') {
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : defaults
  }
  if (typeof defaults === 'boolean') return typeof stored === 'boolean' ? stored : defaults
  if (typeof defaults === 'string') return typeof stored === 'string' ? stored : defaults
  // A null default marks a nullable number (halykDelayedSavingMonths): keep a real
  // number, otherwise null.
  if (defaults === null) {
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : null
  }
  if (Array.isArray(defaults)) return Array.isArray(stored) ? stored : defaults
  if (typeof defaults === 'object') {
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return defaults
    const source = stored as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(defaults)) {
      out[key] = repair(value, source[key])
    }
    return out
  }
  return defaults
}
