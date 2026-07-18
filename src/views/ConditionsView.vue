<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useInputs } from '@/app/useInputs'
import ApartmentTab from '@/components/inputs/ApartmentTab.vue'
import MoneyTab from '@/components/inputs/MoneyTab.vue'

const { t } = useI18n()
const { startOver } = useInputs()
const router = useRouter()

// Start over blanks the personal conditions and walks the user back through the
// wizard — the same thing the old left-panel Reset did, now living with the
// conditions it resets.
function reset(): void {
  startOver()
  router.push({ name: 'start' })
}
</script>

<template>
  <div class="layout">
    <header class="head">
      <h1>{{ t('conditionsView.title') }}</h1>
      <button type="button" @click="reset">{{ t('conditionsView.reset') }}</button>
    </header>

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
.head button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
.head button:hover {
  color: var(--text-primary);
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
