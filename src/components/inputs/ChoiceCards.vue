<script setup lang="ts" generic="T extends string">
import AppIcon from '@/components/AppIcon.vue'

// A group of big icon buttons — the wizard's answer to a dropdown. Exactly one is
// chosen, radio-style, but each option is a card with its own glyph and a line of
// prose, so the whole set of choices is visible at once instead of hidden behind a
// closed <select>.
export interface Choice<V extends string> {
  value: V
  label: string
  description?: string
  icon: string
}

defineProps<{ options: readonly Choice<T>[]; ariaLabel?: string }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="cards" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :class="{ card: true, on: model === option.value }"
      @click="model = option.value"
    >
      <AppIcon :path="option.icon" :size="28" class="glyph" />
      <span class="label">{{ option.label }}</span>
      <span v-if="option.description" class="description">{{ option.description }}</span>
    </button>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 16px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-1);
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.12s,
    background 0.12s,
    color 0.12s;
}
.card:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}
.glyph {
  color: var(--text-muted);
}
.card:hover .glyph,
.card.on .glyph {
  color: var(--series-1);
}
.label {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}
.description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.35;
}
.card.on {
  border-color: var(--series-1);
  background: color-mix(in srgb, var(--series-1) 8%, var(--surface-1));
}
.card.on:focus-visible,
.card:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: 1px;
}
</style>
