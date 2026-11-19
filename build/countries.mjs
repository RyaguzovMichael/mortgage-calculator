// Build-time scan of public/db/<country>/. The list of countries the site offers
// is exactly the set of folders in there — this is what keeps "which countries
// exist" under the control of the folder, as opposed to a hand-maintained list in
// the source. Runs while vite.config.ts is being loaded, so a broken country
// fails the build instead of deploying a country that errors at runtime.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'db')

const CODE_RE = /^[a-z]{2}$/

function fail(country, message) {
  throw new Error(`public/db/${country}: ${message}`)
}

function readMeta(dir, code) {
  const path = join(dir, 'meta.yml')
  if (!existsSync(path)) fail(code, 'нет meta.yml')
  let meta
  try {
    meta = parseYaml(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(code, `meta.yml не парсится: ${error.message}`)
  }
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    fail(code, 'meta.yml: ожидался объект')
  }
  if (meta.code !== code) fail(code, `meta.yml: code «${meta.code}» не совпадает с именем папки`)
  if (!CODE_RE.test(code)) fail(code, 'имя папки должно быть двухбуквенным кодом (ISO 3166-1 alpha-2)')
  for (const lang of ['ru', 'en']) {
    if (typeof meta.name?.[lang] !== 'string' || meta.name[lang].trim() === '') {
      fail(code, `meta.yml: name.${lang} — ожидалась непустая строка`)
    }
  }
  if (typeof meta.currencySymbol !== 'string' || meta.currencySymbol === '') {
    fail(code, 'meta.yml: currencySymbol — ожидалась непустая строка')
  }
  if (typeof meta.otbasy !== 'boolean') {
    fail(code, 'meta.yml: otbasy — ожидался boolean')
  }
  const defaults = meta.defaults ?? {}
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) {
    fail(code, 'meta.yml: defaults — ожидался объект')
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fail(code, `meta.yml: defaults.${key} — ожидалось число`)
    }
  }
  // Optional personal example for the wizard's "посмотреть пример" button —
  // numbers, plus one boolean for the "owned flat" toggle.
  let example
  if (meta.example !== undefined) {
    if (typeof meta.example !== 'object' || meta.example === null || Array.isArray(meta.example)) {
      fail(code, 'meta.yml: example — ожидался объект')
    }
    for (const [key, value] of Object.entries(meta.example)) {
      const ok = typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean'
      if (!ok) fail(code, `meta.yml: example.${key} — ожидалось число или boolean`)
    }
    example = meta.example
  }
  for (const file of ['deposits.yml', 'loans.yml']) {
    if (!existsSync(join(dir, file))) fail(code, `нет ${file}`)
  }
  return {
    code,
    name: { ru: meta.name.ru, en: meta.name.en },
    currencySymbol: meta.currencySymbol,
    otbasy: meta.otbasy,
    defaults,
    ...(example ? { example } : {}),
  }
}

/** Validated list of countries from public/db/, for the build-time define. */
export function loadCountries() {
  if (!existsSync(dbDir)) return []
  const codes = readdirSync(dbDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  if (codes.length === 0) {
    throw new Error('public/db/: не найдено ни одной страны (ожидалась хотя бы одна папка)')
  }
  return codes.map((code) => readMeta(join(dbDir, code), code))
}
