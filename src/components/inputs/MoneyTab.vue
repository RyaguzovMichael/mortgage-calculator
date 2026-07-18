<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import { money } from '@/app/useFormat'
import { startingMoney } from '@/engine/types/inputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import MonthSelect from './MonthSelect.vue'
import MortgageShareField from './MortgageShareField.vue'

const { inputs } = useInputs()
const { t } = useI18n()

// The one figure the model takes from the accounts, shown so the sum is visible
// without adding the fields up by hand.
const existingTotal = computed(() => startingMoney(inputs))
</script>

<template>
  <section class="field-group">
    <h3>{{ t('moneyTab.cashflowTitle') }}</h3>
    <NumberField
      v-model="inputs.cashflow.monthlySalary"
      :label="t('moneyTab.salaryLabel')"
      suffix="₸"
      :step="50000"
    />
    <MortgageShareField
      v-model="inputs.cashflow.mortgageShare"
      :salary="inputs.cashflow.monthlySalary"
      :percent-label="t('moneyTab.mortgageShareLabel')"
      :amount-label="t('moneyTab.mortgageAmountLabel')"
      :hint="t('moneyTab.mortgageShareHint')"
    />
    <PercentField
      v-model="inputs.cashflow.annualIndexationRate"
      :label="t('moneyTab.indexationLabel')"
      :step="1"
      :hint="t('moneyTab.indexationHint')"
    />
    <MonthSelect v-model="inputs.cashflow.raiseMonth" :label="t('moneyTab.raiseMonthLabel')" />
    <NumberField
      v-model="inputs.cashflow.monthlyRent"
      :label="t('moneyTab.rentLabel')"
      suffix="₸"
      :step="50000"
      :hint="t('moneyTab.rentHint')"
    />
  </section>

  <section class="field-group">
    <h3>{{ t('moneyTab.existingTitle', { amount: money(existingTotal) }) }}</h3>
    <p class="note">{{ t('moneyTab.existingNote') }}</p>
    <NumberField
      v-model="inputs.deposits.savingsBalance"
      :label="t('moneyTab.savingsLabel')"
      suffix="₸"
      :step="10000"
      :hint="t('moneyTab.savingsHint')"
    />

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
  </section>
</template>
