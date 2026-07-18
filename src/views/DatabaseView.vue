<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DepositsTab from '@/components/inputs/DepositsTab.vue'
import LoansTab from '@/components/inputs/LoansTab.vue'

const { t } = useI18n()
</script>

<template>
  <div class="layout">
    <h1>{{ t('databaseView.title') }}</h1>

    <div class="columns">
      <section class="card">
        <h2>{{ t('databaseView.depositsTitle') }}</h2>
        <DepositsTab />
      </section>

      <section class="card">
        <h2>{{ t('databaseView.loansTitle') }}</h2>
        <LoansTab />
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
h1 {
  font-size: var(--text-xl);
  margin: 0;
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
