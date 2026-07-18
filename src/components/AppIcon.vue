<script setup lang="ts">
// A single Material Design Icon, drawn from its raw path data (the `mdi*` string
// exports of @mdi/js). Kept path-in, name-free: the caller imports the exact icon
// it wants, so the bundle carries only the handful of glyphs we actually use — no
// font, no runtime lookup table, no network.
defineProps<{ path: string; size?: number }>()
</script>

<template>
  <svg
    class="icon"
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.icon {
  display: block;
  flex-shrink: 0;
}
</style>
