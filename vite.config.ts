import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { loadCountries } from './build/countries.mjs'

// The list of countries is exactly the set of folders in public/db/, validated
// and inlined here so the app knows which countries exist without a manifest
// file anyone has to remember to update. A bad country folder fails the build.
const countries = loadCountries()

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [vue()],
  define: {
    __DB_COUNTRIES__: JSON.stringify(countries),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
