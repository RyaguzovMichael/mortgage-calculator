// Nominal annual rates compounded monthly — the convention MODEL.md fixes for
// every *bank* rate in the model, because that is what the contract says.
export function monthlyRate(annualRate: number): number {
  return annualRate / 12
}

// Real-world year-over-year change — prices, rent, income — spread geometrically
// across the year. Deliberately not monthlyRate: an observed "up 24% this year"
// is the finished annual figure, and compounding it monthly would silently
// restate it as 26.82%.
export function annualGrowthFactor(annualRate: number, monthIndex: number): number {
  return (1 + annualRate) ** (monthIndex / 12)
}

export function annuityPayment(principal: number, annualRate: number, termMonths: number): number {
  const rate = monthlyRate(annualRate)
  if (rate === 0) return principal / termMonths
  const growth = (1 + rate) ** termMonths
  return (principal * rate * growth) / (growth - 1)
}
