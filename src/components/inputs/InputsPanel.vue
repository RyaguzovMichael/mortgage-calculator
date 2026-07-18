<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PlansTab from './PlansTab.vue'

const { t } = useI18n()

// The panel used to host every input behind a tab bar; the apartment and money
// start conditions have moved to their own page (ConditionsView), so what remains
// on the calculator is the plan board — the one input that belongs beside the
// results it drives.
</script>

<template>
  <aside class="panel card">
    <header>
      <h2>{{ t('inputsPanel.title') }}</h2>
    </header>
    <PlansTab />
  </aside>
</template>

<style scoped>
/* .card gives the surface and padding; .panel only adds the column layout. */
.panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
}
h2 {
  font-size: var(--text-xl);
  margin: 0;
}
</style>
