import type { DepositProduct } from '@/engine/types/inputs'
import type { Phase, PurchasePlan } from '@/engine/types/plan'
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

// Private helper of productTerms; nothing else needs it.
function percent(rate: number): string {
  return `${COMPACT.format(rate * 100)}%`
}

export function monthLabel(yearMonth: YearMonth): string {
  return formatYearMonth(yearMonth)
}

// Built from the deposit's fields rather than stored as a label, so the rate in
// the text cannot drift from the rate in the model.
export function describeProduct(product: DepositProduct): string {
  return `${product.name} — ${productTerms(product)}`
}

// The terms alone, for places that already show the name above them.
export function productTerms(product: DepositProduct): string {
  return `${percent(product.annualRate)}, ${payoutPhrase(product.payoutPeriodMonths)}`
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

// Colour follows the plan's position among the shown, not its id: eight validated
// categorical slots, assigned in order. The board caps the shown at eight, so the
// index never runs past the palette; the modulo is a belt-and-braces guard, not a
// licence to draw a ninth line.
export function colorForIndex(index: number): string {
  return `var(--series-${(index % 8) + 1})`
}

// The four plan decisions in Russian. Typed on the plan's own literal unions, so a
// new option is a compile error here rather than a blank in a dropdown. Shared by
// the plan editor (option labels) and describePlan (the read-only summary).
export const LOAN_LABELS: Record<PurchasePlan['loan'], string> = {
  halyk: 'Halyk',
  otbasy: 'Otbasy',
  none: 'Без ипотеки',
}
export const BUY_WHEN_LABELS: Record<PurchasePlan['buyWhen'], string> = {
  asap: 'как только хватит',
  'after-months': 'через N месяцев',
  'otbasy-gates': 'по воротам Otbasy',
}
export const BORROW_LABELS: Record<PurchasePlan['borrow'], string> = {
  max: 'максимум (меньше взнос)',
  min: 'минимум (всё вниз)',
}
export const REPAY_LABELS: Record<PurchasePlan['repay'], string> = {
  monthly: 'гасить каждый месяц',
  lump: 'копить и закрыть разом',
}

// A one-line summary of what a plan does, for the read-only built-in rows. borrow
// and repay are left off a cash plan — they do not apply without a loan.
export function describePlan(plan: PurchasePlan): string {
  const when =
    plan.buyWhen === 'after-months' && plan.saveMonths !== null
      ? `через ${plan.saveMonths} ${monthsWord(plan.saveMonths)}`
      : plan.buyWhen === 'after-months'
        ? 'ждать как Otbasy'
        : BUY_WHEN_LABELS[plan.buyWhen]
  const parts = [LOAN_LABELS[plan.loan], when]
  if (plan.loan !== 'none') parts.push(BORROW_LABELS[plan.borrow], REPAY_LABELS[plan.repay])
  return parts.join(' · ')
}

// Typed on Phase, not string: a new phase must be given a label, and a typo'd key
// is a compile error rather than an `undefined` in the table.
export const PHASE_LABELS: Record<Phase, string> = {
  'pre-sale': 'до продажи',
  'free-housing': 'живу бесплатно',
  renting: 'аренда',
  'owned-with-loan': 'своя, кредит',
  owned: 'своя',
}
