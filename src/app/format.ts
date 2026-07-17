import type { DepositProduct } from '@/engine/types/inputs'
import type { VariantId } from '@/engine/types/plan'
import { formatYearMonth, type YearMonth } from '@/engine/types/yearMonth'

const TENGE = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const COMPACT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

export function money(value: number): string {
  return TENGE.format(Math.round(value))
}

// Axis and tile labels only — a table cell always shows the full number.
export function millions(value: number): string {
  return `${COMPACT.format(value / 1_000_000)} млн`
}

export function percent(rate: number): string {
  return `${COMPACT.format(rate * 100)}%`
}

export function monthLabel(yearMonth: YearMonth): string {
  return formatYearMonth(yearMonth)
}

// Built from the deposit's fields rather than stored as a label, so the rate in
// the text cannot drift from the rate in the model.
export function describeProduct(product: DepositProduct): string {
  return `${product.name} — ${percent(product.annualRate)}, ${payoutPhrase(product.payoutPeriodMonths)}`
}

// A monthly payout is worth spelling out: it is the same thing as "withdraw any
// time, lose nothing", which is what the whole choice turns on.
function payoutPhrase(months: number): string {
  if (months === 1) return 'выплата каждый месяц, снятие без потерь'
  return `выплата раз в ${months} ${monthsWord(months)}`
}

// Russian needs three forms, and 11-14 are the exception to the last-digit rule.
function monthsWord(months: number): string {
  const lastTwo = months % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'месяцев'
  const last = months % 10
  if (last === 1) return 'месяц'
  if (last >= 2 && last <= 4) return 'месяца'
  return 'месяцев'
}

export const VARIANT_LABELS: Record<VariantId, string> = {
  'halyk-immediate': 'Halyk сразу',
  'halyk-delayed': 'Halyk отложенно',
  otbasy: 'Otbasy',
  'all-cash': 'Без ипотеки',
}

export const VARIANT_COLORS: Record<VariantId, string> = {
  'halyk-immediate': 'var(--series-1)',
  'halyk-delayed': 'var(--series-2)',
  otbasy: 'var(--series-3)',
  'all-cash': 'var(--series-4)',
}

export const PHASE_LABELS: Record<string, string> = {
  'pre-sale': 'до продажи',
  renting: 'аренда',
  'owned-with-loan': 'своя, кредит',
  owned: 'своя',
}
