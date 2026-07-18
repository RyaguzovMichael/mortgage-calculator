<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <RouterView />
    <SiteFooter />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}
/* RouterView renders CalculatorView's single root, .layout — :deep reaches
   through the scoping boundary so it can take the remaining height instead of
   the full viewport, which App.vue now owns. */
.app-shell > :deep(.layout) {
  flex: 1;
  min-height: 0;
}
@media (max-width: 900px) {
  .app-shell {
    height: auto;
  }
}
</style>
