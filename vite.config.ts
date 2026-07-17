import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import yaml from '@modyfi/vite-plugin-yaml'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  // yaml() turns data/*.yml into a module at build time. vitest.config.ts merges
  // this config, so the same import works in tests.
  plugins: [vue(), yaml()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
