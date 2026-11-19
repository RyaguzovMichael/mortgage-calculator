import type { HousingSituation, Inputs } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import { BUILT_IN_PRODUCTS, isBuiltInProduct } from './depositCatalogue'
import {
  BUILT_IN_LOAN_PRODUCTS,
  isBuiltInLoanProduct,
} from './loanCatalogue'
import type { OtbasyLoanParams } from './loanCatalogue'
import { currentCountry } from './currentCountry'

// The inputs blob is stored per country: switching country swaps the whole
// working set (built-ins come from that country's files, the user's own data
// comes from that country's key), and switching back restores it untouched.
//
// Bump the vN suffix when the Inputs shape changes — a stored blob from an older
// shape would otherwise deserialize into a half-populated object and silently
// skew results.
//
// v16: per-country key; plans gained a `term` decision (max | shortest); the
// four built-in plans were removed, so `shown` no longer references their ids.
// v15: Halyk split into two built-in loan products (halyk, halyk-fee) instead
// of one with a rate baked in.
export function storageKey(country: string): string {
  return `mortgage:inputs:${country}:v16`
}

// The deposit a plan falls back to when its own choice no longer resolves, and the
// one a freshly added plan starts on. Per country: the file's first built-in, so
// Казахстан keeps kaspi-deposit while another country falls back to its own.
export function defaultSavingsProductId(): string {
  return BUILT_IN_PRODUCTS[0]?.id ?? ''
}

// The situation and sale month a custom plan falls back to when a saved value is
// missing or invalid — the same starting point a freshly added plan gets.
const DEFAULT_PLAN_SITUATION: HousingSituation = 'selling'
export const DEFAULT_PLAN_SALE_MONTH = 3

// Otbasy programme parameters used as schema filler for a country that has no
// otbasy entry in its loans.yml — never shown, never reachable, just keeps the
// repair schema total.
const ZERO_OTBASY_PARAMS: OtbasyLoanParams = {
  loanAnnualRate: 0,
  maxTermMonths: 1,
  depositAnnualRate: 0,
  minBalanceFraction: 0,
  ccTarget: 0,
  govBonusRate: 0,
  govBonusCap: 0,
  govBonusMonth: 1,
  seedFromSale: 0,
}

function otbasyParams(): OtbasyLoanParams {
  return currentCountry().loans.otbasy ?? ZERO_OTBASY_PARAMS
}

// The start month is the current one: a fresh install starts from "today", not
// from a date baked into the source.
export function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function numberDefault(meta: { defaults: Readonly<Record<string, number>> }, key: string, fallback: number): number {
  const value = meta.defaults[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

// Defaults for a country: programme parameters come from its loans.yml (or the
// zero filler), the economic starting points from its meta.yml, and the personal
// figures — the "example" the wizard's shortcut button loads — come from the
// optional `example` block; without it everything personal starts at zero.
// Calendar-specific values (the start month) are always "now".
export function buildDefaultInputs(): Inputs {
  const { meta } = currentCountry()
  const example = meta.example ?? {}
  const num = (key: string, fallback = 0) => {
    const value = example[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }
  const bool = (key: string, fallback = false) => {
    const value = example[key]
    return typeof value === 'boolean' ? value : fallback
  }
  const annualGrowthRate = numberDefault(meta, 'apartmentAnnualGrowthRate', 0.05)
  // Personal figures exist only as the optional `example` block; the indexation
  // rate additionally falls back to the apartment's growth rate — with no reason
  // to assume a raise, tracking the price growth is the least-arbitrary guess —
  // but an explicit example value (KZ ships 0, the pessimistic known case) wins.
  const indexationFallback = numberDefault(meta, 'annualIndexationRate', annualGrowthRate)
  return {
    start: currentYearMonth(),
    horizonMonths: numberDefault(meta, 'horizonMonths', 60),
    apartment: {
      price: num('apartmentPrice'),
      annualGrowthRate,
    },
    existingApartment: {
      owned: bool('existingApartmentOwned'),
      price: num('existingApartmentPrice'),
    },
    cashflow: {
      monthlySalary: num('monthlySalary'),
      mortgageShare: num('mortgageShare'),
      monthlyRent: num('monthlyRent'),
      annualIndexationRate: num('annualIndexationRate', indexationFallback),
      raiseMonth: numberDefault(meta, 'raiseMonth', 6),
    },
    deposits: {
      savingsBalance: num('savingsBalance'),
      products: [...BUILT_IN_PRODUCTS],
    },
    loans: {
      products: [...BUILT_IN_LOAN_PRODUCTS],
    },
    otbasy: {
      // A country without the programme (meta.otbasy = false) ships a disabled,
      // zeroed account: the engine still has a well-formed shape to hold, the UI
      // never shows it, and the wizard never asks about it.
      // Example presets may flip the account on explicitly (otbasyHasDeposit);
      // otherwise a non-zero example balance implies the account exists.
      hasDeposit: meta.otbasy && bool('otbasyHasDeposit', num('otbasyBalance') > 0),
      balance: num('otbasyBalance'),
      accruedInterest: 0,
      monthsOpen: 0,
      ...otbasyParams(),
    },
    plans: {
      custom: [],
      generated: [],
      shown: [],
    },
    delayedSavingMonths: null,
  }
}

// What a first-time user (or anyone who pressed Reset) starts the onboarding
// wizard on: the programme parameters (catalogues, programme rates, horizon,
// growth rates) are kept from the country's data, but every *personal* start
// condition is blanked so the user enters their own situation rather than
// inheriting someone else's figures.
export function buildBlankStartInputs(): Inputs {
  const defaults = buildDefaultInputs()
  return {
    ...defaults,
    apartment: { ...defaults.apartment, price: 0 },
    existingApartment: { owned: false, price: 0 },
    cashflow: {
      ...defaults.cashflow,
      monthlySalary: 0,
      mortgageShare: 0,
      monthlyRent: 0,
      // A fresh start assumes no indexation unless the country ships its own rate —
      // the example's personal 0 must not leak in, but the country default should.
      annualIndexationRate: numberDefault(
        currentCountry().meta,
        'annualIndexationRate',
        defaults.apartment.annualGrowthRate,
      ),
    },
    deposits: { ...defaults.deposits, savingsBalance: 0 },
    otbasy: {
      ...defaults.otbasy,
      hasDeposit: false,
      balance: 0,
      accruedInterest: 0,
      monthsOpen: 0,
    },
    // Nothing on the board to begin with: the onboarding wizard's final step is
    // where the user picks which plans to compare.
    plans: { ...defaults.plans, shown: [] },
  }
}

// True when the running country ships a personal "example" in its meta.yml —
// the wizard's shortcut button is hidden otherwise (an example full of zeros
// would be a lie).
export function hasExampleInputs(): boolean {
  return currentCountry().meta.example !== undefined
}

export function loadInputs(): Inputs | null {
  const raw = localStorage.getItem(storageKey(currentCountry().meta.code))
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
  return withPlanDefaults(withCatalogue(repair(buildDefaultInputs(), parsed) as Inputs))
}

export function saveInputs(inputs: Inputs): void {
  localStorage.setItem(
    storageKey(currentCountry().meta.code),
    JSON.stringify(withoutBuiltIns(inputs)),
  )
}

// The built-ins belong to the country's files, not to the user's saved blob. Keeping
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
    loans: {
      ...inputs.loans,
      products: inputs.loans.products.filter((product) => !isBuiltInLoanProduct(product.id)),
    },
  }
}

// repair() takes the plan arrays wholesale (see its comment below), so a plan saved
// with a stale deposit id — one the user has since deleted — or with a
// missing/invalid situation would reach the engine broken. Fall each field back to
// its default rather than let simulateAll throw on savingsProduct() or run against a
// situation that is not one of the three. Applied to both the hand-built and the
// generated plans. Runs after withCatalogue so the deposit list it checks ids
// against is finalised.
function withPlanDefaults(inputs: Inputs): Inputs {
  const ids = new Set(inputs.deposits.products.map((product) => product.id))
  const repairPlan = <T extends PurchasePlan>(plan: T): T => ({
    ...plan,
    situation: isSituation(plan.situation) ? plan.situation : DEFAULT_PLAN_SITUATION,
    saleMonthOffset: isWholeMonth(plan.saleMonthOffset)
      ? plan.saleMonthOffset
      : DEFAULT_PLAN_SALE_MONTH,
    // Backfill term for plans saved before it existed — an old blob simply had no
    // such field; default it to the longest-term behaviour they ran under.
    term: plan.term === 'shortest' ? 'shortest' : 'max',
    savingsProductId: ids.has(plan.savingsProductId) ? plan.savingsProductId : defaultSavingsProductId(),
  })
  return {
    ...inputs,
    plans: {
      ...inputs.plans,
      custom: inputs.plans.custom.map(repairPlan),
      generated: inputs.plans.generated
        .filter((plan) => Array.isArray(plan.categories))
        .map(repairPlan),
    },
  }
}

function isSituation(value: unknown): value is HousingSituation {
  return value === 'selling' || value === 'free' || value === 'renting'
}

function isWholeMonth(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function withCatalogue(inputs: Inputs): Inputs {
  const ownDeposits = inputs.deposits.products.filter((product) => !isBuiltInProduct(product.id))
  const products = [...BUILT_IN_PRODUCTS, ...ownDeposits]
  const ownLoans = inputs.loans.products.filter((product) => !isBuiltInLoanProduct(product.id))
  return {
    ...inputs,
    deposits: {
      ...inputs.deposits,
      products,
    },
    loans: {
      ...inputs.loans,
      products: [...BUILT_IN_LOAN_PRODUCTS, ...ownLoans],
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
// the built-ins. The storage key is still bumped for real shape changes.
function repair(defaults: unknown, stored: unknown): unknown {
  if (typeof defaults === 'number') {
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : defaults
  }
  if (typeof defaults === 'boolean') return typeof stored === 'boolean' ? stored : defaults
  if (typeof defaults === 'string') return typeof stored === 'string' ? stored : defaults
  // A null default marks a nullable number (delayedSavingMonths): keep a real
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
