<script setup lang="ts">
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'

const { inputs } = useInputs()

const HOUSING_OPTIONS = [
  { id: 'selling', label: 'Продаю свою квартиру' },
  { id: 'free', label: 'Не продаю, живу бесплатно' },
  { id: 'renting', label: 'Не продаю, снимаю с месяца 0' },
] as const
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
  </section>

  <section class="field-group">
    <h3>Жильё сейчас</h3>
    <fieldset class="radio-list">
      <legend>Где вы живёте, пока не купили</legend>
      <label v-for="option in HOUSING_OPTIONS" :key="option.id" class="option">
        <input
          v-model="inputs.housing.situation"
          type="radio"
          name="housing-situation"
          :value="option.id"
        />
        <span>{{ option.label }}</span>
      </label>
    </fieldset>

    <template v-if="inputs.housing.situation === 'selling'">
      <NumberField
        v-model="inputs.housing.saleProceeds"
        label="Сумма продажи"
        suffix="₸"
        :step="500000"
        hint="Сколько ваша квартира стоит сегодня. Она дорожает вместе с рынком до месяца продажи — по той же ставке, что и покупаемая. Деньги от продажи идут на тот же вклад, что и всё остальное."
      />
      <NumberField
        v-model="inputs.housing.saleMonthOffset"
        label="Месяц продажи"
        suffix="мес"
        hint="С этого месяца нужно съезжать: либо покупка, либо аренда."
      />
    </template>
    <p v-else-if="inputs.housing.situation === 'renting'" class="note">
      Снимаете с месяца 0 и до покупки. Аренда задаётся во вкладке «Деньги». Продавать нечего —
      первоначальный взнос собирается только из накоплений и потока.
    </p>
    <p v-else class="note">
      Живёте где-то бесплатно до покупки — аренды нет вообще. Продавать нечего: взнос из накоплений
      и потока.
    </p>
  </section>
</template>
