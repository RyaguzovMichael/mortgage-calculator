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
    <h3>{{ t('apartmentTab.title') }}</h3>
    <NumberField
      v-model="inputs.apartment.price"
      :label="t('apartmentTab.priceLabel')"
      suffix="₸"
      :step="500000"
    />
    <p class="note">{{ t('apartmentTab.note') }}</p>
    <PercentField
      v-model="inputs.apartment.annualGrowthRate"
      :label="t('apartmentTab.growthLabel')"
      :step="1"
      :hint="t('apartmentTab.growthHint')"
    />
  </section>

  <section class="field-group">
    <h3>{{ t('apartmentTab.existingTitle') }}</h3>
    <p class="note">{{ t('apartmentTab.existingNote') }}</p>

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
  </section>
</template>
