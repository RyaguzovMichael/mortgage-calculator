import { computed, reactive, watch } from 'vue'
import { simulateAll, type SimulationReport } from '@/engine/simulate'
import type { DepositProduct, Inputs } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'
import { isBuiltInProduct } from '@/infrastructure/depositCatalogue'
import { BUILT_IN_PLANS, isBuiltInPlan } from '@/infrastructure/planCatalogue'
import { DEFAULT_INPUTS, loadInputs, saveInputs } from '@/infrastructure/inputsStorage'

// One line per palette slot: the board colours plans by index, and there are eight
// validated slots, so the ninth shown plan has no colour to wear.
export const MAX_SHOWN = 8

// Single reactive tree of inputs plus the report derived from it. There is one
// page and one model, so this is a plain composable rather than a store.
const inputs = reactive<Inputs>(structuredClone(loadInputs() ?? DEFAULT_INPUTS))

const report = computed<SimulationReport>(() => simulateAll(toPlain(inputs), BUILT_IN_PLANS))

// Built-in definitions come from the file; the user's own are appended. This is the
// list the plans tab shows, each row read-only or editable by whether it is built in.
const allPlans = computed<readonly PurchasePlan[]>(() => [...BUILT_IN_PLANS, ...inputs.plans.custom])

watch(inputs, (value) => saveInputs(toPlain(value)), { deep: true })

export function useInputs() {
  return {
    inputs,
    report,
    reset,
    addProduct,
    removeProduct,
    canRemoveProduct,
    allPlans,
    addPlan,
    removePlan,
    canRemovePlan,
    isPlanBuiltIn: isBuiltInPlan,
    isShown,
    canShow,
    toggleShown,
  }
}

function reset(): void {
  Object.assign(inputs, structuredClone(DEFAULT_INPUTS))
}

// Ids are never reused: a deposit is deleted, and a later one must not inherit its
// id and quietly become whatever referenced the old one.
let nextOwnId = 0

function addProduct(): DepositProduct {
  nextOwnId = Math.max(nextOwnId, highestOwnId(inputs.deposits.products)) + 1
  const product = {
    id: `custom-${nextOwnId}`,
    name: 'Новый вклад',
    annualRate: 0.15,
    payoutPeriodMonths: 1,
  }
  inputs.deposits.products.push(product)
  return product
}

function removeProduct(id: string): void {
  if (!canRemoveProduct(id)) return
  const at = inputs.deposits.products.findIndex((product) => product.id === id)
  if (at >= 0) inputs.deposits.products.splice(at, 1)
}

// The built-ins are the file's, and deleting the deposit the money is going into
// would leave the picker pointing at a ghost — which is the "custom" pseudo-state
// this design just removed.
function canRemoveProduct(id: string): boolean {
  return !isBuiltInProduct(id) && id !== inputs.deposits.savingsProductId
}

function highestOwnId(products: readonly DepositProduct[]): number {
  return products.reduce((highest, product) => {
    const match = /^custom-(\d+)$/.exec(product.id)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
}

// Plans get their own id counter for the same reason deposits do.
let nextPlanId = 0

// A new plan mirrors "Halyk сразу" — a sensible, complete starting point the user
// then edits. It is not shown by default: adding a plan must not shove someone
// else off the eight-slot board on its own.
function addPlan(): PurchasePlan {
  nextPlanId = Math.max(nextPlanId, highestPlanId(inputs.plans.custom)) + 1
  const plan: PurchasePlan = {
    id: `plan-${nextPlanId}`,
    name: 'Новый план',
    loan: 'halyk',
    buyWhen: 'asap',
    saveMonths: null,
    borrow: 'max',
    repay: 'monthly',
  }
  inputs.plans.custom.push(plan)
  return plan
}

function removePlan(id: string): void {
  if (!canRemovePlan(id)) return
  const at = inputs.plans.custom.findIndex((plan) => plan.id === id)
  if (at >= 0) inputs.plans.custom.splice(at, 1)
  // Drop it from the board too, or a ghost id lingers in the shown list.
  const shownAt = inputs.plans.shown.indexOf(id)
  if (shownAt >= 0) inputs.plans.shown.splice(shownAt, 1)
}

// Only the user's own plans can be deleted; the built-ins belong to the file.
function canRemovePlan(id: string): boolean {
  return !isBuiltInPlan(id)
}

function highestPlanId(plans: readonly PurchasePlan[]): number {
  return plans.reduce((highest, plan) => {
    const match = /^plan-(\d+)$/.exec(plan.id)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
}

function isShown(id: string): boolean {
  return inputs.plans.shown.includes(id)
}

// Whether the show checkbox is available: always if it is already on (so it can be
// turned off), otherwise only while there is a free slot. This is what disables the
// ninth checkbox.
function canShow(id: string): boolean {
  return isShown(id) || inputs.plans.shown.length < MAX_SHOWN
}

function toggleShown(id: string): void {
  const at = inputs.plans.shown.indexOf(id)
  if (at >= 0) inputs.plans.shown.splice(at, 1)
  else if (canShow(id)) inputs.plans.shown.push(id)
}

// The engine is pure TypeScript and must not be handed Vue proxies — it reads
// each value many times per run, and a proxy would tax every read.
function toPlain(value: Inputs): Inputs {
  return JSON.parse(JSON.stringify(value)) as Inputs
}
