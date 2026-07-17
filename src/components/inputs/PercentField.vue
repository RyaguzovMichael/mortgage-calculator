<script setup lang="ts">
import { computed } from 'vue'

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
  <label class="field">
    <span class="label">{{ label }}</span>
    <span class="control">
      <input v-model.number="percent" type="number" :step="step ?? 0.1" />
      <span class="suffix">%</span>
    </span>
    <span v-if="hint" class="hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  color: var(--text-secondary);
  font-size: 12px;
}
.control {
  display: flex;
  align-items: center;
  gap: 6px;
}
input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-family: var(--mono);
  font-size: 13px;
}
input:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -1px;
}
.suffix {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}
.hint {
  color: var(--text-muted);
  font-size: 11px;
}
</style>
