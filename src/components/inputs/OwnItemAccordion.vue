<script setup lang="ts">
defineProps<{ name: string; terms: string }>()
</script>

<template>
  <details class="own">
    <summary class="own-summary">
      <span class="item-name">{{ name }}</span>
      <span class="item-terms">{{ terms }}</span>
    </summary>
    <div class="own-body">
      <slot />
    </div>
  </details>
</template>
