// Calendar month without a day. The model only ever steps in whole months, and
// the Otbasy government bonus lands in a specific calendar month, so the day is
// noise the engine would have to carry and ignore.
export interface YearMonth {
  readonly year: number
  readonly month: number // 1..12
}

export function addMonths(yearMonth: YearMonth, count: number): YearMonth {
  const zeroBased = yearMonth.year * 12 + (yearMonth.month - 1) + count
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 }
}

export function formatYearMonth(yearMonth: YearMonth): string {
  return `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}`
}
