<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { money, monthLabel, PHASE_LABELS, VARIANT_COLORS, VARIANT_LABELS } from '@/app/format'
import type { MonthRow, VariantId } from '@/engine/types/plan'

const { report } = useInputs()
const active = ref<VariantId>('halyk-immediate')

const variant = computed(
  () => report.value.variants.find((entry) => entry.id === active.value) ?? report.value.variants[0],
)

interface Column {
  readonly key: string
  readonly label: string
  readonly value: (row: MonthRow) => number
  readonly format?: (value: number) => string
  readonly primary?: boolean
}

const NUMERIC_COLUMNS: readonly Column[] = [
  { key: 'apartmentPrice', label: 'Цена кв.', value: (row) => row.apartmentPrice },
  // "Свободно", not "Доход": the column two along is already deposit income.
  { key: 'freeCash', label: 'Свободно', value: (row) => row.freeCash },
  { key: 'rentPaid', label: 'Аренда', value: (row) => row.rentPaid },
  { key: 'loanPayment', label: 'Платёж', value: (row) => row.loanPayment },
  { key: 'loanInterest', label: 'Проценты', value: (row) => row.loanInterest },
  { key: 'loanPrincipal', label: 'Тело', value: (row) => row.loanPrincipal },
  { key: 'loanBalance', label: 'Долг', value: (row) => row.loanBalance },
  { key: 'savingsBalance', label: 'Вклады', value: (row) => row.savingsBalance },
  { key: 'otbasyBalance', label: 'Отбасы', value: (row) => row.otbasyBalance },
  { key: 'otbasyCc', label: 'CC', value: (row) => row.otbasyCc, format: (v) => v.toFixed(2) },
  { key: 'depositInterestEarned', label: 'Доход', value: (row) => row.depositInterestEarned },
  { key: 'govBonus', label: 'Премия', value: (row) => row.govBonus },
  { key: 'netWorth', label: 'Чистые активы', value: (row) => row.netWorth, primary: true },
]

// A column that is zero all the way down says nothing about this variant — the
// Otbasy account and its bonus in every variant that never opens one, the loan
// columns under "без ипотеки", rent under a variant that never rents. Dropping
// them is what makes the remaining columns fit without scrolling sideways.
//
// Driven by the data rather than by variant id: the engine already decides which
// variant touches what, and the table has no business restating that.
const columns = computed(() =>
  NUMERIC_COLUMNS.filter((column) =>
    // Half a tenge: rounding leaves cent-sized dust in columns that are morally
    // empty, and it would still print as "0".
    variant.value?.rows.some((row) => Math.abs(column.value(row)) >= 0.005),
  ),
)

function cell(column: Column, row: MonthRow): string {
  const value = column.value(row)
  return column.format ? column.format(value) : money(value)
}
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
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ primary: column.primary }"
            >
              {{ column.label }}
            </th>
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
            <td
              v-for="column in columns"
              :key="column.key"
              :class="{ primary: column.primary }"
            >
              {{ cell(column, row) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="note">
      Подсвечена строка покупки. Доход показан в месяц выплаты процентов, а не начисления. Колонки,
      пустые для этого варианта, скрыты.
    </p>
  </section>
</template>

<style scoped>
.card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  /* Header and note take what they need; the scroller gets the rest of whatever
     height the parent hands this card. */
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  overflow: auto;
  flex: 1;
  min-height: 200px;
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
