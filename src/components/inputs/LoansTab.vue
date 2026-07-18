<script setup lang="ts">
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'

const { inputs } = useInputs()
</script>

<template>
  <section class="field-group">
    <h3>Halyk</h3>
    <PercentField v-model="inputs.halyk.annualRate" label="Ставка" :step="0.5" />
    <PercentField
      v-model="inputs.halyk.downPaymentFraction"
      label="Первый взнос от кредита"
      :step="5"
    />
    <NumberField v-model="inputs.halyk.maxTermMonths" label="Макс. срок" suffix="мес" />
  </section>

  <section class="field-group">
    <h3>Otbasy</h3>
    <PercentField v-model="inputs.otbasy.loanAnnualRate" label="Ставка кредита" :step="0.5" />
    <PercentField v-model="inputs.otbasy.depositAnnualRate" label="Ставка депозита" />
    <NumberField
      v-model="inputs.otbasy.seedFromSale"
      label="Засев из денег от продажи"
      suffix="₸"
      :step="500000"
      hint="Без засева порог 50% набирается годами и аренда съедает всё."
    />
    <PercentField
      v-model="inputs.otbasy.minBalanceFraction"
      label="Порог: % от цел. кредита"
      :step="5"
    />
    <NumberField v-model="inputs.otbasy.ccTarget" label="Целевой CC" :step="0.5" />
    <PercentField v-model="inputs.otbasy.govBonusRate" label="Гос. премия" :step="5" />
    <NumberField v-model="inputs.otbasy.govBonusCap" label="Лимит премии в год" suffix="₸" :step="5000" />
    <NumberField v-model="inputs.otbasy.govBonusMonth" label="Месяц премии" hint="2 = февраль" />
  </section>
</template>
