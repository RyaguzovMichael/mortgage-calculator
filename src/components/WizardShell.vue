<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight, mdiCheck, mdiClose } from '@mdi/js'
import AppIcon from '@/components/AppIcon.vue'

// The chrome shared by every stepped wizard in the app — a progress line, a
// title + instruction, a body slot, and a Back/Next-or-Finish footer. Callers
// own their own step list and field bodies; this only owns the shell around
// them, so the two wizards (onboarding, the plan editor) can't drift the way
// they did before this component existed. `modal` switches between a
// full-page wizard and an overlay dialog with a close button and chevron
// icons on the footer buttons.
defineProps<{
  progress: string
  title: string
  instruction: string
  isFirst: boolean
  isLast: boolean
  backLabel: string
  nextLabel: string
  finishLabel: string
  wide?: boolean
  modal?: boolean
  closeLabel?: string
}>()
const emit = defineEmits<{ back: []; next: []; close: [] }>()
</script>

<template>
  <component :is="modal ? 'div' : 'main'" :class="modal ? 'overlay' : 'layout'">
    <section
      class="wizard card"
      :class="{ wide }"
      v-bind="modal ? { role: 'dialog', 'aria-modal': 'true' } : {}"
    >
      <header v-if="modal" class="head">
        <p class="progress">{{ progress }}</p>
        <button type="button" class="icon-btn" :title="closeLabel" @click="emit('close')">
          <AppIcon :path="mdiClose" :size="20" />
        </button>
      </header>
      <p v-else class="progress">{{ progress }}</p>

      <component :is="modal ? 'h2' : 'h1'">{{ title }}</component>
      <p class="instruction">{{ instruction }}</p>

      <div class="body">
        <slot />
      </div>

      <slot name="after-body" />

      <footer class="controls">
        <button type="button" class="secondary" :disabled="isFirst" @click="emit('back')">
          <AppIcon v-if="modal" :path="mdiChevronLeft" :size="18" />
          {{ backLabel }}
        </button>
        <button type="button" class="primary" @click="emit('next')">
          {{ isLast ? finishLabel : nextLabel }}
          <AppIcon v-if="modal" :path="isLast ? mdiCheck : mdiChevronRight" :size="18" />
        </button>
      </footer>
    </section>
  </component>
</template>

<style scoped>
.layout {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 20px;
  overflow-y: auto;
}
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  /* Pushed down from the top and sat on a near-opaque backdrop so it lands
     over — and fully hides — whatever page opened it (eg. the onboarding
     wizard, when a plan is created mid-onboarding). */
  padding: 7vh 16px 40px;
  overflow-y: auto;
  background: rgba(10, 12, 18, 0.72);
}
.wizard {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.overlay .wizard {
  box-shadow: var(--shadow-lg);
}
/* A step whose body is a list of rows, not a single field, gets room to breathe. */
.wizard.wide {
  max-width: 760px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.progress {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.icon-btn {
  display: flex;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition:
    color var(--transition),
    background var(--transition);
}
.icon-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
h1,
h2 {
  font-size: var(--text-xl);
  margin: 0;
}
.instruction {
  color: var(--text-secondary);
  font-size: var(--text-md);
  margin: 0;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 96px;
}
.overlay .body {
  min-height: 200px;
}
.controls {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.controls button {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-sm);
  padding: 9px 20px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border: 1px solid var(--border);
  transition:
    color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}
.controls button:disabled {
  opacity: 0.5;
  cursor: default;
}
.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.secondary:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent);
}
.primary {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  border-color: transparent;
  font-weight: 600;
  box-shadow: 0 4px 14px var(--accent-glow);
}
.primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px var(--accent-glow);
  transform: var(--lift);
}
</style>
