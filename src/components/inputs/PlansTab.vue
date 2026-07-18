<script setup lang="ts">
import { useInputs, MAX_SHOWN } from '@/app/useInputs'
import {
  BORROW_LABELS,
  BUY_WHEN_LABELS,
  describePlan,
  LOAN_LABELS,
  REPAY_LABELS,
} from '@/app/format'
import { BUILT_IN_PLANS } from '@/infrastructure/planCatalogue'
import type { PurchasePlan } from '@/engine/types/plan'

const { inputs, addPlan, removePlan, isShown, canShow, toggleShown } = useInputs()

const LOAN_OPTIONS = entries(LOAN_LABELS)
const BORROW_OPTIONS = entries(BORROW_LABELS)
const REPAY_OPTIONS = entries(REPAY_LABELS)

// otbasy-gates is offered only for an Otbasy loan — waiting for the Otbasy balance
// and CC gates makes no sense without the Otbasy account. That is the one
// impossible combination, and the dropdown simply never shows it.
function buyWhenOptions(plan: PurchasePlan) {
  return entries(BUY_WHEN_LABELS).filter(
    (option) => option.value !== 'otbasy-gates' || plan.loan === 'otbasy',
  )
}

// Changing the loan can invalidate the trigger: dropping the Otbasy loan while the
// plan still waits on Otbasy gates would leave an impossible plan. Coerce it back
// to "as soon as possible".
function setLoan(plan: PurchasePlan, loan: PurchasePlan['loan']): void {
  ;(plan as { loan: PurchasePlan['loan'] }).loan = loan
  if (loan !== 'otbasy' && plan.buyWhen === 'otbasy-gates') {
    ;(plan as { buyWhen: PurchasePlan['buyWhen'] }).buyWhen = 'asap'
  }
}

// saveMonths is number | null: a whole number of months, or null for "wait as
// long as Otbasy". Empty field means null; anything else is coerced to a
// non-negative integer. Kept off NumberField, which is strictly a number.
function setSaveMonths(plan: PurchasePlan, event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number(raw)
  ;(plan as { saveMonths: number | null }).saveMonths =
    raw.trim() === '' ? null : Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : plan.saveMonths
}

function entries<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))
}

function showTitle(id: string): string {
  if (isShown(id)) return 'Убрать с графика'
  return canShow(id) ? 'Показать на графике' : `На графике максимум ${MAX_SHOWN} — снимите другой план`
}
</script>

<template>
  <section>
    <h3>Встроенные планы</h3>
    <p class="note">
      Из файла <code>data/plans.yml</code>. Их нельзя изменить или удалить. Отметьте, какие показывать
      на графике и в сводке.
    </p>
    <div v-for="plan in BUILT_IN_PLANS" :key="plan.id" class="built-in">
      <label class="show">
        <input
          type="checkbox"
          :checked="isShown(plan.id)"
          :disabled="!canShow(plan.id)"
          :title="showTitle(plan.id)"
          @change="toggleShown(plan.id)"
        />
        <span class="plan-name">{{ plan.name }}</span>
      </label>
      <span class="plan-terms">{{ describePlan(plan) }}</span>
    </div>
  </section>

  <section>
    <header class="section-head">
      <h3>Свои планы</h3>
      <button type="button" @click="addPlan">+ Добавить</button>
    </header>
    <p v-if="inputs.plans.custom.length === 0" class="note">
      Пока ничего. Соберите свой план из четырёх решений — например, «Halyk, но с 50% взноса» — и
      сравните его с встроенными.
    </p>

    <div v-for="plan in inputs.plans.custom" :key="plan.id" class="own">
      <div class="own-head">
        <label class="show">
          <input
            type="checkbox"
            :checked="isShown(plan.id)"
            :disabled="!canShow(plan.id)"
            :title="showTitle(plan.id)"
            @change="toggleShown(plan.id)"
          />
        </label>
        <input v-model="plan.name" type="text" :aria-label="`Название плана ${plan.id}`" />
        <button type="button" title="Удалить план" @click="removePlan(plan.id)">Удалить</button>
      </div>

      <label class="field">
        <span>Кредит</span>
        <select :value="plan.loan" @change="setLoan(plan, ($event.target as HTMLSelectElement).value as PurchasePlan['loan'])">
          <option v-for="option in LOAN_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Когда покупать</span>
        <select v-model="plan.buyWhen">
          <option v-for="option in buyWhenOptions(plan)" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="plan.buyWhen === 'after-months'" class="field">
        <span>Копить месяцев</span>
        <input
          type="number"
          min="0"
          step="1"
          :value="plan.saveMonths ?? ''"
          @input="setSaveMonths(plan, $event)"
        />
        <span class="hint">Пусто = ждать ровно столько, сколько ждёт Otbasy.</span>
      </label>

      <template v-if="plan.loan !== 'none'">
        <label class="field">
          <span>Сколько занимать</span>
          <select v-model="plan.borrow">
            <option v-for="option in BORROW_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Как гасить</span>
          <select v-model="plan.repay">
            <option v-for="option in REPAY_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </template>

      <p class="plan-terms">{{ describePlan(plan) }}</p>
    </div>
  </section>
</template>

<style scoped>
h3 {
  font-size: var(--text-md);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 0 0 8px;
}
.note {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
code {
  font-family: var(--mono);
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.section-head h3 {
  margin: 0;
}
.section-head button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  white-space: nowrap;
}
.section-head button:hover {
  color: var(--text-primary);
}
.built-in,
.own {
  border-left: 2px solid var(--border);
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.own {
  gap: 8px;
  padding-bottom: 10px;
}
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
.plan-name {
  font-size: var(--text-lg);
}
.plan-terms {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.own-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.own-head input[type='text'] {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-lg);
}
.own-head input[type='text']:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -1px;
}
.own-head button {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  white-space: nowrap;
}
.own-head button:hover {
  color: var(--text-primary);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}
.field select,
.field input[type='number'] {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-lg);
}
.field input[type='number'] {
  font-family: var(--mono);
}
.field select:focus-visible,
.field input[type='number']:focus-visible {
  outline: 2px solid var(--series-1);
  outline-offset: -1px;
}
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
