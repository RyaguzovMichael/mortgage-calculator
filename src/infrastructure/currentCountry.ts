import type { DepositProduct } from '@/engine/types/inputs'
import type { CountryMeta } from './country'
import { setDepositCatalogue } from './depositCatalogue'
import { setLoanCatalogue, type ParsedLoans } from './loanCatalogue'
import { loadCountry } from './countryPersistence'

// The country the app is currently running against: its meta (from the
// build-time list) plus its parsed catalogues (fetched at startup). Set exactly
// once, before anything reads the catalogues — inputsStorage, the components,
// the engine all read through here, so nobody can observe a half-initialised
// state. Tests set it the same way from the files on disk.
export interface CurrentCountry {
  readonly meta: CountryMeta
  readonly deposits: readonly DepositProduct[]
  readonly loans: ParsedLoans
}

let current: CurrentCountry | null = null

export function setCurrentCountry(meta: CountryMeta, db: {
  deposits: readonly DepositProduct[]
  loans: ParsedLoans
}): void {
  setDepositCatalogue(db.deposits)
  setLoanCatalogue(db.loans)
  current = { meta, deposits: db.deposits, loans: db.loans }
}

export function currentCountry(): CurrentCountry {
  if (current === null) {
    throw new Error('Страна ещё не выбрана: вызовите setCurrentCountry до загрузки данных')
  }
  return current
}

// For storage keys that need a namespace but no catalogue data (onboarding,
// wizard progress). Falls back to the persisted choice so importing this module
// graph never crashes outside a bootstrapped app; throws only when there is no
// country anywhere.
export function activeCountryCode(): string {
  if (current) return current.meta.code
  const stored = loadCountry()
  if (stored) return stored
  throw new Error('Страна ещё не выбрана')
}
