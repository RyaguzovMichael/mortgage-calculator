import { computed, reactive, watch } from 'vue'
import { simulateAll, type SimulationReport } from '@/engine/simulate'
import type { Inputs } from '@/engine/types/inputs'
import { DEFAULT_INPUTS, loadInputs, saveInputs } from '@/infrastructure/inputsStorage'

// Single reactive tree of inputs plus the report derived from it. There is one
// page and one model, so this is a plain composable rather than a store.
const inputs = reactive<Inputs>(structuredClone(loadInputs() ?? DEFAULT_INPUTS))

const report = computed<SimulationReport>(() => simulateAll(toPlain(inputs)))

watch(inputs, (value) => saveInputs(toPlain(value)), { deep: true })

export function useInputs() {
  return { inputs, report, reset }
}

function reset(): void {
  Object.assign(inputs, structuredClone(DEFAULT_INPUTS))
}

// The engine is pure TypeScript and must not be handed Vue proxies — it reads
// each value many times per run, and a proxy would tax every read.
function toPlain(value: Inputs): Inputs {
  return JSON.parse(JSON.stringify(value)) as Inputs
}
