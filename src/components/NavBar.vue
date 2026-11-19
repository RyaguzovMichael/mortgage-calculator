<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { mdiClipboardListOutline, mdiCogOutline, mdiDatabaseOutline, mdiHome } from '@mdi/js'
import { useTheme } from '@/app/useTheme'
import { useLocale } from '@/app/useLocale'
import AppIcon from '@/components/AppIcon.vue'
import type { ThemeOverride } from '@/infrastructure/themePersistence'
import type { Locale } from '@/infrastructure/localePersistence'
import { useCountry } from '@/app/useCountry'

const { t } = useI18n()
const { override, setOverride } = useTheme()
const { locale, setLocale } = useLocale()
const { country, countries, switchCountry } = useCountry()

const THEME_OPTIONS: readonly ThemeOverride[] = [null, 'light', 'dark']
const LOCALE_OPTIONS: readonly Locale[] = ['ru', 'en']

function themeLabel(value: ThemeOverride): string {
  if (value === 'light') return t('nav.theme.light')
  if (value === 'dark') return t('nav.theme.dark')
  return t('nav.theme.system')
}

function onThemeChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  setOverride(value === '' ? null : (value as Exclude<ThemeOverride, null>))
}

function onLocaleChange(event: Event): void {
  setLocale((event.target as HTMLSelectElement).value as Locale)
}
</script>

<template>
  <header class="navbar">
    <div class="left">
      <span class="brand">{{ t('nav.brand') }}</span>
      <nav class="nav-links">
        <RouterLink to="/" class="nav-link" active-class="on" exact-active-class="on">
          <AppIcon :path="mdiHome" :size="16" />
          {{ t('nav.home') }}
        </RouterLink>
        <RouterLink to="/conditions" class="nav-link" active-class="on" exact-active-class="on">
          <AppIcon :path="mdiCogOutline" :size="16" />
          {{ t('nav.conditions') }}
        </RouterLink>
        <RouterLink to="/plans" class="nav-link" active-class="on" exact-active-class="on">
          <AppIcon :path="mdiClipboardListOutline" :size="16" />
          {{ t('nav.plans') }}
        </RouterLink>
        <RouterLink to="/database" class="nav-link" active-class="on" exact-active-class="on">
          <AppIcon :path="mdiDatabaseOutline" :size="16" />
          {{ t('nav.database') }}
        </RouterLink>
      </nav>
    </div>
    <div class="right">
      <label class="country" :title="t('nav.countryLabel')">
        <span class="visually-hidden">{{ t('nav.countryLabel') }}</span>
        <select
          class="select nav-select"
          :value="country.code"
          :aria-label="t('nav.countryLabel')"
          @change="switchCountry(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in countries" :key="option.code" :value="option.code">
            {{ option.name[locale === 'ru' ? 'ru' : 'en'] }}
          </option>
        </select>
      </label>
      <select
        class="select nav-select"
        :value="override ?? ''"
        :aria-label="t('nav.themeLabel')"
        @change="onThemeChange"
      >
        <option v-for="value in THEME_OPTIONS" :key="value ?? 'system'" :value="value ?? ''">
          {{ themeLabel(value) }}
        </option>
      </select>
      <select
        class="select nav-select"
        :value="locale"
        :aria-label="t('nav.localeLabel')"
        @change="onLocaleChange"
      >
        <option v-for="value in LOCALE_OPTIONS" :key="value" :value="value">
          {{ t(`nav.locale.${value}`) }}
        </option>
      </select>
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
  padding: 11px 16px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--glass-solid);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
@supports (backdrop-filter: blur(1px)) {
  .navbar {
    background: var(--glass-bg);
    backdrop-filter: blur(14px) saturate(150%);
  }
}
.left {
  display: flex;
  align-items: center;
  gap: 18px;
}
.brand {
  font-size: var(--text-xl);
  font-weight: 700;
  white-space: nowrap;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: -0.01em;
}
.nav-links {
  display: flex;
  gap: 4px;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  color: var(--text-muted);
  padding: 6px 10px;
  font: inherit;
  font-size: var(--text-md);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition:
    color var(--transition),
    background var(--transition);
}
.nav-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-2) 70%, transparent);
}
.nav-link.on {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}
/* Base look comes from the shared .select in assets/forms.css; only the
   denser navbar sizing is kept here. */
.nav-select {
  font-size: var(--text-md);
  padding-block: 6px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
