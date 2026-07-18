<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'

const { inputs } = useInputs()
const { t } = useI18n()
</script>

<template>
  <section class="field-group">
    <h3>{{ t('loansTab.halykTitle') }}</h3>
    <PercentField
      v-model="inputs.halyk.annualRate"
      :label="t('loansTab.halykRateLabel')"
      :step="0.5"
    />
    <PercentField
      v-model="inputs.halyk.downPaymentFraction"
      :label="t('loansTab.halykDownPaymentLabel')"
      :step="5"
    />
    <NumberField
      v-model="inputs.halyk.maxTermMonths"
      :label="t('loansTab.halykMaxTermLabel')"
      :suffix="t('common.monthsSuffix')"
    />
  </section>

  <section class="field-group">
    <h3>{{ t('loansTab.otbasyTitle') }}</h3>
    <PercentField
      v-model="inputs.otbasy.loanAnnualRate"
      :label="t('loansTab.otbasyLoanRateLabel')"
      :step="0.5"
    />
    <PercentField
      v-model="inputs.otbasy.depositAnnualRate"
      :label="t('loansTab.otbasyDepositRateLabel')"
    />
    <NumberField
      v-model="inputs.otbasy.seedFromSale"
      :label="t('loansTab.otbasySeedLabel')"
      suffix="₸"
      :step="500000"
      :hint="t('loansTab.otbasySeedHint')"
    />
    <PercentField
      v-model="inputs.otbasy.minBalanceFraction"
      :label="t('loansTab.otbasyMinBalanceLabel')"
      :step="5"
    />
    <NumberField
      v-model="inputs.otbasy.ccTarget"
      :label="t('loansTab.otbasyCcTargetLabel')"
      :step="0.5"
    />
    <PercentField
      v-model="inputs.otbasy.govBonusRate"
      :label="t('loansTab.otbasyGovBonusRateLabel')"
      :step="5"
    />
    <NumberField
      v-model="inputs.otbasy.govBonusCap"
      :label="t('loansTab.otbasyGovBonusCapLabel')"
      suffix="₸"
      :step="5000"
    />
    <NumberField
      v-model="inputs.otbasy.govBonusMonth"
      :label="t('loansTab.otbasyGovBonusMonthLabel')"
      :hint="t('loansTab.otbasyGovBonusMonthHint')"
    />
  </section>
</template>
