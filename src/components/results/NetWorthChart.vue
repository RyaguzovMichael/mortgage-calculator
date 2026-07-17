<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { millions, money, monthLabel, VARIANT_COLORS, VARIANT_LABELS } from '@/app/format'
import type { VariantId } from '@/engine/types/plan'

const { report } = useInputs()

const WIDTH = 900
const HEIGHT = 340
const PAD = { top: 16, right: 132, bottom: 30, left: 62 }

const plot = {
  width: WIDTH - PAD.left - PAD.right,
  height: HEIGHT - PAD.top - PAD.bottom,
}

interface Point {
  readonly x: number
  readonly y: number
}

interface Series {
  readonly id: VariantId
  readonly points: readonly Point[]
  readonly path: string
  readonly last: Point
  // The two events worth seeing on the line itself: null when the variant never
  // got that far inside the window.
  readonly purchase: Point | null
  readonly debtFree: Point | null
}

const monthCount = computed(() => report.value.variants[0]?.rows.length ?? 0)

const bounds = computed(() => {
  const values = report.value.variants.flatMap((variant) => variant.rows.map((row) => row.netWorth))
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat band would divide by zero; a hair of padding also keeps the top line
  // off the frame.
  const span = max - min || 1
  return { min: min - span * 0.05, max: max + span * 0.05 }
})

function scaleX(index: number): number {
  return PAD.left + (index / Math.max(1, monthCount.value - 1)) * plot.width
}

function scaleY(value: number): number {
  const { min, max } = bounds.value
  return PAD.top + plot.height - ((value - min) / (max - min)) * plot.height
}

const series = computed<Series[]>(() =>
  report.value.variants.map((variant) => {
    const points = variant.rows.map((row) => ({ x: scaleX(row.index), y: scaleY(row.netWorth) }))
    return {
      id: variant.id,
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' '),
      last: points[points.length - 1] ?? { x: PAD.left, y: PAD.top },
      purchase: variant.purchaseMonth === null ? null : (points[variant.purchaseMonth] ?? null),
      debtFree: variant.debtFreeMonth === null ? null : (points[variant.debtFreeMonth] ?? null),
    }
  }),
)

const ticks = computed(() => {
  const { min, max } = bounds.value
  return Array.from({ length: 5 }, (_, step) => {
    const value = min + ((max - min) * step) / 4
    return { value, y: scaleY(value) }
  })
})

const monthTicks = computed(() => {
  const every = monthCount.value > 36 ? 12 : 6
  return report.value.variants[0]?.rows.filter((row) => row.index % every === 0) ?? []
})

// Direct labels are stacked apart when two lines end within a label's height of
// each other — without it the last two variants overprint each other.
const endLabels = computed(() => {
  const sorted = [...series.value].sort((left, right) => left.last.y - right.last.y)
  let previous = -Infinity
  return sorted.map((entry) => {
    const y = Math.max(entry.last.y, previous + 13)
    previous = y
    return { id: entry.id, y, anchorY: entry.last.y }
  })
})

const hovered = ref<number | null>(null)
const svg = ref<SVGSVGElement | null>(null)

function onMove(event: MouseEvent): void {
  const element = svg.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  const index = Math.round(((ratio * WIDTH - PAD.left) / plot.width) * (monthCount.value - 1))
  hovered.value = index >= 0 && index < monthCount.value ? index : null
}

const tooltip = computed(() => {
  if (hovered.value === null) return null
  const index = hovered.value
  const rows = report.value.variants.map((variant) => ({
    id: variant.id,
    row: variant.rows[index],
  }))
  const first = rows[0]?.row
  if (!first) return null
  return {
    x: scaleX(index),
    yearMonth: monthLabel(first.yearMonth),
    // Richest first: the tooltip is read against the lines, which are ordered
    // vertically at that month.
    rows: rows
      .filter((entry) => entry.row !== undefined)
      .sort((left, right) => (right.row?.netWorth ?? 0) - (left.row?.netWorth ?? 0)),
  }
})
</script>

<template>
  <section class="card">
    <header>
      <h2>Чистые активы во времени</h2>
      <p class="sub">
        Квартира + вклады − долг. Непрерывны в месяцы продажи и покупки. График
        обрывается на {{ report.comparisonMonths }}-м месяце — там последний вариант гасит долг, и
        сравнивать дальше нечего.
      </p>
    </header>

    <ul class="legend">
      <li v-for="variant in report.variants" :key="variant.id">
        <span class="swatch" :style="{ background: VARIANT_COLORS[variant.id] }" />
        {{ VARIANT_LABELS[variant.id] }}
      </li>
      <li class="marks">
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <circle cx="5.5" cy="5.5" r="4" fill="var(--text-secondary)" />
        </svg>
        покупка
      </li>
      <li class="marks">
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <circle
            cx="5.5"
            cy="5.5"
            r="4"
            fill="var(--surface-1)"
            stroke="var(--text-secondary)"
            stroke-width="2"
          />
        </svg>
        долг закрыт
      </li>
    </ul>

    <div class="plot">
      <svg
        ref="svg"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Чистые активы по вариантам во времени"
        @mousemove="onMove"
        @mouseleave="hovered = null"
      >
        <g class="grid">
          <line
            v-for="tick in ticks"
            :key="tick.value"
            :x1="PAD.left"
            :x2="PAD.left + plot.width"
            :y1="tick.y"
            :y2="tick.y"
          />
        </g>

        <g class="axis">
          <text
            v-for="tick in ticks"
            :key="tick.value"
            class="y-label"
            :x="PAD.left - 8"
            :y="tick.y + 3.5"
          >
            {{ millions(tick.value) }}
          </text>
          <text
            v-for="row in monthTicks"
            :key="row.index"
            class="x-label"
            :x="scaleX(row.index)"
            :y="HEIGHT - PAD.bottom + 16"
          >
            {{ monthLabel(row.yearMonth) }}
          </text>
        </g>

        <line
          v-if="tooltip"
          class="crosshair"
          :x1="tooltip.x"
          :x2="tooltip.x"
          :y1="PAD.top"
          :y2="PAD.top + plot.height"
        />

        <path
          v-for="entry in series"
          :key="entry.id"
          :d="entry.path"
          fill="none"
          :stroke="VARIANT_COLORS[entry.id]"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Debt-free first so the purchase dot stays visible when a variant does
             both in one month (all-cash always does) — it then reads as a dot in
             a halo, which is what happened. -->
        <g class="events">
          <template v-for="entry in series" :key="entry.id">
            <circle
              v-if="entry.debtFree"
              :cx="entry.debtFree.x"
              :cy="entry.debtFree.y"
              r="4.5"
              fill="var(--surface-1)"
              :stroke="VARIANT_COLORS[entry.id]"
              stroke-width="2"
            />
            <circle
              v-if="entry.purchase"
              :cx="entry.purchase.x"
              :cy="entry.purchase.y"
              r="4"
              :fill="VARIANT_COLORS[entry.id]"
              stroke="var(--surface-1)"
              stroke-width="2"
            />
          </template>
        </g>

        <g v-if="hovered !== null">
          <circle
            v-for="entry in series"
            :key="entry.id"
            :cx="entry.points[hovered]?.x"
            :cy="entry.points[hovered]?.y"
            r="4"
            :fill="VARIANT_COLORS[entry.id]"
            stroke="var(--surface-1)"
            stroke-width="2"
          />
        </g>

        <g class="end-labels">
          <text
            v-for="label in endLabels"
            :key="label.id"
            :x="PAD.left + plot.width + 8"
            :y="label.y + 3.5"
          >
            {{ VARIANT_LABELS[label.id] }}
          </text>
        </g>
      </svg>

      <div v-if="tooltip" class="tooltip" :style="{ left: `${(tooltip.x / WIDTH) * 100}%` }">
        <p class="when">{{ tooltip.yearMonth }}</p>
        <p v-for="entry in tooltip.rows" :key="entry.id" class="row">
          <span class="swatch" :style="{ background: VARIANT_COLORS[entry.id] }" />
          <span class="name">{{ VARIANT_LABELS[entry.id] }}</span>
          <span class="value">{{ money(entry.row!.netWorth) }}</span>
        </p>
      </div>
    </div>
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
  margin-bottom: 8px;
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
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  list-style: none;
  padding: 0;
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* The event marks carry shape, not identity, so they sit in muted ink and are
   pushed away from the series keys. */
.marks {
  color: var(--text-muted);
}
.legend li.marks:first-of-type {
  margin-left: 4px;
}
.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex: none;
}
.plot {
  position: relative;
}
/* Scoped to the plot: a bare `svg` rule would stretch the legend's tiny mark
   swatches to the full width of the card. */
.plot svg {
  width: 100%;
  height: auto;
  display: block;
}
.legend svg {
  flex: none;
}
.grid line {
  stroke: var(--border);
  stroke-width: 1;
}
.axis text {
  fill: var(--text-muted);
  font-size: 10px;
  font-family: var(--mono);
}
/* Anchors live here, not on the elements: a CSS rule beats a presentation
   attribute, so an inline text-anchor would be silently ignored. */
.y-label {
  text-anchor: end;
}
.x-label {
  text-anchor: middle;
}
.end-labels text {
  fill: var(--text-secondary);
  font-size: 10px;
  text-anchor: start;
}
.crosshair {
  stroke: var(--text-muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.tooltip {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  pointer-events: none;
  font-size: 12px;
  min-width: 200px;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.14);
}
.when {
  margin: 0 0 5px;
  color: var(--text-muted);
  font-family: var(--mono);
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
}
.name {
  color: var(--text-secondary);
}
.value {
  margin-left: auto;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
</style>
