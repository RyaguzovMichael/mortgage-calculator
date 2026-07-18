import type { LoanProduct, OtbasyInputs } from '@/engine/types/inputs'
import loansFile from '../../data/loans.yml'

export interface LocalizedText {
  readonly ru: string
  readonly en: string
}

export interface LoanMeta {
  readonly id: 'halyk' | 'otbasy'
  readonly name: string
  readonly description: LocalizedText
}

// The product-parameter subset of OtbasyInputs — everything except the personal
// account state (hasDeposit, balance, accruedInterest, monthsOpen), which is a
// fact about the person, not the programme, and stays a literal in
// inputsStorage.ts.
export type OtbasyLoanParams = Omit<
  OtbasyInputs,
  'hasDeposit' | 'balance' | 'accruedInterest' | 'monthsOpen'
>

export interface ParsedLoans {
  readonly meta: readonly LoanMeta[]
  readonly halyk: LoanProduct
  readonly otbasy: OtbasyLoanParams
}

// The built-in loans, from data/loans.yml. Otbasy is not a catalogue entry — one
// fixed state programme, edited nowhere in the UI, its parameters just sourced
// from here. Halyk is: it is a LoanProduct like any custom credit the user adds,
// it just happens to ship built in and be non-removable (isBuiltInLoanProduct).
const PARSED: ParsedLoans = parseLoans(loansFile)

export const BUILT_IN_LOANS: readonly LoanMeta[] = PARSED.meta
export const BUILT_IN_LOAN_PRODUCT: LoanProduct = PARSED.halyk
export const OTBASY_PARAM_DEFAULTS: OtbasyLoanParams = PARSED.otbasy

const BUILT_IN_LOAN_PRODUCT_IDS = new Set([BUILT_IN_LOAN_PRODUCT.id])

// Derived from the file, not stored as a flag — same reasoning as
// isBuiltInProduct in depositCatalogue.ts.
export function isBuiltInLoanProduct(id: string): boolean {
  return BUILT_IN_LOAN_PRODUCT_IDS.has(id)
}

// Throws rather than skipping bad entries: this is data we ship, so a typo is a
// programmer error and should stop the app at startup, not silently compute the
// mortgage at a rate nobody chose.
export function parseLoans(raw: unknown): ParsedLoans {
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

  const halykEntry = entries.find((entry) => entry.meta.id === 'halyk')
  const otbasyEntry = entries.find((entry) => entry.meta.id === 'otbasy')
  if (!halykEntry) throw new Error('loans.yml: отсутствует запись halyk')
  if (!otbasyEntry) throw new Error('loans.yml: отсутствует запись otbasy')

  return {
    meta: entries.map((entry) => entry.meta),
    halyk: halykEntry.halyk!,
    otbasy: otbasyEntry.otbasy!,
  }
}

interface ParsedEntry {
  readonly meta: LoanMeta
  readonly halyk?: LoanProduct
  readonly otbasy?: OtbasyLoanParams
}

function parseEntry(entry: unknown, index: number): ParsedEntry {
  const at = `loans.yml, запись ${index + 1}`
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${at}: ожидался объект`)
  }

  const candidate = entry as Record<string, unknown>
  const id = oneOf(candidate.id, ['halyk', 'otbasy'] as const, `${at}: id`)
  const meta: LoanMeta = {
    id,
    name: text(candidate.name, `${at}: name`),
    description: localizedText(candidate.description, `${at}: description`),
  }

  if (id === 'halyk') {
    return {
      meta,
      halyk: {
        id,
        name: meta.name,
        annualRate: number(candidate.annualRate, `${at}: annualRate`),
        downPaymentFraction: number(candidate.downPaymentFraction, `${at}: downPaymentFraction`),
        maxTermMonths: positiveInteger(candidate.maxTermMonths, `${at}: maxTermMonths`),
      },
    }
  }

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
