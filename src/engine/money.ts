// Nominal annual rates compounded monthly — the convention MODEL.md fixes for
// every *bank* rate in the model, because that is what the contract says.
export function monthlyRate(annualRate: number): number {
  return annualRate / 12
}

const GROWTH_STEP_MONTHS = 6

// Real-world year-over-year change — apartment prices, rent — applied in
// half-year steps rather than as a monthly drift: a flat is not repriced every
// month, and neither is a lease.
//
// Deliberately not monthlyRate: an observed "up 24% this year" is the finished
// annual figure, and compounding it monthly would silently restate it as 26.82%.
// Two half-year steps still land on exactly the stated annual rate at month 12.
export function annualGrowthFactor(annualRate: number, monthIndex: number): number {
  const halfYears = Math.floor(monthIndex / GROWTH_STEP_MONTHS)
  return (1 + annualRate) ** (halfYears / 2)
}

export function annuityPayment(principal: number, annualRate: number, termMonths: number): number {
  const rate = monthlyRate(annualRate)
  if (rate === 0) return principal / termMonths
  const growth = (1 + rate) ** termMonths
  return (principal * rate * growth) / (growth - 1)
}

// The shortest term whose annuity the borrower can still support: pay more each
// month, finish sooner. The smallest integer term in [1, maxTermMonths] whose
// payment is <= maxPayment. Falls back to maxTermMonths when even the longest term
// does not fit under the cap — the purchase then fails the affordability gate and
// defers, exactly as a max-term loan that is too big to service would. A linear
// scan up from 1: maxTermMonths is a few hundred at most, and this is exact where
// inverting the annuity formula would flirt with off-by-one float error.
export function shortestTerm(
  principal: number,
  annualRate: number,
  maxPayment: number,
  maxTermMonths: number,
): number {
  if (principal <= 0) return 1
  for (let term = 1; term < maxTermMonths; term += 1) {
    if (annuityPayment(principal, annualRate, term) <= maxPayment) return term
  }
  return maxTermMonths
}
