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
import PlansTab from '@/components/inputs/PlansTab.vue'

const { inputs } = useInputs()
const { t } = useI18n()
const router = useRouter()

// One id per screen; the wizard walks them in order. The body for each id is a
// v-if branch below, so field state survives Back/Next (it lives in `inputs`).
const STEPS = [
  'apartment',
  'existing',
  'salary',
  'share',
  'growth',
  'savings',
  'otbasy',
  'rent',
  // The last screen is not a start condition but the pay-off: now that the
  // conditions are set, choose which plans to compare and, if you like, build one.
  'plans',
] as const
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
    <section class="wizard card" :class="{ wide: step === 'plans' }">
      <p class="progress">
        {{ t('startCondition.progress', { current: index + 1, total: STEPS.length }) }}
      </p>

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
          <MonthSelect
            v-model="inputs.cashflow.raiseMonth"
            :label="t('moneyTab.raiseMonthLabel')"
          />
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

        <PlansTab v-else-if="step === 'plans'" />
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
/* The plans step is a list of rows, not a single field — give it room to breathe. */
.wizard.wide {
  max-width: 680px;
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
  border-radius: var(--radius-sm);
  padding: 9px 20px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border: 1px solid var(--border);
  transition:
    color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
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
  border-color: var(--accent);
}
.primary {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  border-color: transparent;
  font-weight: 600;
  box-shadow: 0 4px 14px var(--accent-glow);
}
.primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px var(--accent-glow);
  transform: var(--lift);
}
</style>
