// Whether the user has finished the start-condition wizard. A dedicated flag, not
// the presence of the inputs blob: the wizard writes into the reactive inputs
// tree as the user types, which auto-saves a blob long before they press Start, so
// blob-presence would flip "onboarded" mid-flow. This flag flips only on Start.
export const ONBOARDING_STORAGE_KEY = 'mortgage:onboarded:v1'

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'done'
}

export function markOnboarded(): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, 'done')
}

export function clearOnboarded(): void {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
}
