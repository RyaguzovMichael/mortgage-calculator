<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import TabBar from '../TabBar.vue'
import { tabButtonId, tabPanelId } from '../tabIds'
import ApartmentTab from './ApartmentTab.vue'
import MoneyTab from './MoneyTab.vue'
import DepositsTab from './DepositsTab.vue'
import PlansTab from './PlansTab.vue'
import LoansTab from './LoansTab.vue'

const { reset } = useInputs()
const { t } = useI18n()

// Grouped by what the number is *about*, not by which engine type holds it: the
// deposit rate for the sale money lives with the sale, because that is the
// decision it belongs to.
const TAB_IDS = ['apartment', 'money', 'deposits', 'plans', 'loans'] as const
type TabId = (typeof TAB_IDS)[number]
const TABS = computed(() => TAB_IDS.map((id) => ({ id, label: t(`inputsPanel.tabs.${id}`) })))

const active = ref<TabId>('apartment')
</script>

<template>
  <aside class="panel card">
    <header>
      <h2>{{ t('inputsPanel.title') }}</h2>
      <button type="button" @click="reset">{{ t('inputsPanel.reset') }}</button>
    </header>

    <TabBar v-model="active" :tabs="TABS" base="inputs" />

    <!-- One tabpanel per tab: the id/labelledby pair ties it to its tab button, so
         a screen reader announces the panel it just moved to. v-show, not v-if, so
         every panel keeps its field state while hidden. -->
    <div
      v-show="active === 'apartment'"
      class="tabpanel"
      role="tabpanel"
      :id="tabPanelId('inputs', 'apartment')"
      :aria-labelledby="tabButtonId('inputs', 'apartment')"
    >
      <ApartmentTab />
    </div>

    <div
      v-show="active === 'money'"
      class="tabpanel"
      role="tabpanel"
      :id="tabPanelId('inputs', 'money')"
      :aria-labelledby="tabButtonId('inputs', 'money')"
    >
      <MoneyTab />
    </div>

    <div
      v-show="active === 'deposits'"
      class="tabpanel"
      role="tabpanel"
      :id="tabPanelId('inputs', 'deposits')"
      :aria-labelledby="tabButtonId('inputs', 'deposits')"
    >
      <DepositsTab />
    </div>

    <div
      v-show="active === 'plans'"
      class="tabpanel"
      role="tabpanel"
      :id="tabPanelId('inputs', 'plans')"
      :aria-labelledby="tabButtonId('inputs', 'plans')"
    >
      <PlansTab />
    </div>

    <div
      v-show="active === 'loans'"
      class="tabpanel"
      role="tabpanel"
      :id="tabPanelId('inputs', 'loans')"
      :aria-labelledby="tabButtonId('inputs', 'loans')"
    >
      <LoansTab />
    </div>
  </aside>
</template>

<style scoped>
/* .card gives the surface and padding; .panel only adds the column layout. */
.panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
/* The tab's sections stack with the same rhythm the panel uses between its own
   parts. */
.tabpanel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h2 {
  font-size: var(--text-xl);
  margin: 0;
}
/* Scoped to the header: a bare `button` rule would also repaint the tabs, which
   need their own selected state. */
header button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
header button:hover {
  color: var(--text-primary);
}
</style>
