<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { planMatchesStart } from '@/engine/types/inputs'
import type { HousingSituation } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import AppIcon from '@/components/AppIcon.vue'
import { mdiClose } from '@mdi/js'
import ChoiceCards, { type Choice } from './ChoiceCards.vue'
import {
  BORROW_ICONS,
  BUY_WHEN_ICONS,
  DEPOSIT_ICON,
  HOUSING_ICONS,
  REPAY_ICONS,
  TERM_ICONS,
  loanIcon,
} from './planIcons'

// The "Edit" alternative to PlanWizard — same four decisions, but laid out as one
// scrollable screen instead of a step sequence, for editing a plan you already
// built once and just want to nudge. Shares the wizard's draft/option/summary
// logic verbatim; only the navigation (steps, index, back/next) is dropped.
const props = defineProps<{ initial: PurchasePlan }>()
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
  TERM_LABELS,
  HOUSING_LABELS,
} = useFormat()

type PlanDraft = { -readonly [K in keyof PurchasePlan]: PurchasePlan[K] }
const draft = reactive<PlanDraft>(JSON.parse(JSON.stringify(props.initial)) as PlanDraft)

watch(
  () => draft.loan,
  (loan) => {
    if (loan === 'otbasy') draft.buyWhen = 'otbasy-gates'
    else if (draft.buyWhen === 'otbasy-gates') draft.buyWhen = 'asap'
  },
  { immediate: true },
)

const canSell = computed(() => inputs.existingApartment.owned)
watch(
  canSell,
  (owned) => {
    if (!owned && draft.situation === 'selling') draft.situation = 'renting'
  },
  { immediate: true },
)

// Which optional sections show — same gating as the wizard's step list, just
// consulted as booleans instead of building a navigable list out of them.
const showBuyWhen = computed(() => draft.loan !== 'otbasy')
const showLoanSizing = computed(() => draft.loan !== 'none')
// Term is a lever only for an ordinary credit — Otbasy keeps its own contract term.
const showTerm = computed(() => draft.loan !== 'none' && draft.loan !== 'otbasy')
const showDeposit = computed(() => draft.loan !== 'otbasy')

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
const termOptions = computed<Choice<PurchasePlan['term']>[]>(() =>
  (['max', 'shortest'] as const).map((value) => ({
    value,
    label: TERM_LABELS.value[value],
    description: t(`planWizard.desc.term.${value}`),
    icon: TERM_ICONS[value],
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

const situationMatches = computed(() => planMatchesStart(inputs, draft))

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

function save(): void {
  emit('save', JSON.parse(JSON.stringify(draft)) as PurchasePlan)
}
</script>

<template>
  <div class="overlay">
    <section class="dialog card" role="dialog" aria-modal="true">
      <header class="head">
        <h2>{{ t('planEditor.title') }}</h2>
        <button
          type="button"
          class="icon-btn"
          :title="t('planWizard.cancel')"
          @click="emit('cancel')"
        >
          <AppIcon :path="mdiClose" :size="20" />
        </button>
      </header>

      <div class="body">
        <section class="group">
          <label class="name-field">
            <span>{{ t('planWizard.nameLabel') }}</span>
            <input
              v-model="draft.name"
              type="text"
              :placeholder="t('planWizard.namePlaceholder')"
            />
          </label>
        </section>

        <section class="group">
          <h3>{{ t('planWizard.steps.loan.title') }}</h3>
          <ChoiceCards
            v-model="draft.loan"
            :options="loanOptions"
            :aria-label="t('planWizard.steps.loan.title')"
          />
        </section>

        <section v-if="showBuyWhen" class="group">
          <h3>{{ t('planWizard.steps.buyWhen.title') }}</h3>
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
        </section>

        <section v-if="showLoanSizing" class="group">
          <h3>{{ t('planWizard.steps.borrow.title') }}</h3>
          <ChoiceCards
            v-model="draft.borrow"
            :options="borrowOptions"
            :aria-label="t('planWizard.steps.borrow.title')"
          />
        </section>

        <section v-if="showLoanSizing" class="group">
          <h3>{{ t('planWizard.steps.repay.title') }}</h3>
          <ChoiceCards
            v-model="draft.repay"
            :options="repayOptions"
            :aria-label="t('planWizard.steps.repay.title')"
          />
        </section>

        <section v-if="showTerm" class="group">
          <h3>{{ t('planWizard.steps.term.title') }}</h3>
          <ChoiceCards
            v-model="draft.term"
            :options="termOptions"
            :aria-label="t('planWizard.steps.term.title')"
          />
        </section>

        <section class="group">
          <h3>{{ t('planWizard.steps.situation.title') }}</h3>
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
        </section>

        <section v-if="showDeposit" class="group">
          <h3>{{ t('planWizard.steps.deposit.title') }}</h3>
          <ChoiceCards
            v-model="draft.savingsProductId"
            :options="depositOptions"
            :aria-label="t('planWizard.steps.deposit.title')"
          />
        </section>
      </div>

      <p class="terms">{{ summary }}</p>

      <footer class="controls">
        <button type="button" class="secondary" @click="emit('cancel')">
          {{ t('planWizard.cancel') }}
        </button>
        <button type="button" class="primary" @click="save">
          {{ t('planEditor.save') }}
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
  padding: 7vh 16px 40px;
  overflow-y: auto;
  background: rgba(10, 12, 18, 0.72);
}
.dialog {
  width: 100%;
  max-width: 780px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--shadow-lg);
  max-height: 86vh;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}
.head h2 {
  font-size: var(--text-xl);
  margin: 0;
}
.icon-btn {
  display: flex;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition:
    color var(--transition),
    background var(--transition);
}
.icon-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding-right: 4px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.group h3 {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
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
  flex-shrink: 0;
}
.controls {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.controls button {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-sm);
  padding: 9px 20px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border: 1px solid var(--border);
  transition:
    color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}
.secondary {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.secondary:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.primary {
  background: var(--accent-gradient);
  color: var(--accent-contrast);
  border-color: transparent;
  font-weight: 600;
  box-shadow: 0 4px 14px var(--accent-glow);
}
.primary:hover {
  box-shadow: 0 6px 20px var(--accent-glow);
  transform: var(--lift);
}
</style>
