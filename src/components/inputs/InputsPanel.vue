<script setup lang="ts">
import { useInputs } from '@/app/useInputs'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import ProductPicker from './ProductPicker.vue'

const { inputs, reset } = useInputs()
</script>

<template>
  <aside class="panel">
    <header>
      <h2>Исходные данные</h2>
      <button type="button" @click="reset">Сбросить</button>
    </header>

    <section>
      <h3>Квартира</h3>
      <NumberField v-model="inputs.apartment.price" label="Цена" suffix="₸" :step="500000" />
      <PercentField
        v-model="inputs.apartment.annualGrowthRate"
        label="Рост цены в год"
        :step="1"
        hint="Год к году: 12% = через год цена выше на 12%. Меняется ступенькой раз в полгода. Этой же ставкой индексируются аренда и цена вашей продаваемой квартиры. Подставляйте долгосрочное среднее, а не пиковый год: порог переворота выводов ≈ 9%, и в диапазоне 8–10% ответ определяется деталями модели, а не рынком. При росте > 0 сравнивайте по чистым активам, не по потере."
      />
    </section>

    <section>
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
      <ProductPicker
        v-model:rate="inputs.sale.depositAnnualRate"
        v-model:payout-period="inputs.sale.depositPayoutPeriodMonths"
        label="Куда положить деньги от продажи"
        hint="Самая крупная сумма в модели — она же сильнее всех страдает от сгорания процентов при покупке в середине периода."
      />
      <PercentField v-model="inputs.sale.depositAnnualRate" label="Ставка" />
      <NumberField
        v-model="inputs.sale.depositPayoutPeriodMonths"
        label="Выплата процентов раз в"
        suffix="мес"
      />
    </section>

    <section>
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

    <section>
      <h3>Новые накопления</h3>
      <ProductPicker
        v-model:rate="inputs.deposits.newDepositAnnualRate"
        v-model:payout-period="inputs.deposits.newDepositPayoutPeriodMonths"
        label="Куда идут ежемесячные взносы"
      />
      <PercentField v-model="inputs.deposits.newDepositAnnualRate" label="Ставка" />
      <NumberField
        v-model="inputs.deposits.newDepositPayoutPeriodMonths"
        label="Выплата процентов раз в"
        suffix="мес"
      />
    </section>

    <section>
      <h3>Существующие вклады</h3>
      <p class="note">
        Счёт Отбасы работает только в варианте Otbasy. В остальных трёх он закрывается в месяц 0 и
        переносится в Kaspi: без кредита Отбасы его 2% — просто худшая ставка.
      </p>
      <div v-for="account in inputs.deposits.accounts" :key="account.id" class="account">
        <h4>{{ account.label }}</h4>
        <NumberField v-model="account.balance" label="Баланс" suffix="₸" :step="10000" />
        <PercentField v-model="account.annualRate" label="Ставка" />
        <NumberField v-model="account.payoutPeriodMonths" label="Выплата раз в" suffix="мес" />
        <NumberField v-model="account.unlockMonthOffset" label="Разблокирован с месяца" suffix="мес" />
      </div>
    </section>

    <section>
      <h3>Halyk</h3>
      <PercentField v-model="inputs.halyk.annualRate" label="Ставка" :step="0.5" />
      <PercentField
        v-model="inputs.halyk.downPaymentFraction"
        label="Первый взнос от кредита"
        :step="5"
      />
      <NumberField v-model="inputs.halyk.maxTermMonths" label="Макс. срок" suffix="мес" />
    </section>

    <section>
      <h3>Otbasy</h3>
      <PercentField v-model="inputs.otbasy.loanAnnualRate" label="Ставка кредита" :step="0.5" />
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

    <section>
      <h3>Расчёт</h3>
      <NumberField v-model="inputs.horizonMonths" label="Горизонт" suffix="мес" />
      <NumberField
        v-model="inputs.start.year"
        label="Старт: год"
      />
      <NumberField v-model="inputs.start.month" label="Старт: месяц" />
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
  font-size: 15px;
  margin: 0;
}
h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 0 0 8px;
}
h4 {
  font-size: 12px;
  margin: 0 0 6px;
  color: var(--text-secondary);
}
section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.note {
  color: var(--text-muted);
  font-size: 11px;
  margin: 0;
}
.account {
  border-left: 2px solid var(--border);
  padding-left: 10px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
button:hover {
  color: var(--text-primary);
}
</style>
