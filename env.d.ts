/// <reference types="vite/client" />

// The validated list of countries, inlined from public/db/ by vite.config.ts
// (see build/countries.mjs). Empty only in a misconfigured build, which cannot
// happen: the build fails before this is reached.
declare const __DB_COUNTRIES__: ReadonlyArray<{
  readonly code: string
  readonly name: { readonly ru: string; readonly en: string }
  readonly currencySymbol: string
  readonly otbasy: boolean
  readonly defaults: Readonly<Record<string, number>>
  readonly example?: Readonly<Record<string, number | boolean>>
}>
