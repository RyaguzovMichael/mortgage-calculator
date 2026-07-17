<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { money } from '@/app/format'
import { existingBalance } from '@/engine/types/inputs'
import TabBar from '../TabBar.vue'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import ProductPicker from './ProductPicker.vue'

const { inputs, reset } = useInputs()

// Grouped by what the number is *about*, not by which engine type holds it: the
// deposit rate for the sale money lives with the sale, because that is the
// decision it belongs to.
const TABS = [
  { id: 'apartment', label: 'Квартира' },
  { id: 'money', label: 'Деньги' },
  { id: 'loans', label: 'Ипотеки' },
  { id: 'run', label: 'Расчёт' },
] as const

type TabId = (typeof TABS)[number]['id']

const active = ref<TabId>('apartment')

// The one figure the model takes from the itemised accounts, shown so the sum is
// visible without adding the fields up by hand.
const existingTotal = computed(() => existingBalance(inputs))
</script>

<template>
  <aside class="panel">
    <header>
      <h2>Исходные данные</h2>
      <button type="button" @click="reset">Сбросить</button>
    </header>

    <TabBar v-model="active" :tabs="TABS" />

    <section v-show="active === 'apartment'">
      <h3>Квартира</h3>
      <NumberField v-model="inputs.apartment.price" label="Цена" suffix="₸" :step="500000" />
      <PercentField
        v-model="inputs.apartment.annualGrowthRate"
        label="Рост цены в год"
        :step="1"
        hint="Год к году: 12% = через год цена выше на 12%. Меняется ступенькой раз в полгода. Этой же ставкой индексируются аренда и цена вашей продаваемой квартиры. Подставляйте долгосрочное среднее, а не пиковый год: порог переворота выводов ≈ 9%, и в диапазоне 8–10% ответ определяется деталями модели, а не рынком. При росте > 0 сравнивайте по чистым активам, не по потере."
      />
    </section>

    <section v-show="active === 'apartment'">
      <h3>Продажа текущей квартиры</h3>
      <NumberField
        v-model="inputs.sale.proceeds"
        label="Сумма"
        suffix="₸"
        :step="500000"
        hint="Сколько ваша квартира стоит сегодня. Она дорожает вместе с рынком до месяца продажи — по той же ставке, что и покупаемая."
      />
      <NumberField
        v-model="inputs.sale.monthOffset"
        label="Месяц продажи"
        suffix="мес"
        hint="С этого месяца нужно съезжать: либо покупка, либо аренда."
      />
      <p class="note">
        Деньги от продажи идут на тот же вклад, что и всё остальное — он задаётся во вкладке
        «Деньги». Отдельной ставки у них нет.
      </p>
    </section>

    <section v-show="active === 'money'">
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

    <section v-show="active === 'money'">
      <h3>Вклад</h3>
      <ProductPicker
        v-model="inputs.deposits.savingsProductId"
        :products="inputs.deposits.products"
        label="Куда идут все деньги"
        hint="Один вклад на всё: сегодняшние накопления, деньги от продажи и ежемесячные взносы. В варианте Otbasy накопления вместо этого уходят на счёт Отбасы. Свой вклад добавляется во вкладке «Вклады»."
      />
    </section>

    <section v-show="active === 'money'">
      <h3>Накопления сегодня — {{ money(existingTotal) }} ₸</h3>
      <p class="note">
        В месяц 0 все счета закрываются и сливаются в один вклад — в вариантах Halyk и «без ипотеки»
        в выбранный выше, в варианте Otbasy на счёт Отбасы. Поэтому от них берётся только сумма:
        своя ставка и своя дата разблокировки уже ни на что не влияют.
      </p>
      <NumberField
        v-for="account in inputs.deposits.accounts"
        :key="account.id"
        v-model="account.balance"
        :label="account.label"
        suffix="₸"
        :step="10000"
      />
    </section>

    <section v-show="active === 'loans'">
      <h3>Halyk</h3>
      <PercentField v-model="inputs.halyk.annualRate" label="Ставка" :step="0.5" />
      <PercentField
        v-model="inputs.halyk.downPaymentFraction"
        label="Первый взнос от кредита"
        :step="5"
      />
      <NumberField v-model="inputs.halyk.maxTermMonths" label="Макс. срок" suffix="мес" />
    </section>

    <section v-show="active === 'loans'">
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

    <section v-show="active === 'run'">
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
  </aside>
</template>

<style scoped>
.panel {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h2 {
  font-size: var(--text-xl);
  margin: 0;
}
h3 {
  font-size: var(--text-md);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 0 0 8px;
}
section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.note {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
/* Scoped to the header: a bare `button` rule would also repaint the tabs, which
   need their own selected state. */
header button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
header button:hover {
  color: var(--text-primary);
}
</style>
