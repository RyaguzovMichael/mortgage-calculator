// The glyph each plan decision wears in the wizard's choice cards. One place so the
// wizard stays about layout, not about which icon means "borrow the maximum". Every
// path is an @mdi/js export — see AppIcon.vue for why we ship paths, not a font.
import {
  mdiArrowDownBoldCircleOutline,
  mdiArrowUpBoldCircleOutline,
  mdiBank,
  mdiBoomGate,
  mdiCalendarClock,
  mdiCalendarSync,
  mdiCash,
  mdiClockFast,
  mdiClockOutline,
  mdiCreditCardOutline,
  mdiHomeCityOutline,
  mdiHomeExportOutline,
  mdiHomeHeart,
  mdiInfinity,
  mdiPiggyBank,
  mdiPiggyBankOutline,
  mdiRocketLaunchOutline,
  mdiShieldHomeOutline,
} from '@mdi/js'
import type { HousingSituation } from '@/engine/types/inputs'
import type { PurchasePlan } from '@/engine/types/plan'

export const BUY_WHEN_ICONS: Record<PurchasePlan['buyWhen'], string> = {
  asap: mdiRocketLaunchOutline,
  'after-months': mdiCalendarClock,
  'otbasy-gates': mdiBoomGate,
}

export const BORROW_ICONS: Record<PurchasePlan['borrow'], string> = {
  max: mdiArrowUpBoldCircleOutline,
  min: mdiArrowDownBoldCircleOutline,
}

export const REPAY_ICONS: Record<PurchasePlan['repay'], string> = {
  monthly: mdiCalendarSync,
  lump: mdiPiggyBank,
  never: mdiInfinity,
}

export const TERM_ICONS: Record<PurchasePlan['term'], string> = {
  max: mdiClockOutline,
  shortest: mdiClockFast,
}

export const HOUSING_ICONS: Record<HousingSituation, string> = {
  selling: mdiHomeExportOutline,
  free: mdiHomeHeart,
  renting: mdiHomeCityOutline,
}

// Every deposit card wears the same glyph — the deposits differ by rate, not kind.
export const DEPOSIT_ICON = mdiPiggyBankOutline

// The built-in loans get their own glyph; a user's own credit falls back to the
// generic card. Cash ('none') is money with no loan behind it.
export function loanIcon(loanId: string): string {
  if (loanId === 'none') return mdiCash
  if (loanId === 'otbasy') return mdiShieldHomeOutline
  if (loanId === 'halyk' || loanId === 'halyk-fee' || loanId === 'halyk-7-20-25') return mdiBank
  return mdiCreditCardOutline
}
