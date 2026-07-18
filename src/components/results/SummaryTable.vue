<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { colorForIndex, money } from '@/app/format'
import type { VariantId, VariantResult } from '@/engine/types/plan'

const { inputs, report } = useInputs()

// Rows sort every which way, so colour cannot come from row order — it is keyed
// on id and fixed by the variant's position in the report (its slot among the
// shown), matching the chart.
const colorOf = computed<Record<VariantId, string>>(() => {
  const map: Record<VariantId, string> = {}
  report.value.variants.forEach((variant, index) => {
    map[variant.id] = colorForIndex(index)
  })
  return map
})

// totalLoss assumes every variant ends up with the same apartment so its price
// cancels out. Once the price moves, they buy in different months at different
// prices and it quietly mis-ranks — so say so rather than show it bare.
const lossIsValid = computed(() => inputs.apartment.annualGrowthRate === 0)

// The engine drops it when Otbasy never buys — say so, or a variant just goes
// missing from the table with no explanation.
const delayedIsDropped = computed(
  () => !report.value.variants.some((variant) => variant.id === 'halyk-delayed'),
)

function months(value: number | null): string {
  return value === null ? '—' : `${value}`
}

function maybeMoney(value: number | null): string {
  return value === null ? '—' : money(value)
}

interface Column {
  readonly key: string
  readonly label: string
  readonly left?: boolean
  // null means "never happened" and always sorts last, whichever way the column
  // is pointing — "—" at the top of a ranking is just noise.
  readonly sort: (variant: VariantResult) => number | string | null
  readonly cell: (variant: VariantResult) => string
}

const COLUMNS: readonly Column[] = [
  {
    key: 'variant',
    label: 'Вариант',
    left: true,
    sort: (variant) => variant.name,
    cell: (variant) => variant.name,
  },
  {
    key: 'purchaseMonth',
    label: 'Покупка',
    sort: (variant) => variant.purchaseMonth,
    cell: (variant) => months(variant.purchaseMonth),
  },
  {
    key: 'debtFreeMonth',
    label: 'Без долга',
    sort: (variant) => variant.debtFreeMonth,
    cell: (variant) => months(variant.debtFreeMonth),
  },
  {
    key: 'purchasePrice',
    label: 'Цена покупки',
    sort: (variant) => variant.purchasePrice,
    cell: (variant) => maybeMoney(variant.purchasePrice),
  },
  {
    key: 'rentPaid',
    label: 'Аренда',
    sort: (variant) => variant.totals.rentPaid,
    cell: (variant) => money(variant.totals.rentPaid),
  },
  {
    key: 'loanInterestPaid',
    label: '% кредита',
    sort: (variant) => variant.totals.loanInterestPaid,
    cell: (variant) => money(variant.totals.loanInterestPaid),
  },
  {
    key: 'depositInterestEarned',
    label: 'Доход с вкладов',
    sort: (variant) => variant.totals.depositInterestEarned,
    cell: (variant) => money(variant.totals.depositInterestEarned),
  },
  {
    key: 'govBonusReceived',
    label: 'Гос. премия',
    sort: (variant) => variant.totals.govBonusReceived,
    cell: (variant) => money(variant.totals.govBonusReceived),
  },
  {
    key: 'totalLoss',
    label: 'Потеря',
    sort: (variant) => variant.totals.totalLoss,
    cell: (variant) => money(variant.totals.totalLoss),
  },
  {
    key: 'netWorthAtEnd',
    label: 'Чистые активы',
    sort: (variant) => variant.totals.netWorthAtEnd,
    cell: (variant) => money(variant.totals.netWorthAtEnd),
  },
]

const sortKey = ref('netWorthAtEnd')
const descending = ref(true)

function sortBy(column: Column): void {
  if (sortKey.value === column.key) {
    descending.value = !descending.value
    return
  }
  sortKey.value = column.key
  // Biggest-first is what you want of a money column; names read better A→Z.
  descending.value = column.key !== 'variant'
}

const ranked = computed(() => {
  const column = COLUMNS.find((entry) => entry.key === sortKey.value) ?? COLUMNS[0]!
  return [...report.value.variants].sort((left, right) =>
    compare(column.sort(left), column.sort(right)),
  )
})

function compare(left: number | string | null, right: number | string | null): number {
  if (left === null || right === null) {
    // Before the direction is applied, so "never" stays at the bottom either way.
    return left === right ? 0 : left === null ? 1 : -1
  }
  const order =
    typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right)
  return descending.value ? -order : order
}

function classesFor(column: Column, variant: VariantResult): Record<string, boolean> {
  return {
    left: column.left === true,
    primary: column.key === 'netWorthAtEnd',
    dim: column.key === 'totalLoss' && !lossIsValid.value,
    // Flagged only when waiting actually cost something: at 0% growth every
    // variant pays the list price and colouring the column would be noise.
    overpay:
      column.key === 'purchasePrice' &&
      variant.purchasePrice !== null &&
      variant.purchasePrice > inputs.apartment.price,
  }
}
</script>

<template>
  <section class="card">
    <header>
      <h2>Сравнение вариантов</h2>
      <p class="sub">
        Целевой кредит {{ money(report.targetLoan) }} ₸ · сравнение по
        {{ report.comparisonMonths }} мес (до месяца, когда последний вариант закрывает долг)
      </p>
    </header>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in COLUMNS"
              :key="column.key"
              :class="{
                left: column.left,
                primary: column.key === 'netWorthAtEnd',
                dim: column.key === 'totalLoss' && !lossIsValid,
                on: sortKey === column.key,
              }"
              :aria-sort="
                sortKey === column.key ? (descending ? 'descending' : 'ascending') : 'none'
              "
            >
              <button type="button" @click="sortBy(column)">
                {{ column.label }}
                <span class="arrow">{{
                  sortKey === column.key ? (descending ? '↓' : '↑') : ''
                }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="variant in ranked" :key="variant.id" :class="{ best: variant.id === report.bestVariant }">
            <td
              v-for="column in COLUMNS"
              :key="column.key"
              :class="classesFor(column, variant)"
            >
              <span
                v-if="column.key === 'variant'"
                class="swatch"
                :style="{ background: colorOf[variant.id] }"
              />{{ column.cell(variant) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="delayedIsDropped" class="warning">
      «Halyk отложенно» не считается: он ждёт ровно столько же, сколько Otbasy, а Otbasy не выходит
      на покупку в пределах горизонта — ждать не за чем. Задайте окно накопления вручную или
      поднимите горизонт.
    </p>

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
  font-size: var(--text-xl);
  margin: 0;
}
.sub {
  color: var(--text-muted);
  font-size: var(--text-md);
  margin: 2px 0 0;
}
.scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--text-lg);
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
  /* Headings wrap so a column is only as wide as its numbers: "Доход с вкладов"
     is three times the width of the figure under it. */
  white-space: normal;
  vertical-align: bottom;
  padding: 0;
}
/* The whole heading is the hit target, so the button carries the cell's padding
   rather than sitting inside it. */
th button {
  width: 100%;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  text-align: inherit;
  padding: 7px 10px;
  cursor: pointer;
}
th button:hover {
  color: var(--text-primary);
}
th button:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -2px;
}
th.on {
  color: var(--text-primary);
}
.arrow {
  /* Reserved even when empty, so switching columns does not shuffle the widths. */
  display: inline-block;
  width: 0.75em;
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
.overpay {
  color: var(--critical);
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
  font-size: var(--text-md);
  margin: 10px 0 0;
  color: var(--text-secondary);
}
.warning {
  border-left: 2px solid var(--critical);
  padding-left: 8px;
}
</style>
