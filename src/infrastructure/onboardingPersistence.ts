import { activeCountryCode } from './currentCountry'

// Whether the user has finished the start-condition wizard — per country: the
// tour is about this country's numbers, so finishing it in Kazakhstan says
// nothing about Russia. A dedicated flag, not the presence of the inputs blob:
// the wizard writes into the reactive inputs tree as the user types, which
// auto-saves a blob long before they press Start, so blob-presence would flip
// "onboarded" mid-flow. This flag flips only on Start.
export function onboardingStorageKey(country: string): string {
  return `mortgage:onboarded:${country}:v1`
}

function currentKey(): string {
  return onboardingStorageKey(activeCountryCode())
}

export function isOnboarded(): boolean {
  return localStorage.getItem(currentKey()) === 'done'
}

export function markOnboarded(): void {
  localStorage.setItem(currentKey(), 'done')
}

export function clearOnboarded(): void {
  localStorage.removeItem(currentKey())
}
