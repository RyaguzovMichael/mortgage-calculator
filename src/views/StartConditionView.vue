<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { mdiFlashOutline } from '@mdi/js'
import { useInputs } from '@/app/useInputs'
import { useCountry } from '@/app/useCountry'
import { markOnboarded } from '@/infrastructure/onboardingPersistence'
import { buildDefaultInputs, hasExampleInputs } from '@/infrastructure/inputsStorage'
import {
  clearWizardStep,
  loadWizardStep,
  saveWizardStep,
} from '@/infrastructure/wizardProgressPersistence'
import WizardShell from '@/components/WizardShell.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PercentField from '@/components/inputs/PercentField.vue'
import MonthSelect from '@/components/inputs/MonthSelect.vue'
import MortgageShareField from '@/components/inputs/MortgageShareField.vue'
import PlansTab from '@/components/inputs/PlansTab.vue'
import AppIcon from '@/components/AppIcon.vue'

const { inputs } = useInputs()
const { t } = useI18n()
const { currencySymbol: currency, otbasyEnabled } = useCountry()
const router = useRouter()

// One id per screen; the wizard walks them in order. The body for each id is a
// v-if branch below, so field state survives Back/Next (it lives in `inputs`).
// The otbasy screen is skipped entirely in countries without the programme.
const STEPS = [
  'apartment',
  'appreciation',
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
const steps = (otbasyEnabled.value ? STEPS : STEPS.filter((step) => step !== 'otbasy')) as readonly Step[]

// Resume where a returning visitor left off — closing the tab mid-wizard (or the
// router guard bouncing them back to /start) used to always restart at screen 1,
// even though every field already typed in was sitting there, prefilled. Clamped
// in case a step was removed/reordered since the number was stored.
const savedStep = loadWizardStep()
const index = ref(savedStep !== null ? Math.min(savedStep, steps.length - 1) : 0)
watch(index, (value) => saveWizardStep(value))

const step = computed<Step>(() => steps[index.value]!)
const isFirst = computed(() => index.value === 0)
const isLast = computed(() => index.value === steps.length - 1)
const progress = computed(() =>
  t('startCondition.progress', { current: index.value + 1, total: steps.length }),
)

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
  clearWizardStep()
  router.push({ name: 'calculator' })
}

// A shortcut off the first screen for someone who just wants to see what the tool
// does before typing in their own numbers: load the shipped example figures and
// jump straight to the results, skipping the other screens. Only offered when the
// country ships an example in its meta.yml.
const exampleAvailable = hasExampleInputs()
function useExample(): void {
  Object.assign(inputs, structuredClone(buildDefaultInputs()))
  finish()
}
</script>

<template>
  <WizardShell
    :progress="progress"
    :title="t(`startCondition.${step}.title`)"
    :instruction="t(`startCondition.${step}.instruction`)"
    :is-first="isFirst"
    :is-last="isLast"
    :back-label="t('startCondition.back')"
    :next-label="t('startCondition.next')"
    :finish-label="t('startCondition.finish')"
    :wide="step === 'plans'"
    @back="back"
    @next="next"
  >
    <NumberField
      v-if="step === 'apartment'"
      v-model="inputs.apartment.price"
      :label="t('apartmentTab.priceLabel')"
      :suffix="currency"
      :step="500000"
    />

    <PercentField
      v-else-if="step === 'appreciation'"
      v-model="inputs.apartment.annualGrowthRate"
      :label="t('apartmentTab.growthLabel')"
      :step="1"
      :hint="t('apartmentTab.growthHint')"
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
        :suffix="currency"
        :step="500000"
        :hint="t('apartmentTab.existingPriceHint')"
      />
    </template>

    <NumberField
      v-else-if="step === 'salary'"
      v-model="inputs.cashflow.monthlySalary"
      :label="t('moneyTab.salaryLabel')"
      :suffix="currency"
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
      <div class="side-by-side">
        <PercentField
          v-model="inputs.cashflow.annualIndexationRate"
          :label="t('moneyTab.indexationLabel')"
          :step="1"
        />
        <MonthSelect v-model="inputs.cashflow.raiseMonth" :label="t('moneyTab.raiseMonthLabel')" />
      </div>
      <span class="hint">{{ t('moneyTab.indexationHint') }}</span>
    </template>

    <NumberField
      v-else-if="step === 'savings'"
      v-model="inputs.deposits.savingsBalance"
      :label="t('moneyTab.savingsLabel')"
      :suffix="currency"
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
          :suffix="currency"
          :step="10000"
        />
        <NumberField
          v-model="inputs.otbasy.accruedInterest"
          :label="t('moneyTab.otbasyAccruedLabel')"
          :suffix="currency"
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
      :suffix="currency"
      :step="50000"
      :hint="t('moneyTab.rentHint')"
    />

    <PlansTab v-else-if="step === 'plans'" />

    <template v-if="isFirst && exampleAvailable" #after-body>
      <button type="button" class="example-btn" @click="useExample">
        <AppIcon :path="mdiFlashOutline" :size="16" />
        {{ t('startCondition.useExample') }}
      </button>
    </template>
  </WizardShell>
</template>

<style scoped>
.side-by-side {
  display: flex;
  gap: 12px;
}
.side-by-side > * {
  flex: 1;
  min-width: 0;
}
.hint {
  display: block;
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.example-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: center;
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition);
}
.example-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
