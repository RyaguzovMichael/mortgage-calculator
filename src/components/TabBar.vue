<script setup lang="ts" generic="T extends string">
// A view switcher. Not for picking a data series — those carry a colour swatch
// and live with their chart.
defineProps<{ tabs: readonly { readonly id: T; readonly label: string }[] }>()

const active = defineModel<T>({ required: true })
</script>

<template>
  <div class="tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="tab.id === active"
      :class="{ on: tab.id === active }"
      @click="active = tab.id"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
}
button {
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  padding: 6px 8px;
  font: inherit;
  font-size: var(--text-md);
  white-space: nowrap;
  cursor: pointer;
  /* Sits on the container's border so the selected tab's line covers it. */
  margin-bottom: -1px;
}
button:hover {
  color: var(--text-secondary);
}
button.on {
  color: var(--text-primary);
  border-bottom-color: var(--series-1);
}
button:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -2px;
}
</style>
