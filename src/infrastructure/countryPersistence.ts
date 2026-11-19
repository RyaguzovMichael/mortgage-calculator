// Which country the user picked and where that choice is remembered. The picked
// code is the only thing persisted here — everything else about a country comes
// from the build-time list (country.ts) and its public/db/<code>/ files.

const COUNTRY_STORAGE_KEY = 'mortgage:country:v1'

export function loadCountry(): string | null {
  try {
    return localStorage.getItem(COUNTRY_STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveCountry(code: string): void {
  localStorage.setItem(COUNTRY_STORAGE_KEY, code)
}
