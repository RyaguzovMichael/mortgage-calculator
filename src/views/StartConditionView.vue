<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useInputs } from '@/app/useInputs'
import { markOnboarded } from '@/infrastructure/onboardingPersistence'
import NumberField from '@/components/inputs/NumberField.vue'
import PercentField from '@/components/inputs/PercentField.vue'
import MonthSelect from '@/components/inputs/MonthSelect.vue'
import MortgageShareField from '@/components/inputs/MortgageShareField.vue'

const { inputs } = useInputs()
const { t } = useI18n()
const router = useRouter()

// One id per screen; the wizard walks them in order. The body for each id is a
// v-if branch below, so field state survives Back/Next (it lives in `inputs`).
const STEPS = ['apartment', 'existing', 'salary', 'share', 'growth', 'savings', 'otbasy', 'rent'] as const
type Step = (typeof STEPS)[number]

const index = ref(0)
const step = computed<Step>(() => STEPS[index.value]!)
const isFirst = computed(() => index.value === 0)
const isLast = computed(() => index.value === STEPS.length - 1)

function back(): void {
  if (!isFirst.value) index.value -= 1
}

function next(): void {
  if (isLast.value) finish()
  else index.value += 1
}

// Finishing is the only thing that marks onboarding done — the wizard's edits have
// been auto-saving all along, so all that remains is to flip the flag and leave.
function finish(): void {
  markOnboarded()
  router.push({ name: 'calculator' })
}
</script>

<template>
  <main class="layout">
    <section class="wizard card">
      <p class="progress">{{ t('startCondition.progress', { current: index + 1, total: STEPS.length }) }}</p>

      <h1>{{ t(`startCondition.${step}.title`) }}</h1>
      <p class="instruction">{{ t(`startCondition.${step}.instruction`) }}</p>

      <div class="body">
        <NumberField
          v-if="step === 'apartment'"
          v-model="inputs.apartment.price"
          :label="t('apartmentTab.priceLabel')"
          suffix="₸"
          :step="500000"
        />

        <template v-else-if="step === 'existing'">
          <label class="toggle">
            <input v-model="inputs.existingApartment.owned" type="checkbox" />
            <span>{{ t('apartmentTab.ownedToggle') }}</span>
          </label>
          <NumberField
            v-if="inputs.existingApartment.owned"
            v-model="inputs.existingApartment.price"
            :label="t('apartmentTab.existingPriceLabel')"
            suffix="₸"
            :step="500000"
            :hint="t('apartmentTab.existingPriceHint')"
          />
        </template>

        <NumberField
          v-else-if="step === 'salary'"
          v-model="inputs.cashflow.monthlySalary"
          :label="t('moneyTab.salaryLabel')"
          suffix="₸"
          :step="50000"
        />

        <MortgageShareField
          v-else-if="step === 'share'"
          v-model="inputs.cashflow.mortgageShare"
          :salary="inputs.cashflow.monthlySalary"
          :percent-label="t('moneyTab.mortgageShareLabel')"
          :amount-label="t('moneyTab.mortgageAmountLabel')"
          :hint="t('moneyTab.mortgageShareHint')"
        />

        <template v-else-if="step === 'growth'">
          <PercentField
            v-model="inputs.cashflow.annualIndexationRate"
            :label="t('moneyTab.indexationLabel')"
            :step="1"
            :hint="t('moneyTab.indexationHint')"
          />
          <MonthSelect v-model="inputs.cashflow.raiseMonth" :label="t('moneyTab.raiseMonthLabel')" />
        </template>

        <NumberField
          v-else-if="step === 'savings'"
          v-model="inputs.deposits.savingsBalance"
          :label="t('moneyTab.savingsLabel')"
          suffix="₸"
          :step="10000"
          :hint="t('moneyTab.savingsHint')"
        />

        <template v-else-if="step === 'otbasy'">
          <label class="toggle">
            <input v-model="inputs.otbasy.hasDeposit" type="checkbox" />
            <span>{{ t('moneyTab.otbasyToggle') }}</span>
          </label>
          <template v-if="inputs.otbasy.hasDeposit">
            <NumberField
              v-model="inputs.otbasy.balance"
              :label="t('moneyTab.otbasyBalanceLabel')"
              suffix="₸"
              :step="10000"
            />
            <NumberField
              v-model="inputs.otbasy.accruedInterest"
              :label="t('moneyTab.otbasyAccruedLabel')"
              suffix="₸"
              :step="1000"
              :hint="t('moneyTab.otbasyAccruedHint')"
            />
            <NumberField
              v-model="inputs.otbasy.monthsOpen"
              :label="t('moneyTab.otbasyMonthsLabel')"
              :suffix="t('common.monthsSuffix')"
              :hint="t('moneyTab.otbasyMonthsHint')"
            />
          </template>
        </template>

        <NumberField
          v-else-if="step === 'rent'"
          v-model="inputs.cashflow.monthlyRent"
          :label="t('moneyTab.rentLabel')"
          suffix="₸"
          :step="50000"
          :hint="t('moneyTab.rentHint')"
        />
      </div>

      <footer class="controls">
        <button type="button" class="secondary" :disabled="isFirst" @click="back">
          {{ t('startCondition.back') }}
        </button>
        <button type="button" class="primary" @click="next">
          {{ isLast ? t('startCondition.finish') : t('startCondition.next') }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 20px;
  overflow-y: auto;
}
.wizard {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.progress {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
h1 {
  font-size: var(--text-xl);
  margin: 0;
}
.instruction {
  color: var(--text-secondary);
  font-size: var(--text-md);
  margin: 0;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 96px;
}
.controls {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
button {
  border-radius: 6px;
  padding: 8px 18px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border: 1px solid var(--border);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.secondary:hover:not(:disabled) {
  color: var(--text-primary);
}
.primary {
  background: var(--series-1);
  color: var(--surface-1);
  border-color: var(--series-1);
}
</style>
