<script setup lang="ts">
import { computed } from 'vue'
import { useInputs } from '@/app/useInputs'
import { money, VARIANT_COLORS, VARIANT_LABELS } from '@/app/format'

const { inputs, report } = useInputs()

// totalLoss assumes every variant ends up with the same apartment so its price
// cancels out. Once the price moves, they buy in different months at different
// prices and it quietly mis-ranks — so say so rather than show it bare.
const lossIsValid = computed(() => inputs.apartment.annualGrowthRate === 0)

const ranked = computed(() =>
  [...report.value.variants].sort(
    (left, right) => right.totals.netWorthAtHorizon - left.totals.netWorthAtHorizon,
  ),
)

function months(value: number | null): string {
  return value === null ? '—' : `${value}`
}
</script>

<template>
  <section class="card">
    <header>
      <h2>Сравнение вариантов</h2>
      <p class="sub">
        Целевой кредит {{ money(report.targetLoan) }} ₸ · горизонт {{ inputs.horizonMonths }} мес
      </p>
    </header>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th class="left">Вариант</th>
            <th>Покупка</th>
            <th>Без долга</th>
            <th>Аренда</th>
            <th>% кредита</th>
            <th>Доход с вкладов</th>
            <th>Гос. премия</th>
            <th :class="{ dim: !lossIsValid }">Потеря</th>
            <th class="primary">Чистые активы</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="variant in ranked" :key="variant.id" :class="{ best: variant.id === report.bestVariant }">
            <td class="left">
              <span class="swatch" :style="{ background: VARIANT_COLORS[variant.id] }" />
              {{ VARIANT_LABELS[variant.id] }}
            </td>
            <td>{{ months(variant.purchaseMonth) }}</td>
            <td>{{ months(variant.debtFreeMonth) }}</td>
            <td>{{ money(variant.totals.rentPaid) }}</td>
            <td>{{ money(variant.totals.loanInterestPaid) }}</td>
            <td>{{ money(variant.totals.depositInterestEarned) }}</td>
            <td>{{ money(variant.totals.govBonusReceived) }}</td>
            <td :class="{ dim: !lossIsValid }">{{ money(variant.totals.totalLoss) }}</td>
            <td class="primary">{{ money(variant.totals.netWorthAtHorizon) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!lossIsValid" class="warning">
      Рост цены {{ (inputs.apartment.annualGrowthRate * 100).toFixed(1) }}%/год — колонка «потеря»
      больше не сравнима: варианты покупают в разные месяцы по разной цене, и цена квартиры
      перестаёт сокращаться. Ориентируйтесь на чистые активы.
    </p>
    <p v-else class="note">
      Отрицательная потеря = вы в плюсе: доход с вкладов перекрыл аренду и проценты банку.
    </p>
  </section>
</template>

<style scoped>
.card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
header {
  margin-bottom: 10px;
}
h2 {
  font-size: 15px;
  margin: 0;
}
.sub {
  color: var(--text-muted);
  font-size: 12px;
  margin: 2px 0 0;
}
.scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
th,
td {
  padding: 7px 10px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
th {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
td {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
.left {
  text-align: left;
}
td.left {
  font-family: var(--font);
}
.primary {
  font-weight: 600;
  color: var(--text-primary);
}
.dim {
  color: var(--text-muted);
  text-decoration: line-through;
}
.best td {
  background: color-mix(in srgb, var(--good) 10%, transparent);
}
.swatch {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 7px;
}
.warning,
.note {
  font-size: 12px;
  margin: 10px 0 0;
  color: var(--text-secondary);
}
.warning {
  border-left: 2px solid var(--critical);
  padding-left: 8px;
}
</style>
