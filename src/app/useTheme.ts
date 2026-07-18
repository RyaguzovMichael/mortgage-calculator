import { ref } from 'vue'
import {
  loadThemeOverride,
  saveThemeOverride,
  type ThemeOverride,
} from '@/infrastructure/themePersistence'

const override = ref<ThemeOverride>(loadThemeOverride())

function applyTheme(): void {
  if (override.value) document.documentElement.dataset.theme = override.value
  else delete document.documentElement.dataset.theme
}

// Runs at module load, before Vue mounts anything — so the right theme is on
// screen for the very first paint, not applied a tick later as a visible flash.
applyTheme()

export function useTheme() {
  function setOverride(value: ThemeOverride): void {
    override.value = value
    saveThemeOverride(value)
    applyTheme()
  }

  return { override, setOverride }
}
