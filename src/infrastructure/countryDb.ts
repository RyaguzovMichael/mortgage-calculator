import { parse as parseYaml } from 'yaml'

import { findCountry, type CountryMeta } from './country'
import { parseDepositProducts } from './depositCatalogue'
import { parseLoans, type ParsedLoans } from './loanCatalogue'

export interface CountryDb {
  readonly meta: CountryMeta
  readonly deposits: ReturnType<typeof parseDepositProducts>
  readonly loans: ParsedLoans
}

function dbFileUrl(code: string, file: string): string {
  return `${import.meta.env.BASE_URL}db/${code}/${file}`
}

async function fetchYaml(code: string, file: string): Promise<unknown> {
  const url = dbFileUrl(code, file)
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(`Не удалось загрузить ${url} — проверьте подключение к сети`)
  }
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url} (HTTP ${response.status})`)
  }
  let text: string
  try {
    text = await response.text()
  } catch {
    throw new Error(`Не удалось прочитать ответ ${url}`)
  }
  try {
    return parseYaml(text)
  } catch (error) {
    throw new Error(`${url}: некорректный YAML — ${(error as Error).message}`)
  }
}

// Fetch and validate a country's database. Throws with a human-readable message
// on any failure — a country whose data cannot be loaded must never fall back to
// another country's numbers silently.
export async function fetchCountryDb(code: string): Promise<CountryDb> {
  const meta = findCountry(code)
  if (!meta) {
    throw new Error(`Неизвестная страна: ${code}`)
  }
  const [depositsRaw, loansRaw] = await Promise.all([
    fetchYaml(code, 'deposits.yml'),
    fetchYaml(code, 'loans.yml'),
  ])
  const loans = parseLoans(loansRaw, { requireOtbasy: meta.otbasy })
  if (meta.otbasy && !loans.otbasy) {
    // Unreachable: requireOtbasy already threw above. Kept as a belt-and-braces.
    throw new Error(`${code}: meta.yml объявляет otbasy, но loans.yml не содержит запись otbasy`)
  }
  return {
    meta,
    deposits: parseDepositProducts(depositsRaw),
    loans,
  }
}
