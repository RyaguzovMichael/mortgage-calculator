<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { planMatchesStart } from '@/engine/types/inputs'
import type { HousingSituation } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import WizardShell from '@/components/WizardShell.vue'
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

// The Otbasy loan can only be issued once its own gates (50%-balance and CC)
// are met — there is no "buy sooner" option under it, so the buyWhen step is
// skipped entirely (see `steps` below) and the trigger is pinned here instead
// of asked. Leaving Otbasy the other way round would leave the trigger stuck
// on a screen the wizard no longer shows, so coerce it back to "as soon as
// possible" — the same guard the old dropdown editor carried.
watch(
  () => draft.loan,
  (loan) => {
    if (loan === 'otbasy') draft.buyWhen = 'otbasy-gates'
    else if (draft.buyWhen === 'otbasy-gates') draft.buyWhen = 'asap'
  },
  { immediate: true },
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

// --- Which screens this plan shows, in order. buyWhen vanishes for Otbasy (its
// trigger is pinned to the programme's own gates, not a choice); borrow/repay
// vanish for cash (no loan to size or repay); the deposit screen vanishes for
// Otbasy (it saves to its own account, not a deposit). The rest are always asked. ---
type StepId = 'name' | 'loan' | 'buyWhen' | 'borrow' | 'repay' | 'situation' | 'deposit'
const steps = computed<StepId[]>(() => {
  const list: StepId[] = ['name', 'loan']
  if (draft.loan !== 'otbasy') list.push('buyWhen')
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
const progress = computed(
  () =>
    `${props.mode === 'create' ? t('planWizard.createTitle') : t('planWizard.editTitle')} · ` +
    t('planWizard.progress', { current: index.value + 1, total: steps.value.length }),
)

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
// otbasy-gates is never offered here — it is pinned automatically when the
// loan is Otbasy (see the watch above), and this step doesn't show then.
const buyWhenOptions = computed<Choice<PurchasePlan['buyWhen']>[]>(() =>
  (['asap', 'after-months'] as const).map((value) => ({
    value,
    label: BUY_WHEN_LABELS.value[value],
    description: t(`planWizard.desc.buyWhen.${value === 'after-months' ? 'afterMonths' : 'asap'}`),
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
  <WizardShell
    modal
    :wide="step === 'loan' || step === 'deposit'"
    :progress="progress"
    :title="t(`planWizard.steps.${step}.title`)"
    :instruction="t(`planWizard.steps.${step}.instruction`)"
    :is-first="isFirst"
    :is-last="isLast"
    :back-label="t('planWizard.back')"
    :next-label="t('planWizard.next')"
    :finish-label="t('planWizard.finish')"
    :close-label="t('planWizard.cancel')"
    @back="back"
    @next="next"
    @close="emit('cancel')"
  >
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

    <template #after-body>
      <p class="terms">{{ summary }}</p>
    </template>
  </WizardShell>
</template>

<style scoped>
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
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-lg);
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}
.inline-field input {
  font-family: var(--mono);
  max-width: 160px;
}
.name-field input:focus-visible,
.inline-field input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
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
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
</style>
