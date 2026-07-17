import type { MonthRow, VariantTotals } from './types/plan'

export function summarize(rows: readonly MonthRow[]): VariantTotals {
  const rentPaid = total(rows, (row) => row.rentPaid)
  const loanInterestPaid = total(rows, (row) => row.loanInterest)
  const depositInterestEarned = total(rows, (row) => row.depositInterestEarned)
  const govBonusReceived = total(rows, (row) => row.govBonus)

  return {
    rentPaid,
    loanInterestPaid,
    depositInterestEarned,
    govBonusReceived,
    totalLoss: rentPaid + loanInterestPaid - depositInterestEarned - govBonusReceived,
    netWorthAtEnd: rows[rows.length - 1]?.netWorth ?? 0,
  }
}

function total(rows: readonly MonthRow[], pick: (row: MonthRow) => number): number {
  return rows.reduce((sum, row) => sum + pick(row), 0)
}
