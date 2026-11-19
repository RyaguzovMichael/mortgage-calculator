import type { DepositProduct } from '@/engine/types/inputs'

// The deposits of the country currently selected, from public/db/<code>/deposits.yml.
// Set once at startup by setDepositCatalogue (see currentCountry.ts) — before that
// these are empty, and nothing may read them. They are deliberately NOT persisted:
// the file is the source of truth, so edits to it reach people who already have
// saved data, and a deposit deleted from the file actually disappears instead of
// living on in localStorage as an editable "custom" one.
export let BUILT_IN_PRODUCTS: readonly DepositProduct[] = []

let builtInIds: ReadonlySet<string> = new Set()

export function setDepositCatalogue(products: readonly DepositProduct[]): void {
  BUILT_IN_PRODUCTS = [...products]
  builtInIds = new Set(products.map((product) => product.id))
}

// Derived from the data, not stored as a flag on the product: a flag would keep
// claiming "built-in" after the deposit was removed from the file.
export function isBuiltInProduct(id: string): boolean {
  return builtInIds.has(id)
}

// Throws rather than skipping bad entries: this is data we ship, so a typo is a
// programmer error and should stop the app at startup, not silently compute the
// mortgage at a rate nobody chose.
export function parseDepositProducts(raw: unknown): DepositProduct[] {
  if (!Array.isArray(raw)) {
    throw new Error('deposits.yml: ожидался список вкладов')
  }

  const products = raw.map(parseProduct)
  const seen = new Set<string>()
  for (const product of products) {
    if (seen.has(product.id)) {
      throw new Error(`deposits.yml: id «${product.id}» встречается больше одного раза`)
    }
    seen.add(product.id)
  }
  return products
}

function parseProduct(entry: unknown, index: number): DepositProduct {
  const at = `deposits.yml, запись ${index + 1}`
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${at}: ожидался объект`)
  }

  const candidate = entry as Record<string, unknown>
  return {
    id: text(candidate.id, `${at}: id`),
    name: text(candidate.name, `${at}: name`),
    annualRate: number(candidate.annualRate, `${at}: annualRate`),
    payoutPeriodMonths: positiveInteger(candidate.payoutPeriodMonths, `${at}: payoutPeriodMonths`),
  }
}

function text(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${at}: ожидалась непустая строка, получено ${JSON.stringify(value)}`)
  }
  return value
}

function number(value: unknown, at: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${at}: ожидалось число, получено ${JSON.stringify(value)}`)
  }
  return value
}

function positiveInteger(value: unknown, at: string): number {
  const parsed = number(value, at)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${at}: ожидалось целое число месяцев >= 1, получено ${JSON.stringify(value)}`)
  }
  return parsed
}
