<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/app/useTheme'
import { useLocale } from '@/app/useLocale'
import type { ThemeOverride } from '@/infrastructure/themePersistence'
import type { Locale } from '@/infrastructure/localePersistence'

const { t } = useI18n()
const { override, setOverride } = useTheme()
const { locale, setLocale } = useLocale()

const THEME_OPTIONS: readonly ThemeOverride[] = [null, 'light', 'dark']
const LOCALE_OPTIONS: readonly Locale[] = ['ru', 'en']

function themeLabel(value: ThemeOverride): string {
  if (value === 'light') return t('nav.theme.light')
  if (value === 'dark') return t('nav.theme.dark')
  return t('nav.theme.system')
}
</script>

<template>
  <header class="navbar">
    <div class="left">
      <span class="brand">{{ t('nav.brand') }}</span>
      <nav class="nav-links">
        <RouterLink to="/" class="nav-link" active-class="on" exact-active-class="on">{{
          t('nav.home')
        }}</RouterLink>
        <RouterLink to="/conditions" class="nav-link" active-class="on" exact-active-class="on">{{
          t('nav.conditions')
        }}</RouterLink>
        <RouterLink to="/database" class="nav-link" active-class="on" exact-active-class="on">{{
          t('nav.database')
        }}</RouterLink>
      </nav>
    </div>
    <div class="right">
      <div class="segmented" role="radiogroup" :aria-label="t('nav.theme.system')">
        <button
          v-for="value in THEME_OPTIONS"
          :key="value ?? 'system'"
          type="button"
          role="radio"
          :aria-checked="override === value"
          :class="{ on: override === value }"
          @click="setOverride(value)"
        >
          {{ themeLabel(value) }}
        </button>
      </div>
      <div class="segmented" role="radiogroup" aria-label="RU/EN">
        <button
          v-for="value in LOCALE_OPTIONS"
          :key="value"
          type="button"
          role="radio"
          :aria-checked="locale === value"
          :class="{ on: locale === value }"
          @click="setLocale(value)"
        >
          {{ t(`nav.locale.${value}`) }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--surface-1);
  border-bottom: 1px solid var(--border);
}
.left {
  display: flex;
  align-items: center;
  gap: 18px;
}
.brand {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}
.nav-links {
  display: flex;
  gap: 4px;
}
.nav-link {
  border: none;
  background: none;
  color: var(--text-muted);
  padding: 6px 6px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.nav-link:hover {
  color: var(--text-secondary);
}
.nav-link.on {
  color: var(--text-primary);
  border-bottom-color: var(--series-1);
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.segmented {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.segmented button {
  border: none;
  background: var(--surface-2);
  color: var(--text-secondary);
  padding: 4px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
.segmented button + button {
  border-left: 1px solid var(--border);
}
.segmented button:hover {
  color: var(--text-primary);
}
.segmented button.on {
  background: var(--surface-1);
  color: var(--text-primary);
  font-weight: 600;
}
</style>
