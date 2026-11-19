import { activeCountryCode } from './currentCountry'

// How far into the start-condition wizard the user got, per country — a visitor
// who closes the tab mid-way resumes where they left off instead of re-clicking
// through screens they already filled in. Cleared once the wizard finishes or
// the inputs are blanked, so a fresh run always starts at 0.
export function wizardStepStorageKey(country: string): string {
  return `mortgage:wizard-step:${country}:v1`
}

function currentKey(): string {
  return wizardStepStorageKey(activeCountryCode())
}

export function loadWizardStep(): number | null {
  const raw = localStorage.getItem(currentKey())
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function saveWizardStep(index: number): void {
  localStorage.setItem(currentKey(), String(index))
}

export function clearWizardStep(): void {
  localStorage.removeItem(currentKey())
}
