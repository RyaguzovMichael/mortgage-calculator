// Nominal annual rates compounded monthly — the convention MODEL.md fixes for
// every rate in the model.
export function monthlyRate(annualRate: number): number {
  return annualRate / 12
}

export function annuityPayment(principal: number, annualRate: number, termMonths: number): number {
  const rate = monthlyRate(annualRate)
  if (rate === 0) return principal / termMonths
  const growth = (1 + rate) ** termMonths
  return (principal * rate * growth) / (growth - 1)
}
