// The countries the build knows about — inlined from public/db/ at build time
// (see vite.config.ts → build/countries.mjs). There is exactly one source of
// truth for "which countries exist": the folders under public/db/. A country is
// added by adding a folder, not by editing this file.

export interface CountryMeta {
  readonly code: string
  readonly name: { readonly ru: string; readonly en: string }
  readonly currencySymbol: string
  readonly otbasy: boolean
  readonly defaults: Readonly<Record<string, number>>
  readonly example?: Readonly<Record<string, number | boolean>>
}

export const COUNTRIES: readonly CountryMeta[] = __DB_COUNTRIES__

export function findCountry(code: string): CountryMeta | undefined {
  return COUNTRIES.find((country) => country.code === code)
}
