<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useInputs } from '@/app/useInputs'
import { markOnboarded } from '@/infrastructure/onboardingPersistence'
import WizardShell from '@/components/WizardShell.vue'
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
const progress = computed(() =>
  t('startCondition.progress', { current: index.value + 1, total: STEPS.length }),
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
  router.push({ name: 'calculator' })
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

    <PlansTab v-else-if="step === 'plans'" />
  </WizardShell>
</template>
