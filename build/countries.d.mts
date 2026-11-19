// Types for build/countries.mjs (plain JS so vite.config.ts can import it).
export interface CountryEntry {
  readonly code: string
  readonly name: { readonly ru: string; readonly en: string }
  readonly currencySymbol: string
  readonly otbasy: boolean
  readonly defaults: Readonly<Record<string, number>>
  readonly example?: Readonly<Record<string, number | boolean>>
}

export declare function loadCountries(): CountryEntry[]
