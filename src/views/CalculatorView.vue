<script setup lang="ts">
import { ref } from 'vue'
import InputsPanel from '@/components/inputs/InputsPanel.vue'
import SummaryTable from '@/components/results/SummaryTable.vue'
import NetWorthChart from '@/components/results/NetWorthChart.vue'
import ScheduleTable from '@/components/results/ScheduleTable.vue'
import TabBar from '@/components/TabBar.vue'

// The summary stays put above these: it is the answer, and the chart and the
// schedule are two ways of auditing it.
const VIEWS = [
  { id: 'chart', label: 'График' },
  { id: 'schedule', label: 'Таблица' },
] as const

type ViewId = (typeof VIEWS)[number]['id']

const view = ref<ViewId>('chart')
</script>

<template>
  <div class="layout">
    <InputsPanel />
    <main>
      <SummaryTable />
      <div class="views">
        <TabBar v-model="view" :tabs="VIEWS" />
        <NetWorthChart v-if="view === 'chart'" />
        <ScheduleTable v-else />
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 14px;
}
main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.views {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
