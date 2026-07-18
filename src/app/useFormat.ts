import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DepositProduct, HousingSituation } from '@/engine/types/inputs'
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

function percent(rate: number): string {
  return `${COMPACT.format(rate * 100)}%`
}

export function monthLabel(yearMonth: YearMonth): string {
  return formatYearMonth(yearMonth)
}

// Colour follows the plan's position among the shown, not its id: eight validated
// categorical slots, assigned in order. The board caps the shown at eight, so the
// index never runs past the palette; the modulo is a belt-and-braces guard, not a
// licence to draw a ninth line.
export function colorForIndex(index: number): string {
  return `var(--series-${(index % 8) + 1})`
}

// The translatable half of format.ts: everything below needs a live locale, so it
// is a composable rather than plain exports.
export function useFormat() {
  const { t, tm, locale } = useI18n()

  // Russian needs three forms, and 11-14 are the exception to the last-digit
  // rule; English needs only two. `forms` comes straight from the locale's own
  // messages, so a new language only has to supply the right number of words.
  function monthsWord(months: number): string {
    const forms = tm('format.monthsForms') as unknown as string[]
    if (locale.value === 'ru') {
      const lastTwo = months % 100
      if (lastTwo >= 11 && lastTwo <= 14) return forms[2]!
      const last = months % 10
      if (last === 1) return forms[0]!
      if (last >= 2 && last <= 4) return forms[1]!
      return forms[2]!
    }
    return months === 1 ? forms[0]! : forms[1]!
  }

  function payoutPhrase(months: number): string {
    if (months === 1) return t('format.payoutMonthly')
    return t('format.payoutPeriodic', { months, word: monthsWord(months) })
  }

  // Built from the deposit's fields rather than stored as a label, so the rate in
  // the text cannot drift from the rate in the model.
  function describeProduct(product: DepositProduct): string {
    return `${product.name} — ${productTerms(product)}`
  }

  // The terms alone, for places that already show the name above them.
  function productTerms(product: DepositProduct): string {
    return `${percent(product.annualRate)}, ${payoutPhrase(product.payoutPeriodMonths)}`
  }

  // Computed, not plain objects: a component that captures these once at setup
  // time would freeze them at whatever locale was active on mount, and switching
  // language would leave every dropdown and summary line stuck in the old one.
  const LOAN_LABELS = computed<Record<PurchasePlan['loan'], string>>(() => ({
    halyk: t('format.loanLabels.halyk'),
    otbasy: t('format.loanLabels.otbasy'),
    none: t('format.loanLabels.none'),
  }))
  const BUY_WHEN_LABELS = computed<Record<PurchasePlan['buyWhen'], string>>(() => ({
    asap: t('format.buyWhenLabels.asap'),
    'after-months': t('format.buyWhenLabels.afterMonths'),
    'otbasy-gates': t('format.buyWhenLabels.otbasyGates'),
  }))
  const BORROW_LABELS = computed<Record<PurchasePlan['borrow'], string>>(() => ({
    max: t('format.borrowLabels.max'),
    min: t('format.borrowLabels.min'),
  }))
  const REPAY_LABELS = computed<Record<PurchasePlan['repay'], string>>(() => ({
    monthly: t('format.repayLabels.monthly'),
    lump: t('format.repayLabels.lump'),
    never: t('format.repayLabels.never'),
  }))
  const HOUSING_LABELS = computed<Record<HousingSituation, string>>(() => ({
    selling: t('format.housingLabels.selling'),
    free: t('format.housingLabels.free'),
    renting: t('format.housingLabels.renting'),
  }))
  const PHASE_LABELS = computed<Record<Phase, string>>(() => ({
    'pre-sale': t('format.phaseLabels.preSale'),
    'free-housing': t('format.phaseLabels.freeHousing'),
    renting: t('format.phaseLabels.renting'),
    'owned-with-loan': t('format.phaseLabels.ownedWithLoan'),
    owned: t('format.phaseLabels.owned'),
  }))

  // A one-line summary of what a plan does, for the read-only built-in rows. borrow
  // and repay are left off a cash plan — they do not apply without a loan.
  function describePlan(plan: PurchasePlan): string {
    const when =
      plan.buyWhen === 'after-months' && plan.saveMonths !== null
        ? t('format.describePlanAfterMonths', {
            n: plan.saveMonths,
            word: monthsWord(plan.saveMonths),
          })
        : plan.buyWhen === 'after-months'
          ? t('format.describePlanOtbasyWait')
          : BUY_WHEN_LABELS.value[plan.buyWhen]
    const parts = [LOAN_LABELS.value[plan.loan], when]
    if (plan.loan !== 'none')
      parts.push(BORROW_LABELS.value[plan.borrow], REPAY_LABELS.value[plan.repay])
    parts.push(HOUSING_LABELS.value[plan.housing.situation])
    return parts.join(' · ')
  }

  return {
    describeProduct,
    productTerms,
    describePlan,
    monthsWord,
    LOAN_LABELS,
    BUY_WHEN_LABELS,
    BORROW_LABELS,
    REPAY_LABELS,
    HOUSING_LABELS,
    PHASE_LABELS,
  }
}
