<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiClose } from '@mdi/js'
import { useInputs } from '@/app/useInputs'
import { useFormat, money } from '@/app/useFormat'
import type { PurchasePlan } from '@/engine/types/plan'
import AppIcon from '@/components/AppIcon.vue'

// A read-only look at what a plan is and how it turns out — opened by clicking a
// plan's name anywhere. No editing: that is the Edit button's job (custom plans) or
// Copy's (generated ones).
const props = defineProps<{ plan: PurchasePlan }>()
const emit = defineEmits<{ close: [] }>()

const { inputs, planOutcome } = useInputs()
const { t } = useI18n()
const {
  describePlan,
  loanLabel,
  monthsWord,
  BUY_WHEN_LABELS,
  BORROW_LABELS,
  REPAY_LABELS,
  TERM_LABELS,
  HOUSING_LABELS,
} = useFormat()

const plan = computed(() => props.plan)
const hasLoan = computed(() => plan.value.loan !== 'none')
const isOtbasy = computed(() => plan.value.loan === 'otbasy')

const whenText = computed(() => {
  if (plan.value.buyWhen === 'after-months') {
    return plan.value.saveMonths === null
      ? t('format.describePlanOtbasyWait')
      : t('format.describePlanAfterMonths', {
          n: plan.value.saveMonths,
          word: monthsWord(plan.value.saveMonths),
        })
  }
  return BUY_WHEN_LABELS.value[plan.value.buyWhen]
})

const depositName = computed(
  () =>
    inputs.deposits.products.find((product) => product.id === plan.value.savingsProductId)?.name ??
    plan.value.savingsProductId,
)

const outcome = computed(() => planOutcome(toPlain(plan.value)))
function toPlain(value: PurchasePlan): PurchasePlan {
  return JSON.parse(JSON.stringify(value)) as PurchasePlan
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <section class="dialog card" role="dialog" aria-modal="true">
      <header class="head">
        <h2>{{ plan.name }}</h2>
        <button
          type="button"
          class="icon-btn"
          :title="t('planDetails.close')"
          @click="emit('close')"
        >
          <AppIcon :path="mdiClose" :size="20" />
        </button>
      </header>

      <p class="summary">
        {{ describePlan(plan, inputs.loans.products, inputs.deposits.products) }}
      </p>

      <section class="block">
        <h3>{{ t('planDetails.decisions') }}</h3>
        <dl>
          <div class="pair">
            <dt>{{ t('plansTab.loanLabel') }}</dt>
            <dd>{{ loanLabel(plan.loan, inputs.loans.products) }}</dd>
          </div>
          <div v-if="!isOtbasy" class="pair">
            <dt>{{ t('plansTab.buyWhenLabel') }}</dt>
            <dd>{{ whenText }}</dd>
          </div>
          <template v-if="hasLoan">
            <div class="pair">
              <dt>{{ t('plansTab.borrowLabel') }}</dt>
              <dd>{{ BORROW_LABELS[plan.borrow] }}</dd>
            </div>
            <div class="pair">
              <dt>{{ t('plansTab.repayLabel') }}</dt>
              <dd>{{ REPAY_LABELS[plan.repay] }}</dd>
            </div>
            <div v-if="!isOtbasy" class="pair">
              <dt>{{ t('plansTab.termLabel') }}</dt>
              <dd>{{ TERM_LABELS[plan.term] }}</dd>
            </div>
          </template>
          <div class="pair">
            <dt>{{ t('plansTab.housingLabel') }}</dt>
            <dd>{{ HOUSING_LABELS[plan.situation] }}</dd>
          </div>
          <div v-if="plan.situation === 'selling'" class="pair">
            <dt>{{ t('plansTab.saleMonthLabel') }}</dt>
            <dd>{{ plan.saleMonthOffset }}</dd>
          </div>
          <div v-if="!isOtbasy" class="pair">
            <dt>{{ t('plansTab.depositLabel') }}</dt>
            <dd>{{ depositName }}</dd>
          </div>
        </dl>
      </section>

      <section class="block">
        <h3>{{ t('planDetails.outcomes') }}</h3>
        <p v-if="!outcome.bought" class="note">{{ t('planDetails.notBought') }}</p>
        <dl v-else>
          <div class="pair">
            <dt>{{ t('planDetails.purchaseMonth') }}</dt>
            <dd>{{ outcome.purchaseMonth }}</dd>
          </div>
          <div class="pair">
            <dt>{{ t('planDetails.purchasePrice') }}</dt>
            <dd>{{ money(outcome.purchasePrice ?? 0) }} ₸</dd>
          </div>
          <div class="pair">
            <dt>{{ t('planDetails.debtFree') }}</dt>
            <dd>{{ outcome.debtFreeMonth ?? t('planDetails.notCleared') }}</dd>
          </div>
          <div class="pair">
            <dt>{{ t('planDetails.netWorth') }}</dt>
            <dd>{{ money(outcome.netWorthAtHorizon) }} ₸</dd>
          </div>
        </dl>
      </section>

      <footer class="controls">
        <button type="button" class="primary" @click="emit('close')">
          {{ t('planDetails.close') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 16px 40px;
  overflow-y: auto;
  background: rgba(10, 12, 18, 0.72);
}
.dialog {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--shadow-lg);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.head h2 {
  font-size: var(--text-xl);
  margin: 0;
}
.icon-btn {
  display: flex;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition:
    color var(--transition),
    background var(--transition);
}
.icon-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
.summary {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block h3 {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.note {
  color: var(--text-muted);
  font-size: var(--text-md);
  margin: 0;
}
dl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
}
.pair {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border);
}
.pair dt {
  color: var(--text-secondary);
  font-size: var(--text-md);
}
.pair dd {
  margin: 0;
  text-align: right;
  color: var(--text-primary);
  font-size: var(--text-md);
  font-weight: 500;
}
.controls {
  display: flex;
  justify-content: flex-end;
}
.controls .primary {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 9px 20px;
  font: inherit;
  font-size: var(--text-md);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px var(--accent-glow);
}
</style>
