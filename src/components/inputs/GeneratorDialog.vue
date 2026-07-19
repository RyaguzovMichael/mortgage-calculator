<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  mdiAutoFix,
  mdiHomeCityOutline,
  mdiHomeExportOutline,
  mdiHomeHeart,
  mdiShieldHomeOutline,
} from '@mdi/js'
import { useInputs } from '@/app/useInputs'
import type { GeneratorOptions } from '@/engine/bestPlans'
import type { HousingSituation } from '@/engine/types/inputs'
import { DEFAULT_PLAN_SALE_MONTH } from '@/infrastructure/inputsStorage'
import AppIcon from '@/components/AppIcon.vue'
import ChoiceCards, { type Choice } from './ChoiceCards.vue'

// The facts the generator can't guess, asked once before a run. Owning a flat opens
// the sell/keep question (and, when selling, the earliest month it can go); not
// owning — or owning but keeping — asks only where you live meanwhile. Every run also
// has a time budget: a plan that isn't fully settled by then is dropped.
const emit = defineEmits<{ run: [options: GeneratorOptions]; cancel: [] }>()

const { inputs } = useInputs()
const { t, tm, locale } = useI18n()

const owned = computed(() => inputs.existingApartment.owned)

// 'sell' vs 'keep' is only meaningful for an owner; a non-owner has nothing to sell,
// so the question is hidden and this stays at its default.
const sellChoice = ref<'sell' | 'keep'>('sell')
const earliestSaleMonth = ref(DEFAULT_PLAN_SALE_MONTH)
// Where you live until you buy, for everyone who isn't selling — a non-owner, or an
// owner who chose to keep the flat.
const housing = ref<Exclude<HousingSituation, 'selling'>>('free')
// The time budget is a whole-year slider, the same control (and scale) as the main
// page's horizon — years are how people think about "how long am I willing for this
// to take". Seeded with the full horizon, so by default nothing is filtered; the
// user drags it down to constrain the search. Converted to months only on emit.
const MAX_YEARS = 40
const maxYears = ref(Math.min(MAX_YEARS, Math.max(1, Math.round(inputs.horizonMonths / 12))))

function onMaxYearsInput(event: Event): void {
  maxYears.value = Number((event.target as HTMLInputElement).value)
}

// Same plural rules as RunControls (1 год / 2–4 года / лет), reusing that block's
// own words so the translation lives in one place.
const yearsWord = computed<string>(() => {
  const forms = tm('runControls.yearsWord') as unknown as string[]
  const n = maxYears.value
  if (locale.value === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return forms[0]!
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]!
    return forms[2]!
  }
  return n === 1 ? forms[0]! : forms[1]!
})

const sells = computed(() => owned.value && sellChoice.value === 'sell')
const askHousing = computed(() => !owned.value || sellChoice.value === 'keep')

const sellOptions = computed<Choice<'sell' | 'keep'>[]>(() => [
  {
    value: 'sell',
    label: t('generatorDialog.sell.label'),
    description: t('generatorDialog.sell.desc'),
    icon: mdiHomeExportOutline,
  },
  {
    value: 'keep',
    label: t('generatorDialog.keep.label'),
    description: t('generatorDialog.keep.desc'),
    icon: mdiShieldHomeOutline,
  },
])

const housingOptions = computed<Choice<'free' | 'renting'>[]>(() => [
  {
    value: 'free',
    label: t('generatorDialog.free.label'),
    description: t('generatorDialog.free.desc'),
    icon: mdiHomeHeart,
  },
  {
    value: 'renting',
    label: t('generatorDialog.renting.label'),
    description: t('generatorDialog.renting.desc'),
    icon: mdiHomeCityOutline,
  },
])

function run(): void {
  const situation: HousingSituation = sells.value ? 'selling' : housing.value
  emit('run', {
    situation,
    earliestSaleMonth: Math.max(0, Math.trunc(earliestSaleMonth.value)),
    maxMonths: maxYears.value * 12,
  })
}
</script>

<template>
  <div class="overlay">
    <section
      class="dialog card"
      role="dialog"
      aria-modal="true"
      :aria-label="t('generatorDialog.title')"
    >
      <div class="head">
        <span class="icon"><AppIcon :path="mdiAutoFix" :size="22" /></span>
        <h2>{{ t('generatorDialog.title') }}</h2>
      </div>
      <p class="instruction">{{ t('generatorDialog.instruction') }}</p>

      <template v-if="owned">
        <h3>{{ t('generatorDialog.sellTitle') }}</h3>
        <ChoiceCards
          v-model="sellChoice"
          :options="sellOptions"
          :aria-label="t('generatorDialog.sellTitle')"
        />
        <label v-if="sells" class="field">
          <span>{{ t('generatorDialog.saleMonthLabel') }}</span>
          <input v-model.number="earliestSaleMonth" type="number" min="0" step="1" />
          <span class="hint">{{ t('generatorDialog.saleMonthHint') }}</span>
        </label>
      </template>

      <template v-if="askHousing">
        <h3>{{ t('generatorDialog.housingTitle') }}</h3>
        <ChoiceCards
          v-model="housing"
          :options="housingOptions"
          :aria-label="t('generatorDialog.housingTitle')"
        />
      </template>

      <h3>{{ t('generatorDialog.timeTitle') }}</h3>
      <label class="field">
        <span class="slider-label">
          {{ t('generatorDialog.maxYearsLabel') }}
          <span class="value">{{ maxYears }} {{ yearsWord }}</span>
        </span>
        <input
          class="slider"
          type="range"
          min="1"
          :max="MAX_YEARS"
          step="1"
          :value="maxYears"
          list="gen-time-ticks"
          :aria-label="t('generatorDialog.maxYearsLabel')"
          @input="onMaxYearsInput"
        />
        <datalist id="gen-time-ticks">
          <option value="1"></option>
          <option value="10"></option>
          <option value="20"></option>
          <option value="30"></option>
          <option value="40"></option>
        </datalist>
        <span class="hint">{{ t('generatorDialog.maxYearsHint') }}</span>
      </label>

      <footer class="controls">
        <button type="button" class="secondary" @click="emit('cancel')">
          {{ t('generatorDialog.cancel') }}
        </button>
        <button type="button" class="primary" @click="run">
          <AppIcon :path="mdiAutoFix" :size="16" />
          {{ t('generatorDialog.run') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
/* Same overlay/card shell as ConfirmDialog, widened for the choice cards. */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10vh 16px 40px;
  overflow-y: auto;
  background: rgba(10, 12, 18, 0.72);
}
.dialog {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-lg);
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon {
  display: flex;
  color: var(--accent);
}
h2 {
  font-size: var(--text-lg);
  margin: 0;
}
h3 {
  font-size: var(--text-md);
  margin: 4px 0 0;
  color: var(--text-secondary);
}
.instruction {
  color: var(--text-secondary);
  font-size: var(--text-md);
  margin: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}
.slider-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.value {
  color: var(--text-primary);
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
.field input[type='number'] {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-family: var(--mono);
  font-size: var(--text-lg);
  max-width: 160px;
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}
.field input[type='number']:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
/* Same slider as the main page's horizon control. */
.slider {
  width: 100%;
  margin-top: 2px;
  accent-color: var(--accent);
  cursor: pointer;
}
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.controls {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.controls button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border: 1px solid var(--border);
  transition:
    color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}
.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.secondary:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.primary {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  border-color: transparent;
  font-weight: 600;
  box-shadow: 0 4px 14px var(--accent-glow);
}
.primary:hover {
  box-shadow: 0 6px 20px var(--accent-glow);
  transform: var(--lift);
}
</style>
