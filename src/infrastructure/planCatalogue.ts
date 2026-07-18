import type { PurchasePlan } from '@/engine/types/plan'
import plansFile from '../../data/plans.yml'

const LOANS = ['halyk', 'otbasy', 'none'] as const
const BUY_WHENS = ['asap', 'after-months', 'otbasy-gates'] as const
const BORROWS = ['max', 'min'] as const
const REPAYS = ['monthly', 'lump', 'never'] as const
const HOUSING_SITUATIONS = ['selling', 'free', 'renting'] as const

// The built-in purchase plans, from data/plans.yml. Like the deposits, they are
// deliberately NOT persisted: only the user's own plans and their board-visibility
// choices live in localStorage, so editing the file reaches people who already
// have saved data, and a plan removed from the file actually disappears instead of
// living on as an editable "custom" one.
export const BUILT_IN_PLANS: readonly PurchasePlan[] = parsePurchasePlans(plansFile)

const BUILT_IN_IDS = new Set(BUILT_IN_PLANS.map((plan) => plan.id))

// Derived from the file, not stored as a flag: a flag would keep claiming
// "built-in" after the plan was removed from the YAML.
export function isBuiltInPlan(id: string): boolean {
  return BUILT_IN_IDS.has(id)
}

// Throws rather than skipping bad entries: this is data we ship, so a typo is a
// programmer error and should stop the app at startup, not silently run a plan
// nobody described.
export function parsePurchasePlans(raw: unknown): PurchasePlan[] {
  if (!Array.isArray(raw)) {
    throw new Error('plans.yml: ожидался список планов')
  }

  const plans = raw.map(parsePlan)
  const seen = new Set<string>()
  for (const plan of plans) {
    if (seen.has(plan.id)) {
      throw new Error(`plans.yml: id «${plan.id}» встречается больше одного раза`)
    }
    seen.add(plan.id)
  }
  return plans
}

function parsePlan(entry: unknown, index: number): PurchasePlan {
  const at = `plans.yml, запись ${index + 1}`
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${at}: ожидался объект`)
  }

  const candidate = entry as Record<string, unknown>
  return {
    id: text(candidate.id, `${at}: id`),
    name: text(candidate.name, `${at}: name`),
    loan: oneOf(candidate.loan, LOANS, `${at}: loan`),
    buyWhen: oneOf(candidate.buyWhen, BUY_WHENS, `${at}: buyWhen`),
    saveMonths: nullableMonths(candidate.saveMonths, `${at}: saveMonths`),
    borrow: oneOf(candidate.borrow, BORROWS, `${at}: borrow`),
    repay: oneOf(candidate.repay, REPAYS, `${at}: repay`),
    situation: oneOf(candidate.situation, HOUSING_SITUATIONS, `${at}: situation`),
    saleMonthOffset: wholeMonths(candidate.saleMonthOffset, `${at}: saleMonthOffset`),
    // Not cross-checked against the deposit catalogue here: deposits are
    // user-editable, so a shipped plan can only name a built-in id, and
    // loadInputs repairs a user's plan whose id no longer resolves. Just a
    // non-empty string, same leniency the global deposit selection had.
    savingsProductId: text(candidate.savingsProductId, `${at}: savingsProductId`),
  }
}

function text(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${at}: ожидалась непустая строка, получено ${JSON.stringify(value)}`)
  }
  return value
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  at: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(
      `${at}: ожидалось одно из [${allowed.join(', ')}], получено ${JSON.stringify(value)}`,
    )
  }
  return value as T[number]
}

// A required non-negative whole number of months — the sale-month offset. It has
// to be an integer: the month loop matches it against integer indices, so a
// fractional month would simply never land a sale.
function wholeMonths(value: unknown, at: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${at}: ожидалось целое число месяцев >= 0, получено ${JSON.stringify(value)}`)
  }
  return value
}

// null is a real value here — "wait as long as Otbasy does"; a number must be a
// non-negative whole number of months.
function nullableMonths(value: unknown, at: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `${at}: ожидалось null или целое число месяцев >= 0, получено ${JSON.stringify(value)}`,
    )
  }
  return value
}
