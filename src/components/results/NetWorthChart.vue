<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useInputs } from '@/app/useInputs'
import { colorForIndex, millions, money, monthLabel } from '@/app/format'
import type { VariantId } from '@/engine/types/plan'

const { report } = useInputs()

// Colour and label are looked up by id off the shown variants: colour by their
// order (the palette's fixed slots), the name straight off the plan. The chart's
// derived lists (series, end labels, tooltip rows) only carry ids, so these two
// maps are how they reach both.
const colorOf = computed<Record<VariantId, string>>(() => {
  const map: Record<VariantId, string> = {}
  report.value.variants.forEach((variant, index) => {
    map[variant.id] = colorForIndex(index)
  })
  return map
})
const nameOf = computed<Record<VariantId, string>>(() => {
  const map: Record<VariantId, string> = {}
  for (const variant of report.value.variants) map[variant.id] = variant.name
  return map
})

// left fits "52,2 млн", right fits the longest variant name — both at --text-xs,
// which is why they are wider than they look like they need to be.
const PAD = { top: 16, right: 172, bottom: 32, left: 78 }

// The viewBox tracks the element's real size so one user unit is one CSS pixel.
// Letting a fixed viewBox stretch instead would scale the whole drawing — on a
// wide screen the 12px axis labels would render at 30px.
//
// The svg is positioned absolutely inside .plot so its own size can never feed
// back into the box being measured.
const plotElement = ref<HTMLElement | null>(null)
const width = ref(900)
const height = ref(340)
let observer: ResizeObserver | null = null

onMounted(() => {
  const element = plotElement.value
  if (!element) return
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    width.value = Math.max(320, entry.contentRect.width)
    height.value = Math.max(220, entry.contentRect.height)
  })
  observer.observe(element)
})

onBeforeUnmount(() => observer?.disconnect())

const plot = computed(() => ({
  width: Math.max(1, width.value - PAD.left - PAD.right),
  height: Math.max(1, height.value - PAD.top - PAD.bottom),
}))

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

// The apartment price is the same for every variant, so any one of them can tell
// us what it did over the window.
const priceRows = computed(() => report.value.variants[0]?.rows ?? [])

const bounds = computed(() => {
  const values = [
    ...report.value.variants.flatMap((variant) => variant.rows.map((row) => row.netWorth)),
    ...priceRows.value.map((row) => row.apartmentPrice),
  ]
  // reduce, not Math.min(...values): a long horizon makes this thousands of
  // values, and spreading them into a call overflows the stack — a white page.
  let min = values[0] ?? 0
  let max = values[0] ?? 0
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  // A flat band would divide by zero; a hair of padding also keeps the top line
  // off the frame.
  const span = max - min || 1
  return { min: min - span * 0.05, max: max + span * 0.05 }
})

function scaleX(index: number): number {
  return PAD.left + (index / Math.max(1, monthCount.value - 1)) * plot.value.width
}

function scaleY(value: number): number {
  const { min, max } = bounds.value
  return PAD.top + plot.value.height - ((value - min) / (max - min)) * plot.value.height
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

// A reference line, not a series: it is what the variants are racing, so it wears
// muted ink and a dash rather than a categorical hue.
const pricePath = computed(() =>
  priceRows.value
    .map(
      (row, index) =>
        `${index === 0 ? 'M' : 'L'}${scaleX(row.index)} ${scaleY(row.apartmentPrice)}`,
    )
    .join(' '),
)

// Labelled at its own start rather than at the right edge, where the variants'
// end labels already compete for room. It sits *below* the start: the line only
// ever rises, so anything above it gets struck through by the line itself.
const priceLabel = computed(() => {
  const first = priceRows.value[0]
  return first ? { x: PAD.left + 4, y: scaleY(first.apartmentPrice) + 13 } : null
})

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
  // One user unit is one CSS pixel, so the pointer offset is already an x.
  const x = event.clientX - element.getBoundingClientRect().left
  const index = Math.round(((x - PAD.left) / plot.value.width) * (monthCount.value - 1))
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
    apartmentPrice: first.apartmentPrice,
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
        <span class="swatch" :style="{ background: colorOf[variant.id] }" />
        {{ nameOf[variant.id] }}
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

    <p v-if="report.variants.length === 0" class="empty">
      Ни один план не выбран. Отметьте планы над графиком или во вкладке «Планы».
    </p>

    <div v-else ref="plotElement" class="plot">
      <svg
        ref="svg"
        :viewBox="`0 0 ${width} ${height}`"
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
            :key="`y-${tick.value}`"
            class="y-label"
            :x="PAD.left - 8"
            :y="tick.y + 3.5"
          >
            {{ millions(tick.value) }}
          </text>
          <text
            v-for="row in monthTicks"
            :key="`x-${row.index}`"
            class="x-label"
            :x="scaleX(row.index)"
            :y="height - PAD.bottom + 16"
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

        <path class="price-line" :d="pricePath" fill="none" />
        <text v-if="priceLabel" class="price-label" :x="priceLabel.x" :y="priceLabel.y">
          цена квартиры
        </text>

        <path
          v-for="entry in series"
          :key="entry.id"
          :d="entry.path"
          fill="none"
          :stroke="colorOf[entry.id]"
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
              :stroke="colorOf[entry.id]"
              stroke-width="2"
            />
            <circle
              v-if="entry.purchase"
              :cx="entry.purchase.x"
              :cy="entry.purchase.y"
              r="4"
              :fill="colorOf[entry.id]"
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
            :fill="colorOf[entry.id]"
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
            {{ nameOf[label.id] }}
          </text>
        </g>
      </svg>

      <div v-if="tooltip" class="tooltip" :style="{ left: `${tooltip.x}px` }">
        <p class="when">{{ tooltip.yearMonth }}</p>
        <p v-for="entry in tooltip.rows" :key="entry.id" class="row">
          <span class="swatch" :style="{ background: colorOf[entry.id] }" />
          <span class="name">{{ nameOf[entry.id] }}</span>
          <span class="value">{{ money(entry.row!.netWorth) }}</span>
        </p>
        <p class="row price">
          <span class="name">цена квартиры</span>
          <span class="value">{{ money(tooltip.apartmentPrice) }}</span>
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
  /* The header and legend take what they need; the plot gets the rest of
     whatever height the parent hands this card. */
  display: flex;
  flex-direction: column;
  min-height: 0;
}
header {
  margin-bottom: 8px;
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
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  list-style: none;
  padding: 0;
  margin: 0 0 6px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* The event marks carry shape, not identity, so they sit in muted ink and are
   pushed away from the series keys. `:first-of-type` matched by element, not
   class, so it never fired; `.marks ~ .marks` would double-gap — the first .marks
   is the one to nudge, reached by "a .marks preceded by a non-.marks". */
.marks {
  color: var(--text-muted);
}
.legend li:not(.marks) + .marks {
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
  flex: 1;
  min-height: 220px;
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: var(--text-md);
  text-align: center;
  margin: 0;
}
/* Scoped to the plot: a bare `svg` rule would stretch the legend's tiny mark
   swatches to the full width of the card. Absolute so the svg fills the measured
   box without its size becoming an input to that measurement. */
.plot svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
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
  font-size: var(--text-xs);
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
  font-size: var(--text-xs);
  text-anchor: start;
}
.crosshair {
  stroke: var(--text-muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.price-line {
  stroke: var(--text-muted);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}
.price-label {
  fill: var(--text-muted);
  font-size: var(--text-xs);
  text-anchor: start;
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
  font-size: var(--text-md);
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
.price {
  border-top: 1px solid var(--border);
  margin-top: 5px;
  padding-top: 5px;
  color: var(--text-muted);
}
.value {
  margin-left: auto;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
</style>
