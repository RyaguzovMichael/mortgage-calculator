// Shared test fixtures: loads the shipped KZ database from disk and selects it as
// the active country, exactly as the production bootstrap does — only synchronously,
// straight from the files. Import this (for its values or for the side effect)
// from every spec that touches the catalogues, stored inputs, or the wizard.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { COUNTRIES } from '@/infrastructure/country'
import { setCurrentCountry } from '@/infrastructure/currentCountry'
import { parseDepositProducts } from '@/infrastructure/depositCatalogue'
import { parseLoans } from '@/infrastructure/loanCatalogue'
import { buildBlankStartInputs, buildDefaultInputs } from '@/infrastructure/inputsStorage'

function readDb(file: string): unknown {
  return parseYaml(readFileSync(join(process.cwd(), 'public', 'db', 'kz', file), 'utf8'))
}

function loadKz() {
  const meta = COUNTRIES.find((country) => country.code === 'kz')
  if (!meta) {
    throw new Error('fixtures: kz is missing from __DB_COUNTRIES__ — is the define configured?')
  }
  setCurrentCountry(meta, {
    deposits: parseDepositProducts(readDb('deposits.yml')),
    loans: parseLoans(readDb('loans.yml'), { requireOtbasy: true }),
  })
  return meta
}

export const KZ_META = loadKz()

// Specs that re-select a different country mid-run call this to reset the world.
export function useKz(): void {
  loadKz()
}

// The model's start month is "today" in production, but the engine specs are
// written against a fixed calendar ("the Junes are months 11, 23, 35..."), so the
// fixtures pin it rather than let the suite drift with the clock.
const PINNED_START = { year: 2026, month: 7 }

const defaults = buildDefaultInputs()
export const DEFAULT_INPUTS = { ...defaults, start: { ...PINNED_START } }

const blank = buildBlankStartInputs()
export const BLANK_START_INPUTS = { ...blank, start: { ...PINNED_START } }
