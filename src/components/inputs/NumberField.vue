<script setup lang="ts">
defineProps<{ label: string; suffix?: string; step?: number; hint?: string }>()
const value = defineModel<number>({ required: true })
</script>

<template>
  <label class="field">
    <span class="label">{{ label }}</span>
    <span class="control">
      <input v-model.number="value" type="number" :step="step ?? 1" />
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
