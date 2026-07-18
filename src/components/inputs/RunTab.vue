<script setup lang="ts">
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'

const { inputs } = useInputs()
</script>

<template>
  <section class="field-group">
    <h3>Расчёт</h3>
    <NumberField
      v-model="inputs.horizonMonths"
      label="Горизонт"
      suffix="мес"
      hint="Только потолок: расчёт всё равно обрывается, когда последний вариант гасит долг. Поднимать имеет смысл, если кто-то не успевает расплатиться."
    />
    <NumberField v-model="inputs.start.year" label="Старт: год" />
    <NumberField v-model="inputs.start.month" label="Старт: месяц" hint="7 = июль." />
  </section>
</template>
