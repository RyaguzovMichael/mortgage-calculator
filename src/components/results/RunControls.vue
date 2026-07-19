<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'

const { inputs } = useInputs()
const { t, tm, locale } = useI18n()

const growthPercent = computed<number>({
  get: () => Math.round(inputs.apartment.annualGrowthRate * 1e6) / 1e4,
  set: (value) => {
    Object.assign(inputs.apartment, { annualGrowthRate: value / 100 })
  },
})

function onGrowthInput(event: Event): void {
  const parsed = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(parsed)) growthPercent.value = parsed
}

// A floating tip, not an always-reserved line: it only appears on a pointerup
// on the input (a tap or click release) and closes again once the field loses
// focus, so it never pushes the rest of the layout around.
const growthHintOpen = ref(false)
function openGrowthHint(): void {
  growthHintOpen.value = true
}
function closeGrowthHint(): void {
  growthHintOpen.value = false
}

// The slider's own scale, independent of the stored horizon: dragging always
// works in whole years, but a saved horizonMonths that isn't a multiple of 12
// (hand-edited before this control existed, or restored from an old save)
// still round-trips through the month field elsewhere without the slider
// clobbering it on every rerender.
const MAX_YEARS = 40

const startValue = computed<string>({
  get: () =>
    `${String(inputs.start.year).padStart(4, '0')}-${String(inputs.start.month).padStart(2, '0')}`,
  set: (value) => {
    const match = /^(\d+)-(\d{1,2})$/.exec(value)
    if (!match) return
    // Object.assign, not a direct field write: `start` is `readonly` in the
    // engine's Inputs type (a promise to itself never to mutate), and the UI
    // side steps around that the same way `reset()` in useInputs.ts does.
    Object.assign(inputs.start, { year: Number(match[1]), month: Number(match[2]) })
  },
})

const horizonYears = computed<number>({
  get: () => Math.round(inputs.horizonMonths / 12),
  set: (years) => {
    Object.assign(inputs, { horizonMonths: Math.round(years) * 12 })
  },
})

function onHorizonInput(event: Event): void {
  horizonYears.value = Number((event.target as HTMLInputElement).value)
}

// Russian needs three plural forms for "год" (1 год, 2-4 года, 0/5-20 лет, and
// the same pattern repeating above 20); English only needs two. The words
// themselves come from the locale's own messages.
const yearsWord = computed<string>(() => {
  const forms = tm('runControls.yearsWord') as unknown as string[]
  const n = horizonYears.value
  if (locale.value === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return forms[0]!
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]!
    return forms[2]!
  }
  return n === 1 ? forms[0]! : forms[1]!
})
</script>

<template>
  <div class="run-controls">
    <label class="start-field">
      <span class="label">{{ t('runControls.startLabel') }}</span>
      <input v-model="startValue" type="month" />
    </label>
    <label class="growth-field">
      <span class="label">{{ t('runControls.growthLabel') }}</span>
      <span class="control">
        <input
          class="growth-input"
          type="number"
          step="1"
          :value="growthPercent"
          @input="onGrowthInput"
          @pointerup="openGrowthHint"
          @blur="closeGrowthHint"
        />
        <span class="suffix">%</span>
        <span v-if="growthHintOpen" class="hint-tip" role="tooltip">
          {{ t('runControls.growthHint') }}
        </span>
      </span>
    </label>
    <label class="horizon-field">
      <span class="label">
        {{ t('runControls.horizonLabel') }}
        <span class="value">{{ horizonYears }} {{ yearsWord }}</span>
      </span>
      <input
        class="slider"
        type="range"
        min="0"
        :max="MAX_YEARS"
        step="1"
        :value="horizonYears"
        list="horizon-ticks"
        :aria-label="t('runControls.horizonAriaLabel')"
        @input="onHorizonInput"
      />
      <datalist id="horizon-ticks">
        <option value="0"></option>
        <option value="10"></option>
        <option value="20"></option>
        <option value="30"></option>
        <option value="40"></option>
      </datalist>
      <span class="hint">{{ t('runControls.horizonHint') }}</span>
    </label>
  </div>
</template>

<style scoped>
.run-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px 20px;
}
.start-field,
.growth-field,
.horizon-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.start-field,
.growth-field {
  flex: none;
}
.growth-field .control {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.growth-input {
  width: 70px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-family: var(--mono);
  font-size: var(--text-lg);
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}
.growth-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.growth-field .suffix {
  color: var(--text-muted);
  font-size: var(--text-md);
}
/* Takes whatever room the plan chips leave: the slider is the thing worth
   dragging precisely, so it gets the width. */
.horizon-field {
  flex: 1 1 220px;
  min-width: 220px;
}
.label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-secondary);
  font-size: var(--text-md);
  white-space: nowrap;
}
.value {
  color: var(--text-primary);
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
input[type='month'] {
  margin-top: 10px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-family: var(--mono);
  font-size: var(--text-lg);
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}
input[type='month']:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}
</style>
