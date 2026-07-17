<script setup lang="ts">
import { computed } from 'vue'
import { SAVINGS_PRODUCTS } from '@/engine/savingsProducts'

const props = defineProps<{ label: string; hint?: string }>()
const rate = defineModel<number>('rate', { required: true })
const payoutPeriod = defineModel<number>('payoutPeriod', { required: true })

// "Custom" is a real state, not a fallback: the rate and payout period stay
// free-form numbers, and a preset is only a shortcut that sets both at once.
const selected = computed(() => {
  const match = SAVINGS_PRODUCTS.find(
    (product) =>
      product.annualRate === rate.value && product.payoutPeriodMonths === payoutPeriod.value,
  )
  return match?.id ?? 'custom'
})

function pick(id: string): void {
  const product = SAVINGS_PRODUCTS.find((candidate) => candidate.id === id)
  if (!product) return
  rate.value = product.annualRate
  payoutPeriod.value = product.payoutPeriodMonths
}
</script>

<template>
  <fieldset class="picker">
    <legend>{{ props.label }}</legend>
    <label v-for="product in SAVINGS_PRODUCTS" :key="product.id" class="option">
      <input
        type="radio"
        :checked="selected === product.id"
        :name="props.label"
        @change="pick(product.id)"
      />
      <span>{{ product.label }}</span>
    </label>
    <label class="option">
      <input type="radio" :checked="selected === 'custom'" :name="props.label" disabled />
      <span class="custom">Своя ставка — задайте поля ниже</span>
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
.custom {
  color: var(--text-muted);
}
.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 4px 0 0;
}
</style>
