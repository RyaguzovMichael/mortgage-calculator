<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { money, productTerms } from '@/app/format'
import { startingMoney } from '@/engine/types/inputs'
import { isBuiltInProduct } from '@/infrastructure/depositCatalogue'
import TabBar from '../TabBar.vue'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import ProductPicker from './ProductPicker.vue'
import PlansTab from './PlansTab.vue'

const { inputs, reset, addProduct, removeProduct, canRemoveProduct } = useInputs()

// Split by where the deposit comes from, not by a stored flag: the file decides.
const builtInProducts = computed(() => inputs.deposits.products.filter((p) => isBuiltInProduct(p.id)))
const ownProducts = computed(() => inputs.deposits.products.filter((p) => !isBuiltInProduct(p.id)))

// Grouped by what the number is *about*, not by which engine type holds it: the
// deposit rate for the sale money lives with the sale, because that is the
// decision it belongs to.
const TABS = [
  { id: 'apartment', label: 'Квартира' },
  { id: 'money', label: 'Деньги' },
  { id: 'deposits', label: 'Вклады' },
  { id: 'plans', label: 'Планы' },
  { id: 'loans', label: 'Ипотеки' },
  { id: 'run', label: 'Расчёт' },
] as const

type TabId = (typeof TABS)[number]['id']

const active = ref<TabId>('apartment')

const HOUSING_OPTIONS = [
  { id: 'selling', label: 'Продаю свою квартиру' },
  { id: 'free', label: 'Не продаю, живу бесплатно' },
  { id: 'renting', label: 'Не продаю, снимаю с месяца 0' },
] as const

// The one figure the model takes from these fields, shown so the sum is
// visible without adding the fields up by hand.
const existingTotal = computed(() => startingMoney(inputs))
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
        <NumberField
          v-model="inputs.otbasy.balance"
          label="Баланс Отбасы"
          suffix="₸"
          :step="10000"
        />
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

    <section v-show="active === 'deposits'">
      <h3>Встроенные вклады</h3>
      <p class="note">
        Из файла <code>data/deposits.yml</code>. Их нельзя изменить или удалить — правятся в файле,
        и правка доезжает до всех.
      </p>
      <div v-for="product in builtInProducts" :key="product.id" class="built-in">
        <span class="product-name">{{ product.name }}</span>
        <span class="product-terms">{{ productTerms(product) }}</span>
      </div>
    </section>

    <section v-show="active === 'deposits'">
      <header class="section-head">
        <h3>Свои вклады</h3>
        <button type="button" @click="addProduct">+ Добавить</button>
      </header>
      <p v-if="ownProducts.length === 0" class="note">
        Пока ничего. Добавьте вклад, если у вас есть предложение банка, которого нет выше — и
        выберите его основным во вкладке «Деньги».
      </p>
      <div v-for="product in ownProducts" :key="product.id" class="own">
        <div class="own-head">
          <input v-model="product.name" type="text" :aria-label="`Название вклада ${product.id}`" />
          <button
            type="button"
            :disabled="!canRemoveProduct(product.id)"
            :title="
              canRemoveProduct(product.id)
                ? 'Удалить вклад'
                : 'Нельзя удалить: сейчас на него идут все деньги'
            "
            @click="removeProduct(product.id)"
          >
            Удалить
          </button>
        </div>
        <PercentField v-model="product.annualRate" label="Ставка" />
        <NumberField
          v-model="product.payoutPeriodMonths"
          label="Выплата раз в"
          suffix="мес"
          hint="1 = снятие в любой момент без потерь. Больше — проценты сгорают при снятии до выплаты."
        />
        <p class="note">{{ productTerms(product) }}</p>
      </div>
    </section>

    <PlansTab v-show="active === 'plans'" />

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
code {
  font-family: var(--mono);
}
.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-md);
  color: var(--text-secondary);
  cursor: pointer;
}
.toggle input {
  accent-color: var(--series-1);
}
.radio-list {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.radio-list legend {
  color: var(--text-secondary);
  font-size: var(--text-md);
  padding: 0 4px;
}
.radio-list .option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--text-md);
  cursor: pointer;
}
.radio-list .option input {
  margin-top: 3px;
  accent-color: var(--series-1);
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.section-head h3 {
  margin: 0;
}
.built-in,
.own {
  border-left: 2px solid var(--border);
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.own {
  gap: 8px;
  padding-bottom: 10px;
}
.product-name {
  font-size: var(--text-lg);
}
.product-terms {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.own-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.own-head input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-lg);
}
.own-head input:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -1px;
}
.section-head button,
.own-head button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  white-space: nowrap;
}
.section-head button:hover:not(:disabled),
.own-head button:hover:not(:disabled) {
  color: var(--text-primary);
}
.own-head button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
