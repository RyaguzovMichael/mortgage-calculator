<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs, MAX_SHOWN } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { BUILT_IN_PLANS } from '@/infrastructure/planCatalogue'
import { planNeedsExistingApartment } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import ProductPicker from './ProductPicker.vue'

const { inputs, addPlan, removePlan, isShown, canShow, isCompatible, toggleShown } = useInputs()
const { t } = useI18n()
const { BORROW_LABELS, BUY_WHEN_LABELS, describePlan, HOUSING_LABELS, REPAY_LABELS } = useFormat()

// 'none' and 'otbasy' are the two fixed sentinels; every LoanProduct (built-in
// Halyk, plus any credit the user added) is an option by its own id and name.
const LOAN_OPTIONS = computed(() => [
  { value: 'none', label: t('format.loanLabels.none') },
  { value: 'otbasy', label: t('format.loanLabels.otbasy') },
  ...inputs.loans.products.map((product) => ({ value: product.id, label: product.name })),
])
const BORROW_OPTIONS = computed(() => entries(BORROW_LABELS.value))
const REPAY_OPTIONS = computed(() => entries(REPAY_LABELS.value))
const HOUSING_OPTIONS = computed(() => entries(HOUSING_LABELS.value))

// otbasy-gates is offered only for an Otbasy loan — waiting for the Otbasy balance
// and CC gates makes no sense without the Otbasy account. That is the one
// impossible combination, and the dropdown simply never shows it.
function buyWhenOptions(plan: PurchasePlan) {
  return entries(BUY_WHEN_LABELS.value).filter(
    (option) => option.value !== 'otbasy-gates' || plan.loan === 'otbasy',
  )
}

// Changing the loan can invalidate the trigger: dropping the Otbasy loan while the
// plan still waits on Otbasy gates would leave an impossible plan. Coerce it back
// to "as soon as possible".
function setLoan(plan: PurchasePlan, loan: PurchasePlan['loan']): void {
  ;(plan as { loan: PurchasePlan['loan'] }).loan = loan
  if (loan !== 'otbasy' && plan.buyWhen === 'otbasy-gates') {
    ;(plan as { buyWhen: PurchasePlan['buyWhen'] }).buyWhen = 'asap'
  }
}

// saveMonths is number | null: a whole number of months, or null for "wait as
// long as Otbasy". Empty field means null; anything else is coerced to a
// non-negative integer. Kept off NumberField, which is strictly a number.
function setSaveMonths(plan: PurchasePlan, event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number(raw)
  ;(plan as { saveMonths: number | null }).saveMonths =
    raw.trim() === ''
      ? null
      : Number.isFinite(parsed)
        ? Math.max(0, Math.trunc(parsed))
        : plan.saveMonths
}

function entries<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))
}

function showTitle(plan: PurchasePlan): string {
  if (isShown(plan.id)) return t('plansTab.showRemove')
  // An incompatible plan cannot go on the board at all — say which start condition
  // it wants, rather than the generic "board is full".
  if (!isCompatible(plan.id)) {
    return planNeedsExistingApartment(plan)
      ? t('plansTab.showNeedsApartment')
      : t('plansTab.showNeedsNoApartment')
  }
  return canShow(plan.id) ? t('plansTab.showAdd') : t('plansTab.showMax', { max: MAX_SHOWN })
}
</script>

<template>
  <section class="field-group">
    <h3>{{ t('plansTab.builtInTitle') }}</h3>
    <p class="note">{{ t('plansTab.builtInNote') }}</p>
    <div v-for="plan in BUILT_IN_PLANS" :key="plan.id" class="built-in">
      <label class="show">
        <input
          type="checkbox"
          :checked="isShown(plan.id)"
          :disabled="!canShow(plan.id)"
          :title="showTitle(plan)"
          @change="toggleShown(plan.id)"
        />
        <span class="item-name">{{ plan.name }}</span>
      </label>
      <span class="item-terms">{{
        describePlan(plan, inputs.loans.products, inputs.deposits.products)
      }}</span>
    </div>
  </section>

  <section class="field-group">
    <header class="section-head">
      <h3>{{ t('plansTab.ownTitle') }}</h3>
      <button type="button" @click="addPlan">{{ t('plansTab.addButton') }}</button>
    </header>
    <p v-if="inputs.plans.custom.length === 0" class="note">{{ t('plansTab.ownEmpty') }}</p>

    <div v-for="plan in inputs.plans.custom" :key="plan.id" class="own">
      <div class="own-head">
        <label class="show">
          <input
            type="checkbox"
            :checked="isShown(plan.id)"
            :disabled="!canShow(plan.id)"
            :title="showTitle(plan)"
            @change="toggleShown(plan.id)"
          />
        </label>
        <input
          v-model="plan.name"
          type="text"
          :aria-label="t('plansTab.nameAriaLabel', { id: plan.id })"
        />
        <button type="button" :title="t('plansTab.removeTitle')" @click="removePlan(plan.id)">
          {{ t('plansTab.removeButton') }}
        </button>
      </div>

      <label class="select-field">
        <span>{{ t('plansTab.loanLabel') }}</span>
        <select
          :value="plan.loan"
          @change="
            setLoan(plan, ($event.target as HTMLSelectElement).value as PurchasePlan['loan'])
          "
        >
          <option v-for="option in LOAN_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="select-field">
        <span>{{ t('plansTab.buyWhenLabel') }}</span>
        <select v-model="plan.buyWhen">
          <option v-for="option in buyWhenOptions(plan)" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="plan.buyWhen === 'after-months'" class="select-field">
        <span>{{ t('plansTab.saveMonthsLabel') }}</span>
        <input
          type="number"
          min="0"
          step="1"
          :value="plan.saveMonths ?? ''"
          @input="setSaveMonths(plan, $event)"
        />
        <span class="hint">{{ t('plansTab.saveMonthsHint') }}</span>
      </label>

      <template v-if="plan.loan !== 'none'">
        <label class="select-field">
          <span>{{ t('plansTab.borrowLabel') }}</span>
          <select v-model="plan.borrow">
            <option v-for="option in BORROW_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="select-field">
          <span>{{ t('plansTab.repayLabel') }}</span>
          <select v-model="plan.repay">
            <option v-for="option in REPAY_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </template>

      <label class="select-field">
        <span>{{ t('plansTab.housingLabel') }}</span>
        <select v-model="plan.situation">
          <option v-for="option in HOUSING_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="plan.situation === 'selling'" class="select-field">
        <span>{{ t('plansTab.saleMonthLabel') }}</span>
        <input v-model.number="plan.saleMonthOffset" type="number" min="0" step="1" />
        <span class="hint">{{ t('plansTab.saleMonthHint') }}</span>
      </label>
      <p v-if="!isCompatible(plan.id)" class="note">
        {{
          plan.situation === 'selling'
            ? t('plansTab.showNeedsApartment')
            : t('plansTab.showNeedsNoApartment')
        }}
      </p>

      <ProductPicker
        v-if="plan.loan !== 'otbasy'"
        v-model="plan.savingsProductId"
        :products="inputs.deposits.products"
        :label="t('plansTab.depositLabel')"
        :hint="t('plansTab.depositHint')"
      />

      <p class="item-terms">
        {{ describePlan(plan, inputs.loans.products, inputs.deposits.products) }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Everything else — .field-group, .note, .section-head, .built-in, .own,
   .own-head, .select-field, .item-name, .item-terms, .hint — comes from
   assets/forms.css. Only the show-checkbox row is specific to this tab. */
.show {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.show input {
  accent-color: var(--series-1);
}
.show input:disabled {
  cursor: not-allowed;
}
</style>
