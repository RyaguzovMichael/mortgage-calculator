import { createI18n } from 'vue-i18n'
import { loadLocale } from '@/infrastructure/localePersistence'
import ru from './locales/ru.json'
import en from './locales/en.json'

export const i18n = createI18n({
  legacy: false,
  locale: loadLocale(),
  fallbackLocale: 'ru',
  messages: { ru, en },
})
