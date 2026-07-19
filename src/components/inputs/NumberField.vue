<script setup lang="ts">
import { ref, watch } from 'vue'

defineProps<{ label: string; suffix?: string; step?: number; hint?: string }>()
const value = defineModel<number>({ required: true })

// The input's text is kept separate from the model so a half-typed or emptied
// field never writes a non-number into the model. `v-model.number` does not
// protect this: Vue's looseToNumber returns the raw STRING when parseFloat fails,
// so clearing the field would put "" into a number slot, the deep watch would
// save it, and the whole saved state would be rejected on reload.
const text = ref(String(value.value))

// Reflect external changes (the reset button, a preset) back into the text.
watch(value, (next) => {
  if (Number(text.value) !== next) text.value = String(next)
})

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  text.value = raw
  const parsed = Number(raw)
  // Only propagate a real number; leave the model untouched while the field is
  // empty or mid-edit, so the user can clear and retype freely.
  if (raw.trim() !== '' && Number.isFinite(parsed)) value.value = parsed
}

function onBlur(): void {
  const parsed = Number(text.value)
  if (text.value.trim() === '' || !Number.isFinite(parsed)) text.value = String(value.value)
}
</script>

<template>
  <label class="field">
    <span class="label">{{ label }}</span>
    <span class="control">
      <input :value="text" type="number" :step="step ?? 1" @input="onInput" @blur="onBlur" />
      <span v-if="suffix" class="suffix">{{ suffix }}</span>
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
  font-size: var(--text-md);
}
.control {
  display: flex;
  align-items: center;
  gap: 6px;
}
input {
  flex: 1;
  min-width: 0;
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
input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.suffix {
  color: var(--text-muted);
  font-size: var(--text-md);
  white-space: nowrap;
}
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
