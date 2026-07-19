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
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
  transition:
    border-color var(--transition),
    background var(--transition),
    color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}
.card:hover {
  border-color: var(--accent);
  color: var(--text-primary);
  transform: var(--lift);
}
.glyph {
  color: var(--text-muted);
}
.card:hover .glyph,
.card.on .glyph {
  color: var(--accent);
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
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 4px 14px var(--accent-glow);
}
.card.on:focus-visible,
.card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-glow);
}
</style>
