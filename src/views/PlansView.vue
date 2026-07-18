<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PlansTab from '@/components/inputs/PlansTab.vue'

const { t } = useI18n()
</script>

<template>
  <div class="layout">
    <h1>{{ t('plansView.title') }}</h1>

    <section class="card">
      <PlansTab />
    </section>
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
section.card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style>
