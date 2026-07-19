<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import { colorForIndex, money } from '@/app/useFormat'
import type { VariantId, VariantResult } from '@/engine/types/plan'

const { inputs, report } = useInputs()
const { t } = useI18n()

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

// Plans the user asked to see but the engine could not run — a delayed plan whose
// window chains to an Otbasy purchase that never happens. Named so the table says
// why they are missing rather than letting them vanish.
const droppedShown = computed(() => report.value.droppedShown)

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

const COLUMNS = computed<readonly Column[]>(() => [
  {
    key: 'variant',
    label: t('summaryTable.columns.variant'),
    left: true,
    sort: (variant) => variant.name,
    cell: (variant) => variant.name,
  },
  {
    key: 'purchaseMonth',
    label: t('summaryTable.columns.purchaseMonth'),
    sort: (variant) => variant.purchaseMonth,
    cell: (variant) => months(variant.purchaseMonth),
  },
  {
    key: 'debtFreeMonth',
    label: t('summaryTable.columns.debtFreeMonth'),
    sort: (variant) => variant.debtFreeMonth,
    cell: (variant) => months(variant.debtFreeMonth),
  },
  {
    key: 'purchasePrice',
    label: t('summaryTable.columns.purchasePrice'),
    sort: (variant) => variant.purchasePrice,
    cell: (variant) => maybeMoney(variant.purchasePrice),
  },
  {
    key: 'rentPaid',
    label: t('summaryTable.columns.rentPaid'),
    sort: (variant) => variant.totals.rentPaid,
    cell: (variant) => money(variant.totals.rentPaid),
  },
  {
    key: 'loanInterestPaid',
    label: t('summaryTable.columns.loanInterestPaid'),
    sort: (variant) => variant.totals.loanInterestPaid,
    cell: (variant) => money(variant.totals.loanInterestPaid),
  },
  {
    key: 'depositInterestEarned',
    label: t('summaryTable.columns.depositInterestEarned'),
    sort: (variant) => variant.totals.depositInterestEarned,
    cell: (variant) => money(variant.totals.depositInterestEarned),
  },
  {
    key: 'govBonusReceived',
    label: t('summaryTable.columns.govBonusReceived'),
    sort: (variant) => variant.totals.govBonusReceived,
    cell: (variant) => money(variant.totals.govBonusReceived),
  },
  {
    key: 'netWorthAtEnd',
    label: t('summaryTable.columns.netWorthAtEnd'),
    sort: (variant) => variant.totals.netWorthAtEnd,
    cell: (variant) => money(variant.totals.netWorthAtEnd),
  },
])

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
  const column = COLUMNS.value.find((entry) => entry.key === sortKey.value) ?? COLUMNS.value[0]!
  return [...report.value.variants].sort((left, right) =>
    compare(column.sort(left), column.sort(right)),
  )
})

function compare(left: number | string | null, right: number | string | null): number {
  if (left === null || right === null) {
    // Before the direction is applied, so "never" stays at the bottom either way.
    return left === right ? 0 : left === null ? 1 : -1
  }
  const order = typeof left === 'string' ? left.localeCompare(String(right)) : left - Number(right)
  return descending.value ? -order : order
}

function classesFor(column: Column, variant: VariantResult): Record<string, boolean> {
  return {
    left: column.left === true,
    primary: column.key === 'netWorthAtEnd',
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
      <h2>{{ t('summaryTable.title') }}</h2>
      <p class="sub">
        {{
          t('summaryTable.subtitle', {
            loan: money(report.targetLoan),
            months: report.comparisonMonths,
          })
        }}
      </p>
    </header>

    <div class="scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="column in COLUMNS"
              :key="column.key"
              :class="{
                left: column.left,
                primary: column.key === 'netWorthAtEnd',
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
          <tr
            v-for="variant in ranked"
            :key="variant.id"
            :class="{ best: variant.id === report.bestVariant }"
          >
            <td v-for="column in COLUMNS" :key="column.key" :class="classesFor(column, variant)">
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

    <p v-if="droppedShown.length > 0" class="warning">
      {{ t('summaryTable.dropped', { list: droppedShown.join(', ') }) }}
    </p>
  </section>
</template>

<style scoped>
/* .card and the .data-table skeleton (border-collapse, cell borders, right-align,
   mono figures, .left) come from assets/forms.css; only what is specific to the
   summary — its roomier padding, wrapping sortable headings, the best-row tint —
   stays here. */
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
  font-size: var(--text-lg);
}
th,
td {
  padding: 7px 10px;
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
  outline: 2px solid var(--accent);
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
td.left {
  font-family: var(--font);
}
.primary {
  font-weight: 600;
  color: var(--text-primary);
}
.overpay {
  color: var(--critical);
}
.best td {
  background: color-mix(in srgb, var(--good) 12%, transparent);
}
.best td:first-child {
  box-shadow: inset 3px 0 0 var(--good);
}
.swatch {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 7px;
}
.warning {
  font-size: var(--text-md);
  margin: 10px 0 0;
  color: var(--text-secondary);
  border-left: 2px solid var(--critical);
  padding-left: 8px;
}
</style>
