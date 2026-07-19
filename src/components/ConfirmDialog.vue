<script setup lang="ts">
import { mdiAlertOutline } from '@mdi/js'
import AppIcon from '@/components/AppIcon.vue'

// A small blocking overlay for actions that cannot be undone (Reset). Kept
// separate from WizardShell's overlay mode: that one walks steps, this one asks
// a single yes/no question and gets out of the way.
defineProps<{
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <section class="dialog card" role="alertdialog" aria-modal="true" :aria-label="title">
      <div class="head">
        <span class="icon"><AppIcon :path="mdiAlertOutline" :size="22" /></span>
        <h2>{{ title }}</h2>
      </div>
      <p class="message">{{ message }}</p>
      <footer class="controls">
        <button type="button" class="secondary" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button type="button" class="danger" @click="emit('confirm')">{{ confirmLabel }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 40px;
  overflow-y: auto;
  background: rgba(10, 12, 18, 0.72);
}
.dialog {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-lg);
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon {
  display: flex;
  color: var(--critical);
}
h2 {
  font-size: var(--text-lg);
  margin: 0;
}
.message {
  color: var(--text-secondary);
  font-size: var(--text-md);
  margin: 0;
}
.controls {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.controls button {
  border-radius: var(--radius-sm);
  padding: 8px 16px;
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
.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.secondary:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.danger {
  background: var(--critical);
  color: #fff;
  border-color: transparent;
  font-weight: 600;
}
.danger:hover {
  box-shadow: 0 6px 16px color-mix(in srgb, var(--critical) 40%, transparent);
  transform: var(--lift);
}
</style>
