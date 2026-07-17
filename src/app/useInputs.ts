import { computed, reactive, watch } from 'vue'
import { simulateAll, type SimulationReport } from '@/engine/simulate'
import type { DepositProduct, Inputs } from '@/engine/types/inputs'
import { isBuiltInProduct } from '@/infrastructure/depositCatalogue'
import { DEFAULT_INPUTS, loadInputs, saveInputs } from '@/infrastructure/inputsStorage'

// Single reactive tree of inputs plus the report derived from it. There is one
// page and one model, so this is a plain composable rather than a store.
const inputs = reactive<Inputs>(structuredClone(loadInputs() ?? DEFAULT_INPUTS))

const report = computed<SimulationReport>(() => simulateAll(toPlain(inputs)))

watch(inputs, (value) => saveInputs(toPlain(value)), { deep: true })

export function useInputs() {
  return { inputs, report, reset, addProduct, removeProduct, canRemoveProduct }
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

// The engine is pure TypeScript and must not be handed Vue proxies — it reads
// each value many times per run, and a proxy would tax every read.
function toPlain(value: Inputs): Inputs {
  return JSON.parse(JSON.stringify(value)) as Inputs
}
