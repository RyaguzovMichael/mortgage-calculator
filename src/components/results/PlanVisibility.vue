<script setup lang="ts">
import { computed } from 'vue'
import { useInputs, MAX_SHOWN } from '@/app/useInputs'
import { colorForIndex } from '@/app/format'
import type { VariantId } from '@/engine/types/plan'

const { report, allPlans, isShown, canShow, toggleShown } = useInputs()

// The board colours the shown plans by their order; mirror that here so a chip's
// swatch is the exact colour its line wears. Hidden plans have no board colour.
const colorOf = computed<Record<VariantId, string>>(() => {
  const map: Record<VariantId, string> = {}
  report.value.variants.forEach((variant, index) => {
    map[variant.id] = colorForIndex(index)
  })
  return map
})

function title(id: string): string {
  if (isShown(id)) return 'Убрать с графика'
  return canShow(id) ? 'Показать на графике' : `На графике максимум ${MAX_SHOWN} — снимите другой план`
}
</script>

<template>
  <div class="visibility" role="group" aria-label="Какие планы показывать">
    <button
      v-for="plan in allPlans"
      :key="plan.id"
      type="button"
      class="chip"
      :class="{ on: isShown(plan.id) }"
      :aria-pressed="isShown(plan.id)"
      :disabled="!canShow(plan.id)"
      :title="title(plan.id)"
      @click="toggleShown(plan.id)"
    >
      <span
        class="swatch"
        :style="{ background: isShown(plan.id) ? colorOf[plan.id] : 'var(--text-muted)' }"
      />
      {{ plan.name }}
    </button>
  </div>
</template>

<style scoped>
.visibility {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-muted);
  border-radius: 999px;
  padding: 3px 10px 3px 8px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
.chip.on {
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.chip:hover:not(:disabled) {
  color: var(--text-primary);
}
.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex: none;
}
</style>
