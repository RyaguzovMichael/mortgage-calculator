export interface Deposit {
  readonly balance: number
  readonly totalInterest: number
  readonly annualRate: number
  accrue(): number
  add(amount: number): void
  take(amount: number): number
}

export function createDeposit(balance: number, annualRate: number): Deposit {
  throw new Error('not implemented')
}
