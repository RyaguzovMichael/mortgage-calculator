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
