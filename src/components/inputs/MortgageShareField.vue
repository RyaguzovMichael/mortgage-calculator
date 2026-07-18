<script setup lang="ts">
import { computed } from 'vue'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'

// Two views of the same underlying `mortgageShare` fraction: a percentage and the
// absolute tenge it works out to. Editing either recomputes the other, since both
// are just this one number times (or divided by) the salary.
const props = defineProps<{
  salary: number
  percentLabel: string
  amountLabel: string
  hint?: string
}>()
const share = defineModel<number>({ required: true })

const amount = computed({
  get: () => Math.round(share.value * props.salary),
  // With no salary there is no fraction to derive, so an amount cannot mean
  // anything yet — leave the share at zero rather than divide by zero.
  set: (value: number) => {
    share.value = props.salary > 0 ? value / props.salary : 0
  },
})
</script>

<template>
  <PercentField v-model="share" :label="percentLabel" :step="5" :hint="hint" />
  <NumberField v-model="amount" :label="amountLabel" suffix="₸" :step="50000" />
</template>
