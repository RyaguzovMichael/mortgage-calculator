<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InputsPanel from '@/components/inputs/InputsPanel.vue'
import SummaryTable from '@/components/results/SummaryTable.vue'
import RunControls from '@/components/results/RunControls.vue'
import NetWorthChart from '@/components/results/NetWorthChart.vue'
import ScheduleTable from '@/components/results/ScheduleTable.vue'
import TabBar from '@/components/TabBar.vue'
import { tabButtonId, tabPanelId } from '@/components/tabIds'

const { t } = useI18n()

// The summary stays put above these: it is the answer, and the chart and the
// schedule are two ways of auditing it.
type ViewId = 'chart' | 'schedule'
const VIEWS = computed(() => [
  { id: 'chart' as const, label: t('calculatorView.viewsChart') },
  { id: 'schedule' as const, label: t('calculatorView.viewsSchedule') },
])

const view = ref<ViewId>('chart')
</script>

<template>
  <div class="layout">
    <div class="panel-scroll">
      <InputsPanel />
    </div>
    <main>
      <div class="controls card">
        <RunControls />
      </div>
      <SummaryTable />
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
  height: 100%;
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
/* Sits between the answer (the summary) and the two ways of auditing it: which
   plans are on the board, plus when the clock starts and how far it runs. */
.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
