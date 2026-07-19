<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { mdiClipboardEditOutline, mdiRestore } from '@mdi/js'
import { useInputs } from '@/app/useInputs'
import ApartmentTab from '@/components/inputs/ApartmentTab.vue'
import MoneyTab from '@/components/inputs/MoneyTab.vue'
import AppIcon from '@/components/AppIcon.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const { t } = useI18n()
const { startOver } = useInputs()
const router = useRouter()

// Reset is irreversible (it blanks every personal field with no undo), and it
// used to fire on a single click right next to the non-destructive "redo
// wizard" link — easy to hit by mistake. It now always asks first.
const confirmingReset = ref(false)
function requestReset(): void {
  confirmingReset.value = true
}
function confirmReset(): void {
  confirmingReset.value = false
  startOver()
  router.push({ name: 'start' })
}
</script>

<template>
  <div class="layout">
    <header class="head">
      <h1>{{ t('conditionsView.title') }}</h1>
      <div class="head-actions">
        <RouterLink to="/start" class="redo-link">
          <AppIcon :path="mdiClipboardEditOutline" :size="16" />
          {{ t('conditionsView.redoWizard') }}
        </RouterLink>
        <button type="button" @click="requestReset">
          <AppIcon :path="mdiRestore" :size="16" />
          {{ t('conditionsView.reset') }}
        </button>
      </div>
    </header>

    <ConfirmDialog
      v-if="confirmingReset"
      :title="t('conditionsView.resetConfirmTitle')"
      :message="t('conditionsView.resetConfirmMessage')"
      :confirm-label="t('conditionsView.resetConfirmAction')"
      :cancel-label="t('conditionsView.resetConfirmCancel')"
      @confirm="confirmReset"
      @cancel="confirmingReset = false"
    />

    <div class="columns">
      <section class="card">
        <h2>{{ t('conditionsView.apartmentTitle') }}</h2>
        <ApartmentTab />
      </section>

      <section class="card">
        <h2>{{ t('conditionsView.moneyTitle') }}</h2>
        <MoneyTab />
      </section>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h1 {
  font-size: var(--text-xl);
  margin: 0;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.redo-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.redo-link:hover {
  color: var(--text-primary);
}
.head button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition);
}
.head button:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}
section.card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
section.card h2 {
  font-size: var(--text-lg);
  margin: 0;
}
@media (max-width: 900px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
