<script setup lang="ts">
import { computed } from 'vue'
import NumberField from './NumberField.vue'

defineProps<{ label: string; step?: number; hint?: string }>()

// The engine speaks fractions, the panel speaks percents, and this is the only
// place the two meet. Rounding on the way out is what stops 0.184 from surfacing
// as 18.400000000000002 once it has been through a float divide and back.
const fraction = defineModel<number>({ required: true })

const percent = computed({
  get: () => Math.round(fraction.value * 1e6) / 1e4,
  set: (value: number) => {
    fraction.value = value / 100
  },
})
</script>

<template>
  <!-- Delegates to NumberField so the non-number guard lives in one place and the
       input styling is not a second copy. -->
  <NumberField v-model="percent" :label="label" suffix="%" :step="step ?? 0.1" :hint="hint" />
</template>
