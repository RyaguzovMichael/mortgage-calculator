<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  mdiAutoFix,
  mdiContentCopy,
  mdiPencilOutline,
  mdiPlus,
  mdiRefresh,
  mdiTrashCanOutline,
} from '@mdi/js'
import { useInputs, MAX_SHOWN } from '@/app/useInputs'
import { useFormat, money } from '@/app/useFormat'
import type { GeneratorOptions, PlanMetrics } from '@/engine/bestPlans'
import { planNeedsExistingApartment } from '@/engine/types/inputs'
import type { BestCategoryId, PurchasePlan } from '@/engine/types/plan'
import AppIcon from '@/components/AppIcon.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PlanDetailsDialog from '@/components/PlanDetailsDialog.vue'
import PlanWizard from './PlanWizard.vue'
import PlanEditorDialog from './PlanEditorDialog.vue'
import GeneratorDialog from './GeneratorDialog.vue'

const {
  inputs,
  newPlanDraft,
  upsertPlan,
  duplicatePlan,
  removePlan,
  isShown,
  canShow,
  isCompatible,
  toggleShown,
  buildBestPlans,
  bestProgress,
  noPlansFit,
  conditionsChanged,
  lastGeneratorOptions,
  generatedDetails,
} = useInputs()
const { t } = useI18n()
const { describePlan, monthsWord } = useFormat()

// "+ Add" opens the stepped wizard (one decision per screen — better for a plan
// built from scratch); "Edit" opens the all-in-one dialog instead, since an
// existing plan just needs a few fields nudged, not walked through again.
const creating = ref<PurchasePlan | null>(null)
const editing = ref<PurchasePlan | null>(null)
// Clicking any plan name opens this read-only look at the plan — no editing.
const details = ref<PurchasePlan | null>(null)

function openCreate(): void {
  creating.value = newPlanDraft()
}
function onCreateSave(plan: PurchasePlan): void {
  upsertPlan(plan)
  creating.value = null
}
function onEditSave(plan: PurchasePlan): void {
  upsertPlan(plan)
  editing.value = null
}

// Duplicate is instant, not a trip through a dialog. It is also the only way to
// "edit" a generated plan: the copy lands in "Your plans" as an ordinary custom
// plan, safe from the next recalculation.
function onDuplicate(plan: PurchasePlan): void {
  duplicatePlan(plan.id, t('plansTab.copyName', { name: plan.name }))
}

// Deleting a plan is irreversible (there's no undo, and it also drops the plan off
// the board if it was shown) — same reasoning as Reset on the conditions page, so
// it gets the same confirm-first treatment. Only custom plans can be deleted.
const deleting = ref<PurchasePlan | null>(null)
function requestRemove(plan: PurchasePlan): void {
  deleting.value = plan
}
function confirmRemove(): void {
  if (deleting.value) removePlan(deleting.value.id)
  deleting.value = null
}

// --- "Build best plans for me": enumerate every plan the conditions allow, run
// them all, and put the category winners on the board as generated plans. The name
// a winner wears is its localized category label(s), supplied here so useInputs
// stays out of i18n. ---
function categoryLabel(category: BestCategoryId): string {
  return t(`bestPlans.categories.${category}`)
}
// The run needs facts the app can't guess (sell or keep, when, where you live, the
// time budget), so a build/recalculate first opens the dialog; it hands them back
// and the search starts.
const generatorOpen = ref(false)
function onBuild(): void {
  generatorOpen.value = true
}
function onRun(options: GeneratorOptions): void {
  generatorOpen.value = false
  void buildBestPlans(options, categoryLabel)
}
const progressPct = computed(() =>
  bestProgress.total > 0 ? `${(bestProgress.done / bestProgress.total) * 100}%` : '0%',
)

// The one-line headline a plan earned in a given category, formatted from its metric.
function metricFor(category: BestCategoryId, m: PlanMetrics): string {
  switch (category) {
    case 'earliest-move-in':
      return t('bestPlans.metrics.move', { n: m.purchaseMonth ?? 0 })
    case 'shortest-rent':
      return t('bestPlans.metrics.rent', { n: m.monthsRenting, word: monthsWord(m.monthsRenting) })
    case 'best-assets':
      return t('bestPlans.metrics.assets', { amount: money(m.netWorthAtHorizon) })
    case 'shortest-loan':
      return t('bestPlans.metrics.loan', { n: m.debtFreeMonth ?? 0 })
  }
}

// A plan is "unavailable" when its housing situation does not match the start
// condition (a selling plan with no owned flat, say) — it cannot go on the board.
// Those are hidden by default so the list shows only what you can actually compare;
// the filter reveals them. A plan already on the board is always shown, so one that
// became incompatible after a conditions change can still be taken off.
const showAll = ref(false)
const allBoardPlans = computed<readonly PurchasePlan[]>(() => [
  ...inputs.plans.generated,
  ...inputs.plans.custom,
])
const hasHidden = computed(() =>
  allBoardPlans.value.some((plan) => !isCompatible(plan.id) && !isShown(plan.id)),
)
function visible(plans: readonly PurchasePlan[]): PurchasePlan[] {
  return plans.filter((plan) => showAll.value || isCompatible(plan.id) || isShown(plan.id))
}
const visibleCustom = computed(() => visible(inputs.plans.custom))
const visibleGenerated = computed(() =>
  generatedDetails.value.filter(
    (detail) => showAll.value || isCompatible(detail.plan.id) || isShown(detail.plan.id),
  ),
)

function showTitle(plan: PurchasePlan): string {
  if (isShown(plan.id)) return t('plansTab.showRemove')
  if (!isCompatible(plan.id)) {
    return planNeedsExistingApartment(plan)
      ? t('plansTab.showNeedsApartment')
      : t('plansTab.showNeedsNoApartment')
  }
  return canShow(plan.id) ? t('plansTab.showAdd') : t('plansTab.showMax', { max: MAX_SHOWN })
}
</script>

<template>
  <section class="field-group builder">
    <header class="section-head">
      <h3>{{ t('bestPlans.title') }}</h3>
      <button
        v-if="generatedDetails.length > 0 && !conditionsChanged && !bestProgress.running"
        type="button"
        class="recalc"
        @click="onBuild"
      >
        <AppIcon :path="mdiRefresh" :size="16" />
        {{ t('bestPlans.recalculate') }}
      </button>
    </header>
    <p class="note">{{ t('bestPlans.note') }}</p>

    <button
      v-if="generatedDetails.length === 0 && !bestProgress.running"
      type="button"
      class="build"
      @click="onBuild"
    >
      <AppIcon :path="mdiAutoFix" :size="18" />
      {{ t('bestPlans.button') }}
    </button>

    <!-- A start condition moved since the last run: the small header button is not
         enough of a nudge, since the board is now quietly showing stale winners. -->
    <template v-if="generatedDetails.length > 0 && conditionsChanged && !bestProgress.running">
      <p class="conditions-changed-hint" role="status">
        {{ t('bestPlans.conditionsChangedHint') }}
      </p>
      <button type="button" class="build" @click="onBuild">
        <AppIcon :path="mdiRefresh" :size="18" />
        {{ t('bestPlans.recalculate') }}
      </button>
    </template>

    <div v-if="bestProgress.running" class="progress" role="status" aria-live="polite">
      <span class="progress-label">{{ t('bestPlans.progressTitle') }}</span>
      <div class="bar"><div class="fill" :style="{ width: progressPct }" /></div>
      <span class="progress-count">{{
        t('bestPlans.progressCount', { done: bestProgress.done, total: bestProgress.total })
      }}</span>
    </div>

    <p v-if="noPlansFit && !bestProgress.running" class="none-fit" role="status">
      {{ t('bestPlans.noneFit') }}
    </p>

    <div v-for="detail in visibleGenerated" :key="detail.plan.id" class="built-in">
      <div class="row">
        <div class="show">
          <input
            type="checkbox"
            :checked="isShown(detail.plan.id)"
            :disabled="!canShow(detail.plan.id)"
            :title="showTitle(detail.plan)"
            @change="toggleShown(detail.plan.id)"
          />
          <button type="button" class="name-link" @click="details = detail.plan">
            {{ detail.plan.name }}
          </button>
        </div>
        <div class="actions">
          <button
            type="button"
            :title="t('plansTab.duplicateTitle')"
            @click="onDuplicate(detail.plan)"
          >
            <AppIcon :path="mdiContentCopy" :size="18" />
          </button>
        </div>
      </div>
      <span class="item-terms">{{
        describePlan(detail.plan, inputs.loans.products, inputs.deposits.products)
      }}</span>
      <div class="badges">
        <span v-for="category in detail.plan.categories" :key="category" class="badge">
          {{ categoryLabel(category) }} · {{ metricFor(category, detail.metrics) }}
        </span>
      </div>
    </div>
  </section>

  <div v-if="hasHidden" class="filter">
    <label class="switch">
      <input v-model="showAll" type="checkbox" />
      <span class="track"><span class="thumb" /></span>
      <span>{{ t('plansTab.showAllLabel') }}</span>
    </label>
  </div>

  <section class="field-group">
    <header class="section-head">
      <h3>{{ t('plansTab.ownTitle') }}</h3>
      <button type="button" class="add" @click="openCreate">
        <AppIcon :path="mdiPlus" :size="16" />
        {{ t('plansTab.addButton') }}
      </button>
    </header>
    <p v-if="inputs.plans.custom.length === 0" class="note">{{ t('plansTab.ownEmpty') }}</p>

    <div v-for="plan in visibleCustom" :key="plan.id" class="built-in">
      <div class="row">
        <div class="show">
          <input
            type="checkbox"
            :checked="isShown(plan.id)"
            :disabled="!canShow(plan.id)"
            :title="showTitle(plan)"
            @change="toggleShown(plan.id)"
          />
          <button type="button" class="name-link" @click="details = plan">{{ plan.name }}</button>
        </div>
        <div class="actions">
          <button type="button" :title="t('plansTab.duplicateTitle')" @click="onDuplicate(plan)">
            <AppIcon :path="mdiContentCopy" :size="18" />
          </button>
          <button type="button" :title="t('plansTab.editTitle')" @click="editing = plan">
            <AppIcon :path="mdiPencilOutline" :size="18" />
          </button>
          <button type="button" :title="t('plansTab.removeTitle')" @click="requestRemove(plan)">
            <AppIcon :path="mdiTrashCanOutline" :size="18" />
          </button>
        </div>
      </div>
      <span class="item-terms">{{
        describePlan(plan, inputs.loans.products, inputs.deposits.products)
      }}</span>
    </div>
  </section>

  <PlanWizard
    v-if="creating"
    :initial="creating"
    mode="create"
    @save="onCreateSave"
    @cancel="creating = null"
  />
  <PlanEditorDialog v-if="editing" :initial="editing" @save="onEditSave" @cancel="editing = null" />
  <PlanDetailsDialog v-if="details" :plan="details" @close="details = null" />
  <GeneratorDialog
    v-if="generatorOpen"
    :initial="lastGeneratorOptions"
    @run="onRun"
    @cancel="generatorOpen = false"
  />

  <ConfirmDialog
    v-if="deleting"
    :title="t('plansTab.removeConfirmTitle')"
    :message="t('plansTab.removeConfirmMessage', { name: deleting.name })"
    :confirm-label="t('plansTab.removeConfirmAction')"
    :cancel-label="t('plansTab.removeConfirmCancel')"
    @confirm="confirmRemove"
    @cancel="deleting = null"
  />
</template>

<style scoped>
/* Most row/name/terms styling comes from assets/forms.css (.field-group, .note,
   .section-head, .built-in, .item-name, .item-terms). Only the show-checkbox row,
   the action buttons, the filter switch, and the build/progress/generated block are
   specific to this tab. */
.show {
  display: flex;
  align-items: center;
  gap: 8px;
}
.show input {
  accent-color: var(--accent);
  cursor: pointer;
}
.show input:disabled {
  cursor: not-allowed;
}
/* The plan name reads as text but is a button — click it for the details dialog. */
.name-link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  border-bottom: 1px dotted transparent;
  transition: color var(--transition);
}
.name-link:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.actions {
  display: flex;
  gap: 4px;
}
.actions button {
  display: flex;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  padding: 5px;
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition);
}
.actions button:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.add,
.recalc {
  display: flex;
  align-items: center;
  gap: 3px;
}
.recalc {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition);
}
.recalc:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

/* The category badges under a generated plan: what it won, and by how much. */
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.badge {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 10px;
}

/* The "build best plans" call to action and its progress bar. */
.build {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 11px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  font: inherit;
  font-size: var(--text-md);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px var(--accent-glow);
  transition:
    box-shadow var(--transition),
    transform var(--transition);
}
.build:hover {
  box-shadow: 0 6px 20px var(--accent-glow);
  transform: var(--lift);
}
.progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.progress-label {
  font-size: var(--text-md);
  color: var(--text-secondary);
}
.bar {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent-gradient);
  transition: width 0.15s linear;
}
.progress-count {
  align-self: flex-end;
  font-family: var(--mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
/* Shown when a start condition has moved since the generated plans were built —
   the accent colour on both text and border, matching the big button under it, so
   the two read as one call to action rather than an error state. */
.conditions-changed-hint {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--accent);
  font-size: var(--text-md);
}

/* Shown when a run met the time budget with no surviving plan — a nudge, not an
   error, so it reads in the warning colour rather than the destructive one. */
.none-fit {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: var(--text-md);
}

/* The filter tumbler: a native checkbox turned into a sliding switch. */
.filter {
  display: flex;
  justify-content: flex-end;
}
.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: var(--text-md);
  color: var(--text-secondary);
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.track {
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition: background 0.15s;
}
.thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-muted);
  transition:
    transform 0.15s,
    background 0.15s;
}
.switch input:checked + .track {
  background: var(--accent-gradient);
  border-color: transparent;
}
.switch input:checked + .track .thumb {
  transform: translateX(14px);
  background: var(--accent-contrast);
}
.switch input:focus-visible + .track {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-glow);
}
</style>
