import type { PurchasePlan } from './types/plan'

// The four built-in variants, each as four decisions. This is the whole content
// of what used to be four near-identical files — the rest was scaffolding, now in
// runPlan. A user's own plan is another entry of exactly this shape.
//
// borrow/repay are ignored when loan is 'none'; they are filled in for shape only.
export const HALYK_IMMEDIATE: PurchasePlan = {
  id: 'halyk-immediate',
  name: 'Halyk сразу',
  loan: 'halyk',
  buyWhen: 'asap',
  saveMonths: null,
  borrow: 'max',
  repay: 'monthly',
}

export const HALYK_DELAYED: PurchasePlan = {
  id: 'halyk-delayed',
  name: 'Halyk отложенно',
  loan: 'halyk',
  buyWhen: 'after-months',
  saveMonths: null,
  borrow: 'min',
  repay: 'monthly',
}

export const OTBASY_PLAN: PurchasePlan = {
  id: 'otbasy',
  name: 'Otbasy',
  loan: 'otbasy',
  buyWhen: 'otbasy-gates',
  saveMonths: null,
  borrow: 'max',
  repay: 'lump',
}

export const ALL_CASH: PurchasePlan = {
  id: 'all-cash',
  name: 'Без ипотеки',
  loan: 'none',
  buyWhen: 'asap',
  saveMonths: null,
  borrow: 'max',
  repay: 'monthly',
}
