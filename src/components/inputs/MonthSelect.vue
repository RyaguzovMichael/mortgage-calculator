<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ label: string; hint?: string }>()
// The engine stores a 1–12 calendar month; the select shows localized names.
const month = defineModel<number>({ required: true })

const { tm, rt } = useI18n()

// tm returns the raw message array; rt renders each entry through the active
// locale so a language switch is reflected without remount.
const monthNames = tm('common.monthNames') as unknown[]
</script>

<template>
  <label class="field">
    <span class="label">{{ label }}</span>
    <select v-model.number="month" class="select">
      <option v-for="(name, index) in monthNames" :key="index" :value="index + 1">
        {{ rt(name as string) }}
      </option>
    </select>
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
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
