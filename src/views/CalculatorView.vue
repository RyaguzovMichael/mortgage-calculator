<script setup lang="ts">
import InputsPanel from '@/components/inputs/InputsPanel.vue'
import SummaryTable from '@/components/results/SummaryTable.vue'
import NetWorthChart from '@/components/results/NetWorthChart.vue'
import ScheduleTable from '@/components/results/ScheduleTable.vue'
</script>

<template>
  <div class="layout">
    <InputsPanel />
    <main>
      <SummaryTable />
      <NetWorthChart />
      <ScheduleTable />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 14px;
  max-width: 1500px;
  margin: 0 auto;
}
main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
