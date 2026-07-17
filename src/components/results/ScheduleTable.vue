<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { money, monthLabel, PHASE_LABELS, VARIANT_COLORS, VARIANT_LABELS } from '@/app/format'
import type { VariantId } from '@/engine/types/plan'

const { report } = useInputs()
const active = ref<VariantId>('halyk-immediate')

const variant = computed(
  () => report.value.variants.find((entry) => entry.id === active.value) ?? report.value.variants[0],
)
</script>

<template>
  <section class="card">
    <header>
      <h2>Помесячно</h2>
      <div class="tabs" role="tablist">
        <button
          v-for="entry in report.variants"
          :key="entry.id"
          type="button"
          role="tab"
          :aria-selected="entry.id === active"
          :class="{ on: entry.id === active }"
          @click="active = entry.id"
        >
          <span class="swatch" :style="{ background: VARIANT_COLORS[entry.id] }" />
          {{ VARIANT_LABELS[entry.id] }}
        </button>
      </div>
    </header>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Мес</th>
            <th class="left">Дата</th>
            <th class="left">Фаза</th>
            <th>Цена кв.</th>
            <th>Аренда</th>
            <th>Платёж</th>
            <th>Проценты</th>
            <th>Тело</th>
            <th>Долг</th>
            <th>Вклады</th>
            <th>Отбасы</th>
            <th>CC</th>
            <th>Доход</th>
            <th>Премия</th>
            <th>Чистые активы</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in variant?.rows"
            :key="row.index"
            :class="{ event: row.index === variant?.purchaseMonth }"
          >
            <td>{{ row.index }}</td>
            <td class="left">{{ monthLabel(row.yearMonth) }}</td>
            <td class="left phase">{{ PHASE_LABELS[row.phase] }}</td>
            <td>{{ money(row.apartmentPrice) }}</td>
            <td>{{ money(row.rentPaid) }}</td>
            <td>{{ money(row.loanPayment) }}</td>
            <td>{{ money(row.loanInterest) }}</td>
            <td>{{ money(row.loanPrincipal) }}</td>
            <td>{{ money(row.loanBalance) }}</td>
            <td>{{ money(row.savingsBalance) }}</td>
            <td>{{ money(row.otbasyBalance) }}</td>
            <td>{{ row.otbasyCc.toFixed(2) }}</td>
            <td>{{ money(row.depositInterestEarned) }}</td>
            <td>{{ money(row.govBonus) }}</td>
            <td class="primary">{{ money(row.netWorth) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="note">Подсвечена строка покупки. Доход показан в месяц выплаты процентов, а не начисления.</p>
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
  font-size: var(--text-xl);
  margin: 0 0 8px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
button.on {
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.scroll {
  overflow-x: auto;
  max-height: 460px;
  overflow-y: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--text-md);
}
th,
td {
  padding: 4px 8px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
thead th {
  position: sticky;
  top: 0;
  background: var(--surface-1);
  color: var(--text-muted);
  font-weight: 500;
  font-size: var(--text-xs);
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
.phase {
  font-family: var(--font);
  color: var(--text-secondary);
}
.primary {
  color: var(--text-primary);
  font-weight: 600;
}
.event td {
  background: color-mix(in srgb, var(--series-1) 12%, transparent);
}
.note {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 8px 0 0;
}
</style>
