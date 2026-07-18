<script setup lang="ts">
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'

const { inputs } = useInputs()
</script>

<template>
  <section class="field-group">
    <h3>Квартира</h3>
    <NumberField v-model="inputs.apartment.price" label="Цена" suffix="₸" :step="500000" />
    <PercentField
      v-model="inputs.apartment.annualGrowthRate"
      label="Рост цены в год"
      :step="1"
      hint="Год к году: 12% = через год цена выше на 12%. Меняется ступенькой раз в полгода. Этой же ставкой индексируются аренда и цена вашей продаваемой квартиры. Подставляйте долгосрочное среднее, а не пиковый год: порог переворота выводов ≈ 9%, и в диапазоне 8–10% ответ определяется деталями модели, а не рынком. При росте > 0 сравнивайте по чистым активам, не по потере."
    />
    <p class="note">
      Где вы живёте до покупки и что продаёте — теперь решение плана, а не общая настройка: задаётся
      во вкладке «Планы» отдельно для каждого плана.
    </p>
  </section>
</template>
