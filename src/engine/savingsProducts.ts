// The savings products new money can go into. The trade-off between them is the
// point: the higher rate only pays out every 6 months and burns the running
// period if touched early, so it punishes a purchase that lands mid-cycle, while
// the lower one is liquid and pays monthly.
//
// A product is just a (rate, payout period) pair — `Deposit` needs nothing else,
// because a monthly payout period already means "withdraw any time, lose nothing".
export interface SavingsProduct {
  readonly id: string
  readonly label: string
  readonly annualRate: number
  readonly payoutPeriodMonths: number
}

export const SAVINGS_PRODUCTS: readonly SavingsProduct[] = [
  {
    id: 'kaspi-deposit',
    label: 'Kaspi Депозит — 18,4%, выплата раз в 6 месяцев',
    annualRate: 0.184,
    payoutPeriodMonths: 6,
  },
  {
    id: 'kaspi-savings',
    label: 'Kaspi Копилка — 14,1%, выплата каждый месяц, снятие в любой момент',
    annualRate: 0.141,
    payoutPeriodMonths: 1,
  },
]

export function findSavingsProduct(annualRate: number, payoutPeriodMonths: number): SavingsProduct | undefined {
  return SAVINGS_PRODUCTS.find(
    (product) =>
      product.annualRate === annualRate && product.payoutPeriodMonths === payoutPeriodMonths,
  )
}
