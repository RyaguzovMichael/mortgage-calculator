import { computed, reactive, watch } from 'vue'
import { simulateAll, type SimulationReport } from '@/engine/simulate'
import { planMatchesStart } from '@/engine/types/inputs'
import type { DepositProduct, Inputs, LoanProduct } from '@/engine/types/inputs'
import type { BestCategoryId, GeneratedPlan, PurchasePlan } from '@/engine/types/plan'
import { buildBestPlans as runBestPlans, evaluatePlan, type PlanMetrics } from '@/engine/bestPlans'
import { isBuiltInProduct } from '@/infrastructure/depositCatalogue'
import { isBuiltInLoanProduct } from '@/infrastructure/loanCatalogue'
import {
  BLANK_START_INPUTS,
  DEFAULT_PLAN_SALE_MONTH,
  DEFAULT_SAVINGS_PRODUCT_ID,
  loadInputs,
  saveInputs,
} from '@/infrastructure/inputsStorage'
import { clearOnboarded } from '@/infrastructure/onboardingPersistence'
import { clearWizardStep } from '@/infrastructure/wizardProgressPersistence'

// One line per palette slot: the board colours plans by index, and there are eight
// validated slots, so the ninth shown plan has no colour to wear.
export const MAX_SHOWN = 8

// Single reactive tree of inputs plus the report derived from it. There is one
// page and one model, so this is a plain composable rather than a store.
const inputs = reactive<Inputs>(structuredClone(loadInputs() ?? BLANK_START_INPUTS))

const report = computed<SimulationReport>(() => simulateAll(toPlain(inputs)))

// Every plan on the board — the generator's winners plus the user's hand-built
// ones. Used to look a plan up by id (for the board, the recap, and details).
const allPlans = computed<readonly PurchasePlan[]>(() => [
  ...inputs.plans.generated,
  ...inputs.plans.custom,
])

watch(inputs, (value) => saveInputs(toPlain(value)), { deep: true })

export function useInputs() {
  return {
    inputs,
    report,
    startOver,
    addProduct,
    removeProduct,
    canRemoveProduct,
    addLoanProduct,
    removeLoanProduct,
    canRemoveLoanProduct,
    allPlans,
    newPlanDraft,
    upsertPlan,
    duplicatePlan,
    removePlan,
    canRemovePlan,
    isGeneratedPlan,
    buildBestPlans,
    bestProgress,
    generatedDetails,
    planOutcome,
    isShown,
    canShow,
    isCompatible,
    toggleShown,
  }
}

// Blank the personal start conditions back to the wizard's starting point and
// forget that onboarding was done, so the caller can send the user back through
// /start. Programme parameters (catalogues, Otbasy rates) are kept.
function startOver(): void {
  Object.assign(inputs, structuredClone(BLANK_START_INPUTS))
  clearOnboarded()
  clearWizardStep()
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

// The built-ins are the file's, and deleting a deposit a plan still stores money
// in would leave that plan's picker pointing at a ghost — which is the "custom"
// pseudo-state this design just removed.
function canRemoveProduct(id: string): boolean {
  return !isBuiltInProduct(id) && !allPlans.value.some((plan) => plan.savingsProductId === id)
}

function highestOwnId(products: readonly DepositProduct[]): number {
  return highestIdWithPrefix(products, 'custom')
}

// Credits get their own prefix and counter, distinct from deposits' custom-N and
// plans' plan-N, for the same "never reuse an id" reason as both.
let nextLoanId = 0

function addLoanProduct(): LoanProduct {
  nextLoanId = Math.max(nextLoanId, highestIdWithPrefix(inputs.loans.products, 'credit')) + 1
  const product: LoanProduct = {
    id: `credit-${nextLoanId}`,
    name: 'Новый кредит',
    annualRate: 0.2,
    downPaymentFraction: 0.2,
    maxTermMonths: 240,
  }
  inputs.loans.products.push(product)
  return product
}

function removeLoanProduct(id: string): void {
  if (!canRemoveLoanProduct(id)) return
  const at = inputs.loans.products.findIndex((product) => product.id === id)
  if (at >= 0) inputs.loans.products.splice(at, 1)
}

// The built-in (Halyk) belongs to the file, and deleting a credit a plan still
// points at would leave that plan's loan selector pointing at a ghost.
function canRemoveLoanProduct(id: string): boolean {
  return !isBuiltInLoanProduct(id) && !allPlans.value.some((plan) => plan.loan === id)
}

function highestIdWithPrefix(items: readonly { id: string }[], prefix: string): number {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  return items.reduce((highest, item) => {
    const match = pattern.exec(item.id)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
}

// Plans get their own id counter for the same reason deposits do.
let nextPlanId = 0

// A blank plan mirrors "Halyk" — a sensible, complete starting point the wizard
// then walks the user through. It is *not* pushed here: the wizard edits this
// draft in isolation and only commits it with upsertPlan on Finish, so a cancelled
// creation leaves nothing behind (a skipped id is harmless — ids are never reused).
function newPlanDraft(): PurchasePlan {
  nextPlanId = Math.max(nextPlanId, highestPlanId(inputs.plans.custom)) + 1
  return {
    id: `plan-${nextPlanId}`,
    name: 'Новый план',
    loan: 'halyk',
    buyWhen: 'asap',
    saveMonths: null,
    borrow: 'max',
    repay: 'monthly',
    term: 'max',
    situation: 'selling',
    saleMonthOffset: DEFAULT_PLAN_SALE_MONTH,
    savingsProductId: DEFAULT_SAVINGS_PRODUCT_ID,
  }
}

// Commit a plan the wizard built or edited: replace the entry with the same id if
// it is already there, otherwise append. A brand-new plan is not put on the board —
// adding a plan must not shove someone else off the eight-slot board on its own.
function upsertPlan(plan: PurchasePlan): void {
  const at = inputs.plans.custom.findIndex((candidate) => candidate.id === plan.id)
  if (at >= 0) inputs.plans.custom.splice(at, 1, plan)
  else inputs.plans.custom.push(plan)
}

// Clones any plan — generated or custom — into a new custom plan, so tweaking a
// winning strategy (or "Halyk, but with a bigger down payment") starts from its
// terms instead of the blank draft newPlanDraft() hands the wizard. This is the only
// way to edit a generated plan: copy it, then the copy is an ordinary custom plan.
// Not auto-shown, same as a brand-new plan: copying one must not shove something
// else off the board.
function duplicatePlan(id: string, name: string): PurchasePlan {
  const source = allPlans.value.find((candidate) => candidate.id === id)
  if (!source) throw new Error(`Unknown plan: ${id}`)
  nextPlanId = Math.max(nextPlanId, highestPlanId(inputs.plans.custom)) + 1
  // structuredClone can't clone a Vue reactive Proxy — inputs plans are reactive —
  // so JSON round-trip instead, same as toPlain() below. `categories` is dropped: a
  // copy is a plain custom plan, not a generated one.
  const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
  delete clone.categories
  const copy: PurchasePlan = {
    ...(clone as unknown as PurchasePlan),
    id: `plan-${nextPlanId}`,
    name,
  }
  inputs.plans.custom.push(copy)
  return copy
}

function removePlan(id: string): void {
  if (!canRemovePlan(id)) return
  const at = inputs.plans.custom.findIndex((plan) => plan.id === id)
  if (at >= 0) inputs.plans.custom.splice(at, 1)
  // Drop it from the board too, or a ghost id lingers in the shown list.
  const shownAt = inputs.plans.shown.indexOf(id)
  if (shownAt >= 0) inputs.plans.shown.splice(shownAt, 1)
}

// Only hand-built plans can be deleted. A generated plan cannot — it is replaced by
// a re-run, or copied to a custom plan the user then owns.
function canRemovePlan(id: string): boolean {
  return !isGeneratedPlan(id)
}

// "Generated" is membership in the generated array, not a name convention — the same
// reasoning the deposit/loan catalogues use for "built-in".
function isGeneratedPlan(id: string): boolean {
  return inputs.plans.generated.some((plan) => plan.id === id)
}

// Just the decisions, so two winners that are the same strategy collapse to one
// board line instead of drawing the same curve twice.
function planFingerprint(plan: PurchasePlan): string {
  return JSON.stringify([
    plan.loan,
    plan.buyWhen,
    plan.saveMonths,
    plan.borrow,
    plan.repay,
    plan.term,
    plan.situation,
    plan.saleMonthOffset,
    plan.savingsProductId,
  ])
}

// Progress the "build best plans" run publishes so the UI can draw a bar and a live
// "done / total variants" count.
const bestProgress = reactive({ running: false, done: 0, total: 0 })

// The generated plans with their freshly-computed headline metrics, for the board's
// generated section. Recomputed against the live inputs, so the numbers stay honest
// when a condition changes after the last run (only a handful of plans, so cheap).
export interface GeneratedDetail {
  readonly plan: GeneratedPlan
  readonly metrics: PlanMetrics
}
const generatedDetails = computed<readonly GeneratedDetail[]>(() => {
  const plain = toPlain(inputs)
  return inputs.plans.generated.map((plan) => ({ plan, metrics: evaluatePlan(plain, plan) }))
})

// The headline outcomes of any single plan under the live conditions, for the
// read-only details dialog. One fresh run — cheap, and always in step with the
// current inputs.
function planOutcome(plan: PurchasePlan): PlanMetrics {
  return evaluatePlan(toPlain(inputs), plan)
}

// Enumerate every plan the conditions allow, simulate them all (batched, so the
// progress bar can paint), and put the category winners on the board as generated
// plans. Replaces the previous generated set; leaves hand-built plans alone.
// `labelFor` turns a category into the localized name a winning plan wears —
// supplied by the caller so this composable stays out of i18n.
async function buildBestPlans(labelFor: (category: BestCategoryId) => string): Promise<void> {
  if (bestProgress.running) return
  bestProgress.running = true
  bestProgress.done = 0
  bestProgress.total = 0
  try {
    const result = await runBestPlans(toPlain(inputs), (done, total) => {
      bestProgress.done = done
      bestProgress.total = total
    })

    // Drop the previous generated set from the board.
    const previous = new Set(inputs.plans.generated.map((plan) => plan.id))
    inputs.plans.shown = inputs.plans.shown.filter((id) => !previous.has(id))

    // Collapse winners that are the same strategy into one plan wearing every
    // category it won.
    const groups = new Map<string, { categories: BestCategoryId[]; plan: PurchasePlan }>()
    for (const winner of result.winners) {
      const key = planFingerprint(winner.plan)
      const group = groups.get(key)
      if (group) group.categories.push(winner.category)
      else groups.set(key, { categories: [winner.category], plan: winner.plan })
    }

    const generated: GeneratedPlan[] = []
    let index = 0
    for (const group of groups.values()) {
      const id = `best-${index}`
      index += 1
      generated.push({
        ...group.plan,
        id,
        name: group.categories.map(labelFor).join(' · '),
        categories: group.categories,
      })
      if (inputs.plans.shown.length < MAX_SHOWN) inputs.plans.shown.push(id)
    }
    inputs.plans.generated = generated
  } finally {
    bestProgress.running = false
  }
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

// Whether a plan's situation matches the existing-apartment start condition — a
// 'selling' plan needs an owned flat, the others need none. An incompatible plan
// is not comparable, so the board offers it disabled.
function isCompatible(id: string): boolean {
  const plan = allPlans.value.find((candidate) => candidate.id === id)
  return plan ? planMatchesStart(inputs, plan) : true
}

// Whether the show checkbox is available: always if it is already on (so an
// incompatible plan left on the board can still be turned off), otherwise only
// while it matches the start condition and there is a free slot. This is what
// disables the ninth checkbox and every incompatible one.
function canShow(id: string): boolean {
  if (isShown(id)) return true
  return isCompatible(id) && inputs.plans.shown.length < MAX_SHOWN
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
