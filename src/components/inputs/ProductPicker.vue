<script setup lang="ts">
import { useFormat } from '@/app/useFormat'
import type { DepositProduct } from '@/engine/types/inputs'

const { describeProduct } = useFormat()

// Selection is an id, not a (rate, payout) pair matched by float equality. Two
// deposits with the same numbers used to be the same deposit; now they are two.
// There is no "custom" option either — a custom rate is a deposit you create.
const props = defineProps<{ label: string; products: readonly DepositProduct[]; hint?: string }>()

const selectedId = defineModel<string>({ required: true })
</script>

<template>
  <fieldset class="picker">
    <legend>{{ props.label }}</legend>
    <label v-for="product in props.products" :key="product.id" class="option">
      <input
        type="radio"
        :checked="selectedId === product.id"
        :name="props.label"
        @change="selectedId = product.id"
      />
      <span>{{ describeProduct(product) }}</span>
    </label>
    <p v-if="props.hint" class="hint">{{ props.hint }}</p>
  </fieldset>
</template>

<style scoped>
.picker {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
legend {
  color: var(--text-secondary);
  font-size: var(--text-md);
  padding: 0 4px;
}
.option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--text-md);
  cursor: pointer;
}
.option input {
  margin-top: 3px;
  accent-color: var(--series-1);
}
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 4px 0 0;
}
</style>
