export const LOCALE_STORAGE_KEY = 'mortgage:locale:v1'

export type Locale = 'ru' | 'en'

export function loadLocale(): Locale {
  const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
  return raw === 'ru' ? 'ru' : 'en'
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}
