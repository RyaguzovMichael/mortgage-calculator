<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'

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
  </section>
</template>
