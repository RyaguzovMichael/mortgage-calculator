import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DepositProduct, HousingSituation, LoanProduct } from '@/engine/types/inputs'
import type { Phase, PurchasePlan } from '@/engine/types/plan'
import { formatYearMonth, type YearMonth } from '@/engine/types/yearMonth'
import type { LoanMeta } from '@/infrastructure/loanCatalogue'

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

  // The loan's prose blurb in the active locale, from data/loans.yml. Reads
  // `locale` directly rather than going through t(), since the text is data, not
  // a message key.
  function describeLoan(loan: LoanMeta): string {
    return locale.value === 'ru' ? loan.description.ru : loan.description.en
  }

  // The terms alone, for a LoanProduct row — built-in Halyk or a custom credit.
  // Parallel to productTerms() for deposits.
  function loanProductTerms(product: LoanProduct): string {
    return t('loansTab.termsLine', {
      rate: percent(product.annualRate),
      down: percent(product.downPaymentFraction),
      term: product.maxTermMonths,
      suffix: t('common.monthsSuffix'),
    })
  }

  // Otbasy is the one fixed sentinel; 'none' is cash; anything else is a
  // LoanProduct id, built-in or custom — looked up by name rather than kept in a
  // fixed map, since the set of ids is open-ended once a user can add credits.
  // Falls back to the raw id rather than throwing: formatting must not crash on a
  // stale reference the way the engine's loanProduct() is allowed to.
  function loanLabel(loanId: string, products: readonly LoanProduct[]): string {
    if (loanId === 'none') return t('format.loanLabels.none')
    if (loanId === 'otbasy') return t('format.loanLabels.otbasy')
    return products.find((product) => product.id === loanId)?.name ?? loanId
  }

  // Computed, not plain objects: a component that captures these once at setup
  // time would freeze them at whatever locale was active on mount, and switching
  // language would leave every dropdown and summary line stuck in the old one.
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
  const TERM_LABELS = computed<Record<PurchasePlan['term'], string>>(() => ({
    max: t('format.termLabels.max'),
    shortest: t('format.termLabels.shortest'),
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
  // and repay are left off a cash plan — they do not apply without a loan. The
  // deposit is named for every plan but Otbasy, which stores nothing on it.
  function describePlan(
    plan: PurchasePlan,
    loanProducts: readonly LoanProduct[],
    depositProducts: readonly DepositProduct[],
  ): string {
    const when =
      plan.buyWhen === 'after-months' && plan.saveMonths !== null
        ? t('format.describePlanAfterMonths', {
            n: plan.saveMonths,
            word: monthsWord(plan.saveMonths),
          })
        : plan.buyWhen === 'after-months'
          ? t('format.describePlanOtbasyWait')
          : BUY_WHEN_LABELS.value[plan.buyWhen]
    const parts = [loanLabel(plan.loan, loanProducts), when]
    if (plan.loan !== 'none') {
      parts.push(BORROW_LABELS.value[plan.borrow], REPAY_LABELS.value[plan.repay])
      // Term is a choice only for an ordinary credit; Otbasy always runs its own
      // contract term, so naming it there would imply a lever that isn't offered.
      if (plan.loan !== 'otbasy') parts.push(TERM_LABELS.value[plan.term])
    }
    parts.push(HOUSING_LABELS.value[plan.situation])
    if (plan.loan !== 'otbasy') {
      const deposit = depositProducts.find((product) => product.id === plan.savingsProductId)
      if (deposit) parts.push(deposit.name)
    }
    return parts.join(' · ')
  }

  return {
    describeProduct,
    productTerms,
    describeLoan,
    loanProductTerms,
    loanLabel,
    describePlan,
    monthsWord,
    BUY_WHEN_LABELS,
    BORROW_LABELS,
    REPAY_LABELS,
    TERM_LABELS,
    HOUSING_LABELS,
    PHASE_LABELS,
  }
}
