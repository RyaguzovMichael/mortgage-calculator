<script setup lang="ts" generic="T extends string">
import { ref } from 'vue'
import { tabButtonId, tabPanelId } from './tabIds'

// A view switcher. Not for picking a data series — those carry a colour swatch
// and live with their chart.
//
// `base` namespaces the tab/panel ids so several tab bars on one page do not
// collide. The component holding the panels must give each panel role="tabpanel",
// id=tabPanelId(base, id) and aria-labelledby=tabButtonId(base, id).
const props = defineProps<{
  tabs: readonly { readonly id: T; readonly label: string }[]
  base: string
}>()

const active = defineModel<T>({ required: true })

const list = ref<HTMLElement | null>(null)

// Arrow keys move between tabs, Home/End jump to the ends — the behaviour a screen
// reader announces the moment it enters a role="tablist". Activation follows focus
// because the panels are cheap to render.
function onKeydown(event: KeyboardEvent): void {
  const ids = props.tabs.map((tab) => tab.id)
  const current = ids.indexOf(active.value)
  let next = current
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % ids.length
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = (current - 1 + ids.length) % ids.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = ids.length - 1
  else return
  event.preventDefault()
  active.value = ids[next]!
  list.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
</script>

<template>
  <div ref="list" class="tabs" role="tablist" @keydown="onKeydown">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :id="tabButtonId(base, tab.id)"
      type="button"
      role="tab"
      :aria-selected="tab.id === active"
      :aria-controls="tabPanelId(base, tab.id)"
      :tabindex="tab.id === active ? 0 : -1"
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
  /* The labels are nowrap, so without this a strip that is a few pixels too wide
     for its column overflows it instead of stacking. */
  flex-wrap: wrap;
}
button {
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  padding: 6px 6px;
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
