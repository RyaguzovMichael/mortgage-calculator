import type { LoanProduct, OtbasyInputs } from '@/engine/types/inputs'

export interface LocalizedText {
  readonly ru: string
  readonly en: string
}

export interface LoanMeta {
  readonly id: string
  readonly name: string
  readonly description: LocalizedText
}

// The product-parameter subset of OtbasyInputs — everything except the personal
// account state (hasDeposit, balance, accruedInterest, monthsOpen), which is a
// fact about the person, not the programme, and stays out of the shipped data.
export type OtbasyLoanParams = Omit<
  OtbasyInputs,
  'hasDeposit' | 'balance' | 'accruedInterest' | 'monthsOpen'
>

export interface ParsedLoans {
  readonly meta: readonly LoanMeta[]
  readonly products: readonly LoanProduct[]
  // null when the country ships no otbasy programme (meta.otbasy === false and
  // no otbasy entry in loans.yml). Callers that need the parameters must handle
  // it; BUILT_IN helpers treat it as "programme disabled".
  readonly otbasy: OtbasyLoanParams | null
}

// The loans of the country currently selected, from public/db/<code>/loans.yml.
// 'otbasy' is a reserved id — a fixed state programme, edited nowhere in the UI,
// its parameters sourced from the file. Everything else is a LoanProduct like any
// custom credit the user adds — it just happens to ship with the country.
// Set once at startup by setLoanCatalogue (see currentCountry.ts).
export let BUILT_IN_LOANS: readonly LoanMeta[] = []
export let BUILT_IN_LOAN_PRODUCTS: readonly LoanProduct[] = []
export let OTBASY_PARAM_DEFAULTS: OtbasyLoanParams | null = null

let builtInLoanProductIds: ReadonlySet<string> = new Set()

export function setLoanCatalogue(parsed: ParsedLoans): void {
  BUILT_IN_LOANS = parsed.meta
  BUILT_IN_LOAN_PRODUCTS = parsed.products
  OTBASY_PARAM_DEFAULTS = parsed.otbasy
  builtInLoanProductIds = new Set(parsed.products.map((product) => product.id))
}

// Derived from the data, not stored as a flag — same reasoning as
// isBuiltInProduct in depositCatalogue.ts.
export function isBuiltInLoanProduct(id: string): boolean {
  return builtInLoanProductIds.has(id)
}

// Throws rather than skipping bad entries: this is data we ship, so a typo is a
// programmer error and should stop the app at startup, not silently compute the
// mortgage at a rate nobody chose.
//
// requireOtbasy: Kazakhstan ships the programme and its entry is mandatory there;
// other countries may ship no otbasy entry at all, in which case otbasy is null.
export function parseLoans(raw: unknown, { requireOtbasy = true }: { requireOtbasy?: boolean } = {}): ParsedLoans {
  if (!Array.isArray(raw)) {
    throw new Error('loans.yml: ожидался список кредитов')
  }

  const entries = raw.map(parseEntry)
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.meta.id)) {
      throw new Error(`loans.yml: id «${entry.meta.id}» встречается больше одного раза`)
    }
    seen.add(entry.meta.id)
  }

  const otbasyEntry = entries.find((entry) => entry.meta.id === 'otbasy')
  if (!otbasyEntry && requireOtbasy) {
    throw new Error('loans.yml: отсутствует запись otbasy')
  }

  const loanEntries = entries.filter((entry) => entry.meta.id !== 'otbasy')
  if (loanEntries.length === 0) {
    throw new Error('loans.yml: нужен хотя бы один кредит помимо otbasy')
  }

  return {
    meta: entries.map((entry) => entry.meta),
    products: loanEntries.map((entry) => entry.loan!),
    otbasy: otbasyEntry?.otbasy ?? null,
  }
}

interface ParsedEntry {
  readonly meta: LoanMeta
  readonly loan?: LoanProduct
  readonly otbasy?: OtbasyLoanParams
}

function parseEntry(entry: unknown, index: number): ParsedEntry {
  const at = `loans.yml, запись ${index + 1}`
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${at}: ожидался объект`)
  }

  const candidate = entry as Record<string, unknown>
  const id = text(candidate.id, `${at}: id`)
  const meta: LoanMeta = {
    id,
    name: text(candidate.name, `${at}: name`),
    description: localizedText(candidate.description, `${at}: description`),
  }

  if (id === 'otbasy') {
    return {
      meta,
      otbasy: {
        loanAnnualRate: number(candidate.loanAnnualRate, `${at}: loanAnnualRate`),
        maxTermMonths: positiveInteger(candidate.maxTermMonths, `${at}: maxTermMonths`),
        depositAnnualRate: number(candidate.depositAnnualRate, `${at}: depositAnnualRate`),
        minBalanceFraction: number(candidate.minBalanceFraction, `${at}: minBalanceFraction`),
        ccTarget: number(candidate.ccTarget, `${at}: ccTarget`),
        govBonusRate: number(candidate.govBonusRate, `${at}: govBonusRate`),
        govBonusCap: number(candidate.govBonusCap, `${at}: govBonusCap`),
        govBonusMonth: positiveInteger(candidate.govBonusMonth, `${at}: govBonusMonth`),
        seedFromSale: number(candidate.seedFromSale, `${at}: seedFromSale`),
      },
    }
  }

  return {
    meta,
    loan: {
      id,
      name: meta.name,
      annualRate: number(candidate.annualRate, `${at}: annualRate`),
      downPaymentFraction: number(candidate.downPaymentFraction, `${at}: downPaymentFraction`),
      maxTermMonths: positiveInteger(candidate.maxTermMonths, `${at}: maxTermMonths`),
    },
  }
}

function text(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${at}: ожидалась непустая строка, получено ${JSON.stringify(value)}`)
  }
  return value
}

function localizedText(value: unknown, at: string): LocalizedText {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${at}: ожидался объект { ru, en }`)
  }
  const candidate = value as Record<string, unknown>
  return {
    ru: text(candidate.ru, `${at}: ru`),
    en: text(candidate.en, `${at}: en`),
  }
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
    throw new Error(`${at}: ожидалось целое число >= 1, получено ${JSON.stringify(value)}`)
  }
  return parsed
}
