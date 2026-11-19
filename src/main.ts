import { createApp } from 'vue'
import App from './App.vue'
import CountryGate from '@/components/CountryGate.vue'
import { router } from './router'
import { i18n } from './i18n'
import { findCountry, type CountryMeta } from './infrastructure/country'
import { loadCountry } from './infrastructure/countryPersistence'
import { fetchCountryDb } from './infrastructure/countryDb'
import { setCurrentCountry } from './infrastructure/currentCountry'
import { initInputs } from './app/useInputs'
import './assets/theme.css'
import './assets/forms.css'

function mountApp(): void {
  createApp(App).use(router).use(i18n).mount('#app')
}

function mountGate(error?: string): void {
  const gate = createApp(CountryGate, {
    error: error ?? null,
    onRetry: () => window.location.reload(),
  })
  gate.use(i18n).mount('#app')
}

async function bootstrap(): Promise<void> {
  const stored = loadCountry()
  const meta: CountryMeta | undefined = stored ? findCountry(stored) : undefined
  if (!meta) {
    // No (or a stale) country selection — ask before doing anything else.
    mountGate()
    return
  }
  try {
    const db = await fetchCountryDb(meta.code)
    setCurrentCountry(meta, db)
    initInputs()
    mountApp()
  } catch (error) {
    console.error('Failed to load the country database:', error)
    mountGate(error instanceof Error ? error.message : String(error))
  }
}

void bootstrap()
