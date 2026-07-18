<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import { money, colorForIndex, useFormat } from '@/app/useFormat'

const { inputs, allPlans } = useInputs()
const { t, tm, rt } = useI18n()
const { describePlan } = useFormat()

const monthNames = computed(() => tm('common.monthNames') as unknown[])
const raiseMonthName = computed(() =>
  rt(monthNames.value[inputs.cashflow.raiseMonth - 1] as string),
)

function percent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`
}

const shownPlans = computed(() =>
  inputs.plans.shown
    .map((id, index) => ({ index, plan: allPlans.value.find((candidate) => candidate.id === id) }))
    .filter((entry): entry is { index: number; plan: NonNullable<(typeof entry)['plan']> } =>
      Boolean(entry.plan),
    ),
)
</script>

<template>
  <aside class="panel card">
    <section class="field-group">
      <header class="section-head">
        <h3>{{ t('selectionSummary.conditionsTitle') }}</h3>
        <RouterLink to="/conditions" class="edit-link">{{ t('selectionSummary.edit') }}</RouterLink>
      </header>

      <dl class="rows">
        <div class="row">
          <dt>{{ t('apartmentTab.priceLabel') }}</dt>
          <dd>{{ money(inputs.apartment.price) }} ₸</dd>
        </div>
        <div class="row">
          <dt>{{ t('apartmentTab.ownedToggle') }}</dt>
          <dd>
            {{
              inputs.existingApartment.owned ? money(inputs.existingApartment.price) + ' ₸' : '—'
            }}
          </dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.salaryLabel') }}</dt>
          <dd>{{ money(inputs.cashflow.monthlySalary) }} ₸</dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.mortgageShareLabel') }}</dt>
          <dd>{{ percent(inputs.cashflow.mortgageShare) }}</dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.indexationLabel') }}</dt>
          <dd>{{ percent(inputs.cashflow.annualIndexationRate) }}</dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.raiseMonthLabel') }}</dt>
          <dd>{{ raiseMonthName }}</dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.rentLabel') }}</dt>
          <dd>{{ money(inputs.cashflow.monthlyRent) }} ₸</dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.savingsLabel') }}</dt>
          <dd>{{ money(inputs.deposits.savingsBalance) }} ₸</dd>
        </div>
        <div class="row">
          <dt>{{ t('moneyTab.otbasyToggle') }}</dt>
          <dd>{{ inputs.otbasy.hasDeposit ? money(inputs.otbasy.balance) + ' ₸' : '—' }}</dd>
        </div>
      </dl>
    </section>

    <section class="field-group">
      <header class="section-head">
        <h3>{{ t('selectionSummary.variantsTitle') }}</h3>
        <RouterLink to="/plans" class="edit-link">{{ t('selectionSummary.edit') }}</RouterLink>
      </header>

      <p v-if="shownPlans.length === 0" class="note">{{ t('selectionSummary.noVariants') }}</p>
      <div v-for="entry in shownPlans" :key="entry.plan.id" class="variant">
        <span class="dot" :style="{ background: colorForIndex(entry.index) }"></span>
        <div class="variant-text">
          <span class="item-name">{{ entry.plan.name }}</span>
          <span class="item-terms">{{
            describePlan(entry.plan, inputs.loans.products, inputs.deposits.products)
          }}</span>
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.edit-link {
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: nowrap;
}
.edit-link:hover {
  color: var(--text-primary);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}
.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.row dt {
  color: var(--text-secondary);
  font-size: var(--text-md);
}
.row dd {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.variant {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
}
.variant-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
</style>
