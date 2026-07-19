<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

defineProps<{ label: string; suffix?: string; step?: number; hint?: string }>()
const value = defineModel<number>({ required: true })

// Strips everything but digits, a single leading minus, and a single decimal
// point, so pasted or mid-edit text never confuses the grouping/parsing below.
function sanitize(raw: string): string {
  const stripped = raw.replace(/[^\d.-]/g, '')
  const negative = stripped.startsWith('-')
  const digits = stripped.replace(/-/g, '')
  const dot = digits.indexOf('.')
  const body = dot === -1 ? digits : digits.slice(0, dot + 1) + digits.slice(dot + 1).replace(/\./g, '')
  return (negative ? '-' : '') + body
}

// Inserts a thousands-separator space into the integer part, e.g. "1234567.5"
// -> "1 234 567.5", so large money values stay readable while typing.
function group(sanitized: string): string {
  const negative = sanitized.startsWith('-')
  const body = negative ? sanitized.slice(1) : sanitized
  const [intPart = '', decPart] = body.split('.')
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (negative ? '-' : '') + groupedInt + (decPart === undefined ? '' : '.' + decPart)
}

// The input's text is kept separate from the model so a half-typed or emptied
// field never writes a non-number into the model. `v-model.number` does not
// protect this: Vue's looseToNumber returns the raw STRING when parseFloat fails,
// so clearing the field would put "" into a number slot, the deep watch would
// save it, and the whole saved state would be rejected on reload.
const text = ref(group(sanitize(String(value.value))))

// Reflect external changes (the reset button, a preset) back into the text.
watch(value, (next) => {
  if (Number(sanitize(text.value)) !== next) text.value = group(sanitize(String(next)))
})

// Counts the non-space characters up to `index`, so the caret can be restored
// at the same logical position after the grouping spaces shift it around.
function significantCount(text: string, index: number): number {
  return text.slice(0, index).replace(/\s/g, '').length
}

function caretIndexForSignificantCount(formatted: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ' ') seen++
    if (seen === count) return i + 1
  }
  return formatted.length
}

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const caret = input.selectionStart ?? input.value.length
  const significantBeforeCaret = significantCount(input.value, caret)
  const sanitized = sanitize(input.value)
  const formatted = group(sanitized)
  text.value = formatted
  const parsed = Number(sanitized)
  // Only propagate a real number; leave the model untouched while the field is
  // empty or mid-edit, so the user can clear and retype freely.
  if (sanitized.trim() !== '' && sanitized !== '-' && Number.isFinite(parsed)) value.value = parsed
  void nextTick(() => {
    const caretIndex = caretIndexForSignificantCount(formatted, significantBeforeCaret)
    input.setSelectionRange(caretIndex, caretIndex)
  })
}

function onBlur(): void {
  const sanitized = sanitize(text.value)
  const parsed = Number(sanitized)
  text.value =
    sanitized.trim() === '' || !Number.isFinite(parsed)
      ? group(sanitize(String(value.value)))
      : group(sanitized)
}
</script>

<template>
  <label class="field">
    <span class="label">{{ label }}</span>
    <span class="control">
      <input :value="text" type="text" inputmode="decimal" @input="onInput" @blur="onBlur" />
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
