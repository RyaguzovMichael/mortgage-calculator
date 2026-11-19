<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { COUNTRIES } from '@/infrastructure/country'
import { saveCountry } from '@/infrastructure/countryPersistence'
import { useLocale } from '@/app/useLocale'
import type { Locale } from '@/infrastructure/localePersistence'

// Shown before the app boots when there is no (or an unknown) stored country, or
// when the selected country's data failed to load. Picking a country stores it
// and reloads — the whole app bootstraps from the choice, so an in-place swap is
// deliberately not attempted.
const props = defineProps<{ error?: string | null }>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const { locale, setLocale } = useLocale()

const LOCALE_OPTIONS: readonly Locale[] = ['ru', 'en']

function onLocaleChange(event: Event): void {
  setLocale((event.target as HTMLSelectElement).value as Locale)
}

function pick(code: string) {
  saveCountry(code)
  window.location.reload()
}
</script>

<template>
  <div class="gate">
    <div class="card">
      <select
        class="select gate-locale"
        :value="locale"
        :aria-label="t('nav.localeLabel')"
        @change="onLocaleChange"
      >
        <option v-for="value in LOCALE_OPTIONS" :key="value" :value="value">
          {{ t(`nav.locale.${value}`) }}
        </option>
      </select>
      <template v-if="props.error">
        <h1 class="title">{{ t('countryGate.errorTitle') }}</h1>
        <p class="lead">{{ t('countryGate.errorLead') }}</p>
        <p class="detail">{{ props.error }}</p>
        <button type="button" class="primary" @click="emit('retry')">
          {{ t('countryGate.retry') }}
        </button>
      </template>
      <template v-else>
        <h1 class="title">{{ t('countryGate.title') }}</h1>
        <p class="lead">{{ t('countryGate.lead') }}</p>
        <div class="choices">
          <button
            v-for="country in COUNTRIES"
            :key="country.code"
            type="button"
            class="choice"
            @click="pick(country.code)"
          >
            <span class="choice-name">{{ country.name[locale === 'ru' ? 'ru' : 'en'] }}</span>
            <span class="choice-symbol">{{ country.currencySymbol }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gate {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: var(--app-bg);
  color: var(--text-primary);
  font-family: var(--font);
  padding: 24px;
}
.card {
  position: relative;
  max-width: 460px;
  width: 100%;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 32px;
  text-align: center;
}
.gate-locale {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: var(--text-md);
  padding-block: 6px;
}
.title {
  font-size: 1.35rem;
  margin: 0 0 8px;
}
.lead {
  color: var(--text-muted);
  margin: 0 0 20px;
}
.detail {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--critical);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin: 0 0 16px;
  word-break: break-word;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.choice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color var(--transition), transform var(--transition);
}
.choice:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
.choice-name {
  font-weight: 600;
}
.choice-symbol {
  color: var(--text-muted);
}
.primary {
  font: inherit;
  font-weight: 600;
  color: var(--accent-contrast);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-md);
  padding: 12px 22px;
  cursor: pointer;
}
</style>
