<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiChevronLeft, mdiChevronRight, mdiCheck, mdiClose } from '@mdi/js'
import { useInputs } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { planMatchesStart } from '@/engine/types/inputs'
import type { HousingSituation } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import AppIcon from '@/components/AppIcon.vue'
import ChoiceCards, { type Choice } from './ChoiceCards.vue'
import {
  BORROW_ICONS,
  BUY_WHEN_ICONS,
  DEPOSIT_ICON,
  HOUSING_ICONS,
  REPAY_ICONS,
  loanIcon,
} from './planIcons'

// The stepped editor behind "+ Add" and "Edit" on the Plans page — the same shape
// as the start-conditions wizard, one decision per screen. It edits a *draft* in
// isolation (a clone of what it was handed) and only writes back on Finish, so
// Cancel discards a half-built plan cleanly.
const props = defineProps<{ initial: PurchasePlan; mode: 'create' | 'edit' }>()
const emit = defineEmits<{ save: [plan: PurchasePlan]; cancel: [] }>()

const { inputs } = useInputs()
const { t } = useI18n()
const {
  productTerms,
  loanProductTerms,
  describePlan,
  BUY_WHEN_LABELS,
  BORROW_LABELS,
  REPAY_LABELS,
  HOUSING_LABELS,
} = useFormat()

// A mutable working copy: PurchasePlan's fields are readonly (the engine never
// mutates one), but the wizard's whole job is to edit this draft, so it strips the
// readonly for the duration and hands back a plain PurchasePlan on save.
type PlanDraft = { -readonly [K in keyof PurchasePlan]: PurchasePlan[K] }
const draft = reactive<PlanDraft>(JSON.parse(JSON.stringify(props.initial)) as PlanDraft)

// Dropping the Otbasy loan while the plan still waits on Otbasy gates would leave an
// impossible plan; coerce the trigger back to "as soon as possible". Same guard the
// old dropdown editor carried, now that the loan card can change under the trigger.
watch(
  () => draft.loan,
  (loan) => {
    if (loan !== 'otbasy' && draft.buyWhen === 'otbasy-gates') draft.buyWhen = 'asap'
  },
)

// Selling is only offered when there is a flat to sell — the existing-apartment
// start condition. With none owned, drop the option and coerce a draft that still
// carries it (a plan built back when a flat was owned) to renting.
const canSell = computed(() => inputs.existingApartment.owned)
watch(
  canSell,
  (owned) => {
    if (!owned && draft.situation === 'selling') draft.situation = 'renting'
  },
  { immediate: true },
)

// --- Which screens this plan shows, in order. borrow/repay vanish for cash (no
// loan to size or repay); the deposit screen vanishes for Otbasy (it saves to its
// own account, not a deposit). The rest are always asked. ---
type StepId = 'name' | 'loan' | 'buyWhen' | 'borrow' | 'repay' | 'situation' | 'deposit'
const steps = computed<StepId[]>(() => {
  const list: StepId[] = ['name', 'loan', 'buyWhen']
  if (draft.loan !== 'none') list.push('borrow', 'repay')
  list.push('situation')
  if (draft.loan !== 'otbasy') list.push('deposit')
  return list
})

const index = ref(0)
// Loan lives at step 2, so toggling it only adds/removes screens after the current
// one — the index stays valid — but clamp anyway rather than trust that.
watch(steps, (list) => {
  if (index.value > list.length - 1) index.value = list.length - 1
})
const step = computed<StepId>(() => steps.value[index.value]!)
const isFirst = computed(() => index.value === 0)
const isLast = computed(() => index.value === steps.value.length - 1)

function back(): void {
  if (!isFirst.value) index.value -= 1
}
function next(): void {
  if (isLast.value) emit('save', JSON.parse(JSON.stringify(draft)) as PurchasePlan)
  else index.value += 1
}

// --- Option lists for each choice screen. Labels reuse the shared format maps so
// the wizard and the summary rows never drift; descriptions are the wizard's own. ---
const loanOptions = computed<Choice<string>[]>(() => [
  {
    value: 'none',
    label: t('format.loanLabels.none'),
    description: t('planWizard.desc.loan.none'),
    icon: loanIcon('none'),
  },
  {
    value: 'otbasy',
    label: t('format.loanLabels.otbasy'),
    description: t('planWizard.desc.loan.otbasy'),
    icon: loanIcon('otbasy'),
  },
  ...inputs.loans.products.map((product) => ({
    value: product.id,
    label: product.name,
    description: loanProductTerms(product),
    icon: loanIcon(product.id),
  })),
])
const buyWhenOptions = computed<Choice<PurchasePlan['buyWhen']>[]>(() =>
  (['asap', 'after-months', 'otbasy-gates'] as const)
    .filter((value) => value !== 'otbasy-gates' || draft.loan === 'otbasy')
    .map((value) => ({
      value,
      label: BUY_WHEN_LABELS.value[value],
      description: t(
        `planWizard.desc.buyWhen.${value === 'after-months' ? 'afterMonths' : value === 'otbasy-gates' ? 'otbasyGates' : 'asap'}`,
      ),
      icon: BUY_WHEN_ICONS[value],
    })),
)
const borrowOptions = computed<Choice<PurchasePlan['borrow']>[]>(() =>
  (['max', 'min'] as const).map((value) => ({
    value,
    label: BORROW_LABELS.value[value],
    description: t(`planWizard.desc.borrow.${value}`),
    icon: BORROW_ICONS[value],
  })),
)
const repayOptions = computed<Choice<PurchasePlan['repay']>[]>(() =>
  (['monthly', 'lump', 'never'] as const).map((value) => ({
    value,
    label: REPAY_LABELS.value[value],
    description: t(`planWizard.desc.repay.${value}`),
    icon: REPAY_ICONS[value],
  })),
)
const situationOptions = computed<Choice<HousingSituation>[]>(() =>
  (['selling', 'free', 'renting'] as const)
    .filter((value) => value !== 'selling' || canSell.value)
    .map((value) => ({
      value,
      label: HOUSING_LABELS.value[value],
      description: t(`planWizard.desc.situation.${value}`),
      icon: HOUSING_ICONS[value],
    })),
)
const depositOptions = computed<Choice<string>[]>(() =>
  inputs.deposits.products.map((product) => ({
    value: product.id,
    label: product.name,
    description: productTerms(product),
    icon: DEPOSIT_ICON,
  })),
)

// A selling plan needs an owned flat, the others need none — flag the mismatch on
// the housing screen so the user learns why the plan will sit greyed on the board.
const situationMatches = computed(() => planMatchesStart(inputs, draft))

// saveMonths is number | null: empty field means "wait as long as Otbasy does".
function setSaveMonths(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number(raw)
  draft.saveMonths =
    raw.trim() === ''
      ? null
      : Number.isFinite(parsed)
        ? Math.max(0, Math.trunc(parsed))
        : draft.saveMonths
}

const summary = computed(() => describePlan(draft, inputs.loans.products, inputs.deposits.products))
</script>

<template>
  <div class="overlay">
    <section class="wizard card" role="dialog" aria-modal="true">
      <header class="head">
        <p class="progress">
          {{ mode === 'create' ? t('planWizard.createTitle') : t('planWizard.editTitle') }} ·
          {{ t('planWizard.progress', { current: index + 1, total: steps.length }) }}
        </p>
        <button
          type="button"
          class="icon-btn"
          :title="t('planWizard.cancel')"
          @click="emit('cancel')"
        >
          <AppIcon :path="mdiClose" :size="20" />
        </button>
      </header>

      <h2>{{ t(`planWizard.steps.${step}.title`) }}</h2>
      <p class="instruction">{{ t(`planWizard.steps.${step}.instruction`) }}</p>

      <div class="body">
        <label v-if="step === 'name'" class="name-field">
          <span>{{ t('planWizard.nameLabel') }}</span>
          <input v-model="draft.name" type="text" :placeholder="t('planWizard.namePlaceholder')" />
        </label>

        <ChoiceCards
          v-else-if="step === 'loan'"
          v-model="draft.loan"
          :options="loanOptions"
          :aria-label="t('planWizard.steps.loan.title')"
        />

        <template v-else-if="step === 'buyWhen'">
          <ChoiceCards
            v-model="draft.buyWhen"
            :options="buyWhenOptions"
            :aria-label="t('planWizard.steps.buyWhen.title')"
          />
          <label v-if="draft.buyWhen === 'after-months'" class="inline-field">
            <span>{{ t('plansTab.saveMonthsLabel') }}</span>
            <input
              type="number"
              min="0"
              step="1"
              :value="draft.saveMonths ?? ''"
              @input="setSaveMonths"
            />
            <span class="hint">{{ t('plansTab.saveMonthsHint') }}</span>
          </label>
        </template>

        <ChoiceCards
          v-else-if="step === 'borrow'"
          v-model="draft.borrow"
          :options="borrowOptions"
          :aria-label="t('planWizard.steps.borrow.title')"
        />

        <ChoiceCards
          v-else-if="step === 'repay'"
          v-model="draft.repay"
          :options="repayOptions"
          :aria-label="t('planWizard.steps.repay.title')"
        />

        <template v-else-if="step === 'situation'">
          <ChoiceCards
            v-model="draft.situation"
            :options="situationOptions"
            :aria-label="t('planWizard.steps.situation.title')"
          />
          <label v-if="draft.situation === 'selling'" class="inline-field">
            <span>{{ t('plansTab.saleMonthLabel') }}</span>
            <input v-model.number="draft.saleMonthOffset" type="number" min="0" step="1" />
            <span class="hint">{{ t('plansTab.saleMonthHint') }}</span>
          </label>
          <p v-if="!situationMatches" class="warn">
            {{
              draft.situation === 'selling'
                ? t('plansTab.showNeedsApartment')
                : t('plansTab.showNeedsNoApartment')
            }}
          </p>
        </template>

        <ChoiceCards
          v-else-if="step === 'deposit'"
          v-model="draft.savingsProductId"
          :options="depositOptions"
          :aria-label="t('planWizard.steps.deposit.title')"
        />
      </div>

      <p class="terms">{{ summary }}</p>

      <footer class="controls">
        <button type="button" class="secondary" :disabled="isFirst" @click="back">
          <AppIcon :path="mdiChevronLeft" :size="18" />
          {{ t('planWizard.back') }}
        </button>
        <button type="button" class="primary" @click="next">
          {{ isLast ? t('planWizard.finish') : t('planWizard.next') }}
          <AppIcon :path="isLast ? mdiCheck : mdiChevronRight" :size="18" />
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  /* Pushed down from the top and sat on a near-opaque backdrop so it lands over —
     and fully hides — the onboarding wizard card it opens on top of. */
  padding: 7vh 16px 40px;
  overflow-y: auto;
  background: rgb(0 0 0 / 0.72);
}
.wizard {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.progress {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.icon-btn {
  display: flex;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 6px;
}
.icon-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
h2 {
  font-size: var(--text-xl);
  margin: 0;
}
.instruction {
  color: var(--text-secondary);
  font-size: var(--text-md);
  margin: 0;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}
.name-field,
.inline-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}
.name-field input,
.inline-field input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-lg);
}
.inline-field input {
  font-family: var(--mono);
  max-width: 160px;
}
.name-field input:focus-visible,
.inline-field input:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -1px;
}
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.warn {
  color: var(--critical);
  font-size: var(--text-sm);
  margin: 0;
}
.terms {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
  padding-top: 2px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.controls {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.controls button {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border: 1px solid var(--border);
}
.controls button:disabled {
  opacity: 0.5;
  cursor: default;
}
.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.secondary:hover:not(:disabled) {
  color: var(--text-primary);
}
.primary {
  background: var(--series-1);
  color: #fff;
  border-color: var(--series-1);
}
</style>
