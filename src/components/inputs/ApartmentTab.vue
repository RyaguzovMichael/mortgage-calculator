<script setup lang="ts">
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'

const { inputs } = useInputs()
</script>

<template>
  <section class="field-group">
    <h3>Квартира</h3>
    <NumberField v-model="inputs.apartment.price" label="Цена" suffix="₸" :step="500000" />
    <p class="note">
      Где вы живёте до покупки и что продаёте — теперь решение плана, а не общая настройка: задаётся
      во вкладке «Планы» отдельно для каждого плана.
    </p>
  </section>
</template>
