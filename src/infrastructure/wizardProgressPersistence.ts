export const WIZARD_STEP_STORAGE_KEY = 'mortgage:wizard-step:v1'

// How far into the start-condition wizard someone got, so a visitor who closes
// the tab mid-way (or gets redirected back to /start by the router guard) picks
// up where they left off instead of re-clicking through screens they already
// filled in. Cleared once the wizard finishes or the inputs are blanked, so a
// fresh run always starts at 0.
export function loadWizardStep(): number | null {
  const raw = localStorage.getItem(WIZARD_STEP_STORAGE_KEY)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function saveWizardStep(index: number): void {
  localStorage.setItem(WIZARD_STEP_STORAGE_KEY, String(index))
}

export function clearWizardStep(): void {
  localStorage.removeItem(WIZARD_STEP_STORAGE_KEY)
}
