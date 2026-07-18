import { useI18n } from 'vue-i18n'
import { saveLocale, type Locale } from '@/infrastructure/localePersistence'

export function useLocale() {
  const { locale } = useI18n()

  function setLocale(value: Locale): void {
    locale.value = value
    saveLocale(value)
  }

  return { locale, setLocale }
}
