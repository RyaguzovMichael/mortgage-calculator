<script setup lang="ts">
import { computed } from 'vue'
import { useInputs } from '@/app/useInputs'
import { money } from '@/app/format'
import { startingMoney } from '@/engine/types/inputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import ProductPicker from './ProductPicker.vue'

const { inputs } = useInputs()

// The one figure the model takes from the accounts, shown so the sum is visible
// without adding the fields up by hand.
const existingTotal = computed(() => startingMoney(inputs))
</script>

<template>
  <section class="field-group">
    <h3>Денежный поток</h3>
    <NumberField
      v-model="inputs.cashflow.monthlyFreeCash"
      label="Свободно в месяц"
      suffix="₸"
      :step="50000"
    />
    <PercentField
      v-model="inputs.cashflow.annualIndexationRate"
      label="Индексация дохода в год"
      :step="1"
      hint="Свободный поток растёт одной ступенькой раз в год, в июне (первая — июнь 2027). Отдельно от рынка жилья: зарплата идёт за зарплатами, а не за ценами квартир."
    />
    <NumberField
      v-model="inputs.cashflow.monthlyRent"
      label="Аренда в месяц"
      suffix="₸"
      :step="50000"
      hint="Платится только пока квартира продана, а новая не куплена. Индексируется по ставке роста цены квартиры — это цена того же рынка, своего параметра у неё нет."
    />
    <NumberField
      v-model="inputs.cashflow.startMonthOffset"
      label="Поток начинается с месяца"
      suffix="мес"
    />
  </section>

  <section class="field-group">
    <h3>Вклад</h3>
    <ProductPicker
      v-model="inputs.deposits.savingsProductId"
      :products="inputs.deposits.products"
      label="Куда идут все деньги"
      hint="Один вклад на всё: сегодняшние накопления, деньги от продажи и ежемесячные взносы. В варианте Otbasy накопления вместо этого уходят на счёт Отбасы. Свой вклад добавляется во вкладке «Вклады»."
    />
  </section>

  <section class="field-group">
    <h3>Накопления сегодня — {{ money(existingTotal) }} ₸</h3>
    <p class="note">
      В месяц 0 всё сливается в один вклад — в вариантах Halyk и «без ипотеки» в выбранный выше,
      в варианте Otbasy на счёт Отбасы. Поэтому важна только сумма, а не то, в каком банке она
      лежит сегодня. Отдельно от неё стоит только Отбасы: у него свои проценты и свой CC.
    </p>
    <NumberField
      v-model="inputs.deposits.savingsBalance"
      label="Свободные накопления"
      suffix="₸"
      :step="10000"
      hint="Всё, что не на счету Отбасы, одной суммой."
    />

    <label class="toggle">
      <input v-model="inputs.otbasy.hasDeposit" type="checkbox" />
      <span>У меня есть депозит Отбасы</span>
    </label>

    <template v-if="inputs.otbasy.hasDeposit">
      <NumberField v-model="inputs.otbasy.balance" label="Баланс Отбасы" suffix="₸" :step="10000" />
      <NumberField
        v-model="inputs.otbasy.accruedInterest"
        label="Из них накопленные проценты"
        suffix="₸"
        :step="1000"
        hint="Сколько банк начислил за всё время. Именно из этого считается CC, поэтому старт с нуля отодвигал бы порог CC ≥ 5 дальше, чем он есть на самом деле. Не прибавляется к деньгам — они уже внутри баланса."
      />
      <NumberField
        v-model="inputs.otbasy.monthsOpen"
        label="Уже коплю"
        suffix="мес"
        hint="Пока ни на что не влияет — записывается на будущее, под минимальный срок накопления Отбасы."
      />
    </template>
  </section>
</template>
