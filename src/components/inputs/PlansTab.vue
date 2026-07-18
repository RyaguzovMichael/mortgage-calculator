<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useInputs, MAX_SHOWN } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { BUILT_IN_PLANS } from '@/infrastructure/planCatalogue'
import { planNeedsExistingApartment } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import AppIcon from '@/components/AppIcon.vue'
import PlanWizard from './PlanWizard.vue'

const {
  inputs,
  allPlans,
  newPlanDraft,
  upsertPlan,
  removePlan,
  isShown,
  canShow,
  isCompatible,
  toggleShown,
} = useInputs()
const { t } = useI18n()
const { describePlan } = useFormat()

// The wizard is the one editor now — both "+ Add" and "Edit" open it. null means
// closed; otherwise it carries the draft (a fresh one to create, a clone to edit)
// and which verb to show.
const editing = ref<{ plan: PurchasePlan; mode: 'create' | 'edit' } | null>(null)

function openCreate(): void {
  editing.value = { plan: newPlanDraft(), mode: 'create' }
}
function openEdit(plan: PurchasePlan): void {
  editing.value = { plan, mode: 'edit' }
}
function onSave(plan: PurchasePlan): void {
  upsertPlan(plan)
  editing.value = null
}

// A plan is "unavailable" when its housing situation does not match the start
// condition (a selling plan with no owned flat, say) — it cannot go on the board.
// Those are hidden by default so the list shows only what you can actually compare;
// the filter reveals them. A plan already on the board is always shown, so one that
// became incompatible after a conditions change can still be taken off.
const showAll = ref(false)
const hasHidden = computed(() =>
  allPlans.value.some((plan) => !isCompatible(plan.id) && !isShown(plan.id)),
)
function visible(plans: readonly PurchasePlan[]): PurchasePlan[] {
  return plans.filter((plan) => showAll.value || isCompatible(plan.id) || isShown(plan.id))
}
const visibleBuiltIns = computed(() => visible(BUILT_IN_PLANS))
const visibleCustom = computed(() => visible(inputs.plans.custom))

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
  <div v-if="hasHidden" class="filter">
    <label class="switch">
      <input v-model="showAll" type="checkbox" />
      <span class="track"><span class="thumb" /></span>
      <span>{{ t('plansTab.showAllLabel') }}</span>
    </label>
  </div>

  <section class="field-group">
    <h3>{{ t('plansTab.builtInTitle') }}</h3>
    <p class="note">{{ t('plansTab.builtInNote') }}</p>
    <div v-for="plan in visibleBuiltIns" :key="plan.id" class="built-in">
      <label class="show">
        <input
          type="checkbox"
          :checked="isShown(plan.id)"
          :disabled="!canShow(plan.id)"
          :title="showTitle(plan)"
          @change="toggleShown(plan.id)"
        />
        <span class="item-name">{{ plan.name }}</span>
      </label>
      <span class="item-terms">{{
        describePlan(plan, inputs.loans.products, inputs.deposits.products)
      }}</span>
    </div>
  </section>

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
        <label class="show">
          <input
            type="checkbox"
            :checked="isShown(plan.id)"
            :disabled="!canShow(plan.id)"
            :title="showTitle(plan)"
            @change="toggleShown(plan.id)"
          />
          <span class="item-name">{{ plan.name }}</span>
        </label>
        <div class="actions">
          <button type="button" :title="t('plansTab.editTitle')" @click="openEdit(plan)">
            <AppIcon :path="mdiPencilOutline" :size="18" />
          </button>
          <button type="button" :title="t('plansTab.removeTitle')" @click="removePlan(plan.id)">
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
    v-if="editing"
    :initial="editing.plan"
    :mode="editing.mode"
    @save="onSave"
    @cancel="editing = null"
  />
</template>

<style scoped>
/* Most row/name/terms styling comes from assets/forms.css (.field-group, .note,
   .section-head, .built-in, .item-name, .item-terms). Only the show-checkbox row,
   the edit/delete actions, and the filter switch are specific to this tab. */
.show {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.show input {
  accent-color: var(--series-1);
}
.show input:disabled {
  cursor: not-allowed;
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
  border-radius: 6px;
  padding: 5px;
  cursor: pointer;
}
.actions button:hover {
  color: var(--text-primary);
}
.add {
  display: flex;
  align-items: center;
  gap: 3px;
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
  background: var(--series-1);
  border-color: var(--series-1);
}
.switch input:checked + .track .thumb {
  transform: translateX(14px);
  background: #fff;
}
.switch input:focus-visible + .track {
  outline: 2px solid var(--series-1);
  outline-offset: 2px;
}
</style>
