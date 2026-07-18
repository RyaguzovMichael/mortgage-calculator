<script setup lang="ts">
import { ref } from 'vue'
import InputsPanel from '@/components/inputs/InputsPanel.vue'
import SummaryTable from '@/components/results/SummaryTable.vue'
import PlanVisibility from '@/components/results/PlanVisibility.vue'
import NetWorthChart from '@/components/results/NetWorthChart.vue'
import ScheduleTable from '@/components/results/ScheduleTable.vue'
import TabBar from '@/components/TabBar.vue'
import { tabButtonId, tabPanelId } from '@/components/tabIds'

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
    <div class="panel-scroll">
      <InputsPanel />
    </div>
    <main>
      <SummaryTable />
      <PlanVisibility />
      <div class="views">
        <TabBar v-model="view" :tabs="VIEWS" base="views" />
        <!-- One panel, whose id/labelledby track the active tab: only the shown
             view is mounted, so the panel wears the active tab's association. -->
        <div
          class="view-panel"
          role="tabpanel"
          :id="tabPanelId('views', view)"
          :aria-labelledby="tabButtonId('views', view)"
        >
          <NetWorthChart v-if="view === 'chart'" />
          <ScheduleTable v-else />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* The page itself never scrolls: the layout is exactly one viewport tall and each
   column scrolls on its own. */
.layout {
  display: grid;
  grid-template-columns: 430px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  height: 100dvh;
  overflow: hidden;
}
.panel-scroll {
  min-height: 0;
  overflow-y: auto;
  /* Reserve the scrollbar's width up front so switching to a short tab does not
     shift the fields sideways. */
  scrollbar-gutter: stable;
}
main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  /* Only bites on a very short viewport, where the chart hits its floor: better
     that this column scrolls than that the page does. */
  overflow-y: auto;
}
.views {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  flex: 1;
  min-height: 0;
}
/* The tab strip keeps its natural height; the panel below it takes the rest and
   hands that height straight to its card. Cannot use height: 100% — that would
   resolve against .views and overflow by exactly the height of the strip. */
.view-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.view-panel > section {
  flex: 1;
  min-height: 0;
}
/* One column and no viewport pinning: on a narrow screen a fixed height would
   trap the inputs in a sliver. */
/* One column, and the page scrolls again: pinning to the viewport on a phone
   would trap the inputs in a sliver. */
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
    overflow: visible;
  }
  .panel-scroll {
    overflow-y: visible;
  }
  main {
    overflow-y: visible;
  }
  .views {
    min-height: 70dvh;
  }
}
</style>
