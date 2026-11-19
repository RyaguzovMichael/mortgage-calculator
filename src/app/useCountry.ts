import { computed } from 'vue'
import { COUNTRIES, type CountryMeta } from '@/infrastructure/country'
import { currentCountry } from '@/infrastructure/currentCountry'
import { loadCountry, saveCountry } from '@/infrastructure/countryPersistence'

// The active country plus the full list, for the navbar switcher. Reading the
// meta inside computed()s keeps this honest if the app is ever re-initialised
// in place (today a country change reloads the page, so it never is).
export function useCountry() {
  const current = computed<CountryMeta>(() => currentCountry().meta)

  function switchCountry(code: string): void {
    if (code === current.value.code) return
    saveCountry(code)
    // A clean reload is the only honest way to swap the whole database: inputs,
    // catalogues, onboarding flag and board all belong to the old country.
    window.location.reload()
  }

  return {
    country: current,
    countries: COUNTRIES,
    otbasyEnabled: computed(() => current.value.otbasy),
    currencySymbol: computed(() => current.value.currencySymbol),
    currentCode: () => loadCountry(),
    switchCountry,
  }
}
