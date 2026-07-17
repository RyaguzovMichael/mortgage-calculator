"""
Mortgage strategy comparison: Halyk vs Otbasy.

ASSUMPTIONS (confirm / adjust before trusting results):
  - All rates are nominal annual, applied with monthly capitalization
    (monthly_rate = annual_nominal / 12).
  - Apartment price 45,000,000; 30,000,000 own cash goes straight to the
    seller; the remaining 15,000,000 gap is financed one way or another.
  - Halyk: down payment = 20% of the 15,000,000 gap = 3,000,000, paid from
    own funds (on top of the 30,000,000). Bank loan = 12,000,000 @ 24%.
    Full monthly budget (500,000) is paid into the loan every month
    (scheduled annuity payment + extra straight to principal).
  - Otbasy: contribute 500,000/month into the Otbasy savings deposit
    (2% nominal + once-a-year 20% government bonus every February, bonus
    base capped at 865,000/year of contributions; bonus itself does NOT
    count toward the CC coefficient). Qualify for the loan once BOTH:
      (a) deposit balance >= 50% of target loan (7,500,000)
      (b) CC = accumulated_bank_interest_tenge / target_loan * 1000 >= 5
    Once qualified, the accumulated deposit balance is applied toward the
    purchase and the bank loan = 15,000,000 - deposit_balance_at_qualification,
    at 8.5%, paying only the scheduled annuity (no extra payments).
    From that point, 500,000/month instead goes into a fresh Kaspi deposit
    at 18.4% until it covers the remaining loan balance, then one lump-sum
    payoff closes the loan.
"""

from dataclasses import dataclass, field

APARTMENT_PRICE = 45_000_000
OWN_CASH_TO_SELLER = 35_000_000
TARGET_LOAN = APARTMENT_PRICE - OWN_CASH_TO_SELLER  # 15,000,000

MONTHLY_BUDGET = 500_000
MAX_TERM_MONTHS = 240

HALYK_RATE = 0.24
HALYK_DOWN_PAYMENT = 0.20 * TARGET_LOAN  # 3,000,000
HALYK_LOAN = TARGET_LOAN - HALYK_DOWN_PAYMENT  # 12,000,000

OTBASY_RATE = 0.085
OTBASY_DEPOSIT_RATE = 0.02
OTBASY_START_BALANCE = 648_509.26
OTBASY_MIN_BALANCE_FRACTION = 0.50  # 7,500,000
OTBASY_GOV_BONUS_RATE = 0.20
OTBASY_GOV_BONUS_CAP = 200 * 4325  # 865,000 per year
CC_TARGET = 5

KASPI_SAVE_RATE = 0.184  # best available rate used for phase-2 savings

KASPI_START_BALANCE = 1_021_923.88 + 356_599  # existing liquid Kaspi deposits


def annuity_payment(principal: float, annual_rate: float, n_months: int) -> float:
    r = annual_rate / 12
    if r == 0:
        return principal / n_months
    return principal * r * (1 + r) ** n_months / ((1 + r) ** n_months - 1)


@dataclass
class LoanState:
    balance: float
    annual_rate: float
    scheduled_payment: float
    total_interest: float = 0.0
    months: int = 0

    def step(self, extra_payment: float = 0.0):
        if self.balance <= 0:
            return 0.0
        r = self.annual_rate / 12
        interest = self.balance * r
        payment = min(self.scheduled_payment + extra_payment, self.balance + interest)
        principal_paid = payment - interest
        self.balance -= principal_paid
        if self.balance < 0.01:
            self.balance = 0.0
        self.total_interest += interest
        self.months += 1
        return payment


def simulate_halyk():
    loan = LoanState(
        balance=HALYK_LOAN,
        annual_rate=HALYK_RATE,
        scheduled_payment=annuity_payment(HALYK_LOAN, HALYK_RATE, MAX_TERM_MONTHS),
    )
    while loan.balance > 0 and loan.months < MAX_TERM_MONTHS * 2:
        scheduled = loan.scheduled_payment
        extra = max(0.0, MONTHLY_BUDGET - scheduled)
        loan.step(extra_payment=extra)
    return loan


def simulate_kaspi_then_halyk(saving_months: int):
    """Save on Kaspi for `saving_months`, then use the whole pile as the
    Halyk down payment and pay off the (smaller) remaining loan with the
    same 500,000/month extra-payment strategy as the immediate-start Halyk.

    `saving_months` is chained to the Otbasy accumulation duration
    (months_to_qualify) so the two variants are compared over the same
    savings window, wherever that window comes from.
    """
    balance = KASPI_START_BALANCE
    interest_earned = 0.0
    for _ in range(saving_months):
        interest = balance * (KASPI_SAVE_RATE / 12)
        balance += interest
        interest_earned += interest
        balance += MONTHLY_BUDGET

    down_payment = balance
    loan_amount = max(0.0, TARGET_LOAN - down_payment)

    loan = LoanState(
        balance=loan_amount,
        annual_rate=HALYK_RATE,
        scheduled_payment=annuity_payment(loan_amount, HALYK_RATE, MAX_TERM_MONTHS),
    )
    while loan.balance > 0 and loan.months < MAX_TERM_MONTHS * 2:
        extra = max(0.0, MONTHLY_BUDGET - loan.scheduled_payment)
        loan.step(extra_payment=extra)

    return {
        "saving_months": saving_months,
        "down_payment": down_payment,
        "kaspi_interest_earned": interest_earned,
        "loan_amount": loan_amount,
        "repay_months": loan.months,
        "total_interest_paid": loan.total_interest,
        "total_months": saving_months + loan.months,
    }


def simulate_otbasy_accumulation():
    """Grow the Otbasy deposit until both qualification conditions are met.

    Also runs a parallel "what if this money sat in Kaspi at KASPI_SAVE_RATE
    instead" simulation on the same contribution stream, so we can report the
    opportunity-cost loss of being forced to save at Otbasy's low rate.
    """
    balance = OTBASY_START_BALANCE
    accumulated_interest = 0.0
    contributions_this_calendar_year = 0.0

    # parallel alternative: same contributions, no gov bonus, at Kaspi's rate
    alt_balance = OTBASY_START_BALANCE

    month = 0
    # start date: contributions begin Aug 2026; bonus applied every February
    year_month = (2026, 8)

    def next_month(ym):
        y, m = ym
        return (y + 1, 1) if m == 12 else (y, m + 1)

    while True:
        month += 1
        y, m = year_month

        # monthly interest on current balance
        interest = balance * (OTBASY_DEPOSIT_RATE / 12)
        balance += interest
        accumulated_interest += interest

        # monthly contribution
        balance += MONTHLY_BUDGET
        contributions_this_calendar_year += MONTHLY_BUDGET

        # government bonus applied every February, based on prior year's contributions
        if m == 2:
            bonus_base = min(contributions_this_calendar_year, OTBASY_GOV_BONUS_CAP)
            bonus = bonus_base * OTBASY_GOV_BONUS_RATE
            balance += bonus
            contributions_this_calendar_year = 0.0

        # alternative path: same contribution, Kaspi rate, no gov bonus
        alt_balance += alt_balance * (KASPI_SAVE_RATE / 12)
        alt_balance += MONTHLY_BUDGET

        cc = accumulated_interest / TARGET_LOAN * 1000
        if balance >= OTBASY_MIN_BALANCE_FRACTION * TARGET_LOAN and cc >= CC_TARGET:
            return {
                "months_to_qualify": month,
                "deposit_balance": balance,
                "accumulated_interest": accumulated_interest,
                "cc": cc,
                "alt_kaspi_balance": alt_balance,
                "opportunity_cost_loss": alt_balance - balance,
            }

        year_month = next_month(year_month)

        if month > 600:
            raise RuntimeError("Otbasy accumulation did not qualify within 50 years")


def simulate_otbasy_loan_and_payoff(deposit_balance_at_qualification: float):
    loan_amount = TARGET_LOAN - deposit_balance_at_qualification
    loan = LoanState(
        balance=loan_amount,
        annual_rate=OTBASY_RATE,
        scheduled_payment=annuity_payment(loan_amount, OTBASY_RATE, MAX_TERM_MONTHS),
    )

    kaspi_balance = 0.0
    kaspi_interest_earned = 0.0
    month = 0

    while loan.balance > 0 and month < MAX_TERM_MONTHS * 2:
        month += 1

        # loan: scheduled payment only, no extra
        loan.step(extra_payment=0.0)

        # the required scheduled payment is funded from the 500,000 budget;
        # only what's left over goes into the Kaspi deposit
        leftover_after_loan_payment = max(0.0, MONTHLY_BUDGET - loan.scheduled_payment)

        # kaspi savings growth
        interest = kaspi_balance * (KASPI_SAVE_RATE / 12)
        kaspi_balance += interest
        kaspi_interest_earned += interest
        kaspi_balance += leftover_after_loan_payment

        if kaspi_balance >= loan.balance and loan.balance > 0:
            # lump-sum payoff
            payoff_interest_this_month = loan.balance * (OTBASY_RATE / 12)
            loan.total_interest += 0  # interest for the final month already
            kaspi_balance -= loan.balance
            loan.balance = 0.0
            break

    return {
        "loan_amount": loan_amount,
        "months_to_payoff": month,
        "total_interest_paid": loan.total_interest,
        "kaspi_leftover": kaspi_balance,
        "kaspi_interest_earned": kaspi_interest_earned,
    }


def main():
    print("=== Halyk ===")
    halyk = simulate_halyk()
    print(f"Loan amount: {HALYK_LOAN:,.2f}")
    print(f"Down payment (own funds): {HALYK_DOWN_PAYMENT:,.2f}")
    print(f"Scheduled monthly annuity payment: {halyk.scheduled_payment:,.2f}")
    print(f"Months to payoff: {halyk.months}")
    print(f"Total interest paid (loss): {halyk.total_interest:,.2f}")
    print()

    print("=== Otbasy: accumulation phase ===")
    acc = simulate_otbasy_accumulation()
    print(f"Months to qualify: {acc['months_to_qualify']}")
    print(f"Deposit balance at qualification: {acc['deposit_balance']:,.2f}")
    print(f"Accumulated bank interest (for CC): {acc['accumulated_interest']:,.2f}")
    print(f"CC at qualification: {acc['cc']:.2f}")
    print(f"Alternative: same contributions at Kaspi {KASPI_SAVE_RATE:.1%} would give: {acc['alt_kaspi_balance']:,.2f}")
    print(f"Opportunity-cost loss of saving at Otbasy instead of Kaspi: {acc['opportunity_cost_loss']:,.2f}")
    print()

    print("=== Otbasy: loan + Kaspi payoff phase ===")
    result = simulate_otbasy_loan_and_payoff(acc["deposit_balance"])
    print(f"Loan amount disbursed: {result['loan_amount']:,.2f}")
    print(f"Months to payoff (after loan start): {result['months_to_payoff']}")
    print(f"Total interest paid on loan (loss): {result['total_interest_paid']:,.2f}")
    print(f"Kaspi interest earned during payoff phase: {result['kaspi_interest_earned']:,.2f}")
    print(f"Kaspi leftover after lump-sum payoff: {result['kaspi_leftover']:,.2f}")
    print()

    print(f"=== Halyk delayed (save on Kaspi {acc['months_to_qualify']} months, chained to Otbasy qualification time, then big down payment) ===")
    delayed = simulate_kaspi_then_halyk(saving_months=acc["months_to_qualify"])
    print(f"Saving months: {delayed['saving_months']}")
    print(f"Kaspi interest earned while saving: {delayed['kaspi_interest_earned']:,.2f}")
    print(f"Down payment used: {delayed['down_payment']:,.2f}")
    print(f"Resulting loan amount: {delayed['loan_amount']:,.2f}")
    print(f"Months to repay after loan start: {delayed['repay_months']}")
    print(f"Total interest paid (loss): {delayed['total_interest_paid']:,.2f}")
    print(f"Total months (save + repay): {delayed['total_months']}")
    print()

    total_months_otbasy = acc["months_to_qualify"] + result["months_to_payoff"]
    otbasy_total_loss = (
        acc["opportunity_cost_loss"]
        + result["total_interest_paid"]
        - result["kaspi_interest_earned"]
    )
    print("=== Comparison ===")
    print(f"Halyk (immediate, 3M down payment): {halyk.months} months, total interest paid (loss): {halyk.total_interest:,.2f}")
    print(
        f"Halyk (delayed, save {delayed['saving_months']}mo then all-in down payment): {delayed['total_months']} months "
        f"({delayed['saving_months']} save + {delayed['repay_months']} repay), "
        f"total interest paid (loss): {delayed['total_interest_paid']:,.2f}"
    )
    print(
        f"Otbasy: {total_months_otbasy} months total "
        f"({acc['months_to_qualify']} accumulate + {result['months_to_payoff']} repay)"
    )
    print(f"  accumulation-phase opportunity-cost loss (vs Kaspi): {acc['opportunity_cost_loss']:,.2f}")
    print(f"  loan-phase interest paid: {result['total_interest_paid']:,.2f}")
    print(f"  loan-phase Kaspi interest earned: {result['kaspi_interest_earned']:,.2f}")
    print(f"  Otbasy total loss (accumulation opp-cost + net loan interest): {otbasy_total_loss:,.2f}")


if __name__ == "__main__":
    main()
