export const THEME_STORAGE_KEY = 'mortgage:theme:v1'

export type ThemeOverride = 'light' | 'dark' | null

// null means "no override" — follow the OS preference. Stored as the absence of
// the key, not a literal 'system' string, so the stored shape is always a valid
// data-theme attribute value.
export function loadThemeOverride(): ThemeOverride {
  const raw = localStorage.getItem(THEME_STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : null
}

export function saveThemeOverride(value: ThemeOverride): void {
  if (value === null) localStorage.removeItem(THEME_STORAGE_KEY)
  else localStorage.setItem(THEME_STORAGE_KEY, value)
}
